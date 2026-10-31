const knex = require('../db');
const { dispatch, assignWaiting } = require('./allocationService');
const { addToStock, sendToWaiting } = require('./stockService');
const { cleanText } = require('../validation');
const { prepareNotes, saveNotes, notesFor, inEnglish, retryUntranslated } = require('./noteService');
const { classifyFailure } = require('../ai/incident');

async function listShipments(driverId) {
    const query = knex('shipments')
        .leftJoin('requests', 'shipments.request_id', 'requests.request_id')
        .leftJoin('shelters', 'requests.shelter_id', 'shelters.shelter_id')
        .leftJoin('warehouses', 'shipments.warehouse_id', 'warehouses.warehouse_id')
        .leftJoin('drivers', 'shipments.driver_id', 'drivers.driver_id')
        .select(
            'shipments.*',
            'requests.urgency',
            'requests.shelter_id',
            'shelters.name as shelter_name',
            'shelters.latitude as shelter_lat',
            'shelters.longitude as shelter_lng',
            'warehouses.name as warehouse_name',
            'warehouses.latitude as warehouse_lat',
            'warehouses.longitude as warehouse_lng',
            'drivers.name as driver_name'
        )
        .orderBy('shipments.shipment_id');
    if (driverId) {
        query.where('shipments.driver_id', driverId);
    }
    const rows = await query;
    const notes = await notesFor(rows.map((r) => r.shipment_id));
    retryUntranslated();
    return rows.map((r) => ({ ...r, notes: notes.get(r.shipment_id) || [] }));
}

function englishOf(notes, kind) {
    const note = notes.find((n) => n.kind === kind);
    return note ? inEnglish(note) : null;
}

async function findShipment(id) {
    return knex('shipments').where({ shipment_id: id }).first();
}

function readDamage(body, max) {
    const damaged = body.damaged === undefined || body.damaged === '' ? 0 : Number(body.damaged);
    if (!Number.isInteger(damaged) || damaged < 0 || damaged > max) {
        return { error: 'Damaged must be a whole number from 0 to ' + max };
    }
    const note = cleanText(body.damage_note);
    if (damaged > 0 && !note) {
        return { error: 'Describe the damage' };
    }
    return { damaged, note: damaged > 0 ? note : null };
}

function addNote(existing, stage, note) {
    if (!note) return existing;
    const line = stage + ': ' + note;
    return existing ? existing + '; ' + line : line;
}

const ALREADY_MOVED = 'This shipment was already updated, so nothing was changed. Refresh to see where it is now.';

class AlreadyMoved extends Error {}

async function moveShipment(trx, id, from, changes) {
    const updated = await trx('shipments').where({ shipment_id: id, status: from }).update(changes);
    if (updated === 0) throw new AlreadyMoved();
}

async function inTransaction(work) {
    try {
        await knex.transaction(work);
        return true;
    } catch (err) {
        if (err instanceof AlreadyMoved) return false;
        throw err;
    }
}

async function reopenRequest(trx, requestId, lost) {
    const request = await trx('requests').where({ request_id: requestId }).first();
    const stillAllocated = Math.max(0, request.quantity_allocated - lost);
    await trx('requests').where({ request_id: requestId }).update({
        quantity_allocated: stillAllocated,
        status: stillAllocated > 0 ? 'Partial' : 'Unfulfilled',
        replacement_pending: true,
    });
    const updated = await trx('requests').where({ request_id: requestId }).first();
    const { shipments } = await dispatch(trx, [updated], `REPLACE-${Date.now()}`);
    return shipments.map((s) => s.shipment_id);
}

async function assignDriver(id, body) {
    body = body || {};
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'Ready') return { errors: ['Only shipments that are Ready can be assigned'] };
    const driver = await knex('drivers').where({ driver_id: body.driver_id || '' }).first();
    if (!driver) return { errors: ['Choose a driver that exists'] };
    const sameLoad = await knex('shipments')
        .where({ run_id: shipment.run_id, request_id: shipment.request_id, warehouse_id: shipment.warehouse_id, driver_id: driver.driver_id })
        .whereNot({ shipment_id: id })
        .whereIn('status', ['Ready', 'In transit'])
        .first();
    if (sameLoad) {
        return { errors: [`${driver.name} is already carrying ${sameLoad.shipment_id}, another part of this load. Over-capacity loads need a second driver.`] };
    }
    const updated = await knex('shipments').where({ shipment_id: id, status: 'Ready' }).update({ driver_id: driver.driver_id });
    if (updated === 0) return { errors: [ALREADY_MOVED] };
    return { row: { ...shipment, driver_id: driver.driver_id } };
}

async function pickUp(id, body) {
    body = body || {};
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'Ready') return { errors: ['Only shipments that are Ready can be picked up'] };
    if (!shipment.driver_id) return { errors: ['Assign a driver first'] };

    const damage = readDamage(body, shipment.quantity);
    if (damage.error) return { errors: [damage.error] };
    const notes = await prepareNotes([{ kind: 'damage', stage: 'At pickup', text: damage.note }]);

    const changes = {
        status: 'In transit',
        picked_up_at: new Date().toISOString(),
        quantity_damaged: damage.damaged,
        damage_note: addNote(shipment.damage_note, 'At pickup', englishOf(notes, 'damage')),
    };

    let replacements = [];
    const done = await inTransaction(async (trx) => {
        await moveShipment(trx, id, 'Ready', changes);
        await saveNotes(trx, id, notes);
        if (damage.damaged > 0) {
            replacements = await reopenRequest(trx, shipment.request_id, damage.damaged);
        }
    });
    if (!done) return { errors: [ALREADY_MOVED] };

    return { row: { ...shipment, ...changes, replacements } };
}

async function deliver(id, body) {
    body = body || {};
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'In transit') return { errors: ['Only shipments in transit can be delivered'] };

    const onBoard = shipment.quantity - shipment.quantity_damaged;
    const damage = readDamage(body, onBoard);
    if (damage.error) return { errors: [damage.error] };

    const notes = await prepareNotes([{ kind: 'damage', stage: 'On arrival', text: damage.note }]);

    const intact = onBoard - damage.damaged;
    const changes = {
        status: 'Delivered',
        delivered_at: new Date().toISOString(),
        quantity_damaged: shipment.quantity_damaged + damage.damaged,
        damage_note: addNote(shipment.damage_note, 'On arrival', englishOf(notes, 'damage')),
    };

    let replacements = [];
    const done = await inTransaction(async (trx) => {
        await moveShipment(trx, id, 'In transit', changes);
        await saveNotes(trx, id, notes);

        const request = await trx('requests').where({ request_id: shipment.request_id }).first();
        const delivered = request.quantity_delivered + intact;
        const requestChanges = { quantity_delivered: delivered };
        if (damage.damaged === 0 && delivered >= request.quantity) {
            requestChanges.status = 'Fulfilled';
        }
        await trx('requests').where({ request_id: shipment.request_id }).update(requestChanges);

        if (damage.damaged > 0) {
            replacements = await reopenRequest(trx, shipment.request_id, damage.damaged);
        }
        await assignWaiting(trx);
    });
    if (!done) return { errors: [ALREADY_MOVED] };

    return { row: { ...shipment, ...changes, intact, replacements } };
}

async function failDelivery(id, body) {
    body = body || {};
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'In transit') return { errors: ['Only shipments in transit can be marked as failed'] };
    const reason = cleanText(body.reason);
    if (!reason) return { errors: ['Give a reason'] };

    const onBoard = shipment.quantity - shipment.quantity_damaged;
    const damage = readDamage(body, onBoard);
    if (damage.error) return { errors: [damage.error] };

    const [notes, incident, request] = await Promise.all([
        prepareNotes([
            { kind: 'failure', stage: 'When delivery failed', text: reason },
            { kind: 'damage', stage: 'When delivery failed', text: damage.note },
        ]),
        classifyFailure(reason),
        knex('requests').where({ request_id: shipment.request_id }).first(),
    ]);

    const changes = {
        status: 'Returning',
        quantity_damaged: shipment.quantity_damaged + damage.damaged,
        damage_note: addNote(shipment.damage_note, 'When delivery failed', englishOf(notes, 'damage')),
        failure_reason: englishOf(notes, 'failure'),
    };

    let replacements = [];
    const done = await inTransaction(async (trx) => {
        await moveShipment(trx, id, 'In transit', changes);
        await saveNotes(trx, id, notes);
        await trx('incidents').insert({
            ...incident,
            shipment_id: id,
            shelter_id: request ? request.shelter_id : null,
            warehouse_id: shipment.warehouse_id,
            driver_id: shipment.driver_id,
        });
        replacements = await reopenRequest(trx, shipment.request_id, onBoard);
        await assignWaiting(trx);
    });
    if (!done) return { errors: [ALREADY_MOVED] };

    return { row: { ...shipment, ...changes, replacements } };
}

async function returnToWarehouse(id, body) {
    body = body || {};
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'Returning') return { errors: ['Only shipments heading back to the warehouse can be dropped off there'] };

    const onBoard = shipment.quantity - shipment.quantity_damaged;
    const damage = readDamage(body, onBoard);
    if (damage.error) return { errors: [damage.error] };

    const notes = await prepareNotes([{ kind: 'damage', stage: 'Back at warehouse', text: damage.note }]);

    const returned = onBoard - damage.damaged;
    const changes = {
        status: 'Returned',
        returned_at: new Date().toISOString(),
        quantity_damaged: shipment.quantity_damaged + damage.damaged,
        damage_note: addNote(shipment.damage_note, 'Back at warehouse', englishOf(notes, 'damage')),
    };

    let replacements = [];
    const done = await inTransaction(async (trx) => {
        await moveShipment(trx, id, 'Returning', changes);
        await saveNotes(trx, id, notes);
        if (returned > 0) {
            await addToStock(trx, shipment.warehouse_id, shipment.item, returned);
            replacements = await sendToWaiting(trx, shipment.item);
        }
        await assignWaiting(trx);
    });
    if (!done) return { errors: [ALREADY_MOVED] };

    return { row: { ...shipment, ...changes, returned, replacements } };
}

module.exports = { listShipments, assignDriver, pickUp, deliver, failDelivery, returnToWarehouse };
