const knex = require('../db');
const { dispatch } = require('./allocationService');
const { addToStock } = require('./stockService');

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
    return query;
}

async function findShipment(id) {
    return knex('shipments').where({ shipment_id: id }).first();
}

function readDamage(body, max) {
    const damaged = body.damaged === undefined || body.damaged === '' ? 0 : Number(body.damaged);
    if (!Number.isInteger(damaged) || damaged < 0 || damaged > max) {
        return { error: 'Damaged must be a whole number from 0 to ' + max };
    }
    if (damaged > 0 && (!body.damage_note || body.damage_note.trim() === '')) {
        return { error: 'Describe the damage' };
    }
    return { damaged, note: damaged > 0 ? body.damage_note.trim() : null };
}

function addNote(existing, stage, note) {
    if (!note) return existing;
    const line = stage + ': ' + note;
    return existing ? existing + '; ' + line : line;
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
    await knex('shipments').where({ shipment_id: id }).update({ driver_id: driver.driver_id });
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

    const changes = {
        status: 'In transit',
        picked_up_at: new Date().toISOString(),
        quantity_damaged: damage.damaged,
        damage_note: addNote(shipment.damage_note, 'At pickup', damage.note),
    };

    let replacements = [];
    await knex.transaction(async (trx) => {
        await trx('shipments').where({ shipment_id: id }).update(changes);
        if (damage.damaged > 0) {
            replacements = await reopenRequest(trx, shipment.request_id, damage.damaged);
        }
    });

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

    const intact = onBoard - damage.damaged;
    const changes = {
        status: 'Delivered',
        delivered_at: new Date().toISOString(),
        quantity_damaged: shipment.quantity_damaged + damage.damaged,
        damage_note: addNote(shipment.damage_note, 'On arrival', damage.note),
    };

    let replacements = [];
    await knex.transaction(async (trx) => {
        await trx('shipments').where({ shipment_id: id }).update(changes);

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
    });

    return { row: { ...shipment, ...changes, intact, replacements } };
}

async function failDelivery(id, body) {
    body = body || {};
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'In transit') return { errors: ['Only shipments in transit can be marked as failed'] };
    if (!body.reason || body.reason.trim() === '') return { errors: ['Give a reason'] };

    const onBoard = shipment.quantity - shipment.quantity_damaged;
    const damage = readDamage(body, onBoard);
    if (damage.error) return { errors: [damage.error] };

    const returned = onBoard - damage.damaged;
    const changes = {
        status: 'Returned',
        quantity_damaged: shipment.quantity_damaged + damage.damaged,
        damage_note: addNote(shipment.damage_note, 'On return', damage.note),
        failure_reason: body.reason.trim(),
    };

    let replacements = [];
    await knex.transaction(async (trx) => {
        await trx('shipments').where({ shipment_id: id }).update(changes);
        if (returned > 0) {
            await addToStock(trx, shipment.warehouse_id, shipment.item, returned);
        }
        replacements = await reopenRequest(trx, shipment.request_id, onBoard);
    });

    return { row: { ...shipment, ...changes, returned, replacements } };
}

module.exports = { listShipments, assignDriver, pickUp, deliver, failDelivery };
