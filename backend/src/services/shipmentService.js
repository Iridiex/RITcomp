const knex = require('../db');

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

async function assignDriver(id, body) {
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'Ready') return { errors: ['Only shipments that are Ready can be assigned'] };
    const driver = await knex('drivers').where({ driver_id: body.driver_id || '' }).first();
    if (!driver) return { errors: ['Choose a driver that exists'] };
    await knex('shipments').where({ shipment_id: id }).update({ driver_id: driver.driver_id });
    return { row: { ...shipment, driver_id: driver.driver_id } };
}

async function pickUp(id) {
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'Ready') return { errors: ['Only shipments that are Ready can be picked up'] };
    if (!shipment.driver_id) return { errors: ['Assign a driver first'] };
    const changes = { status: 'In transit', picked_up_at: new Date().toISOString() };
    await knex('shipments').where({ shipment_id: id }).update(changes);
    return { row: { ...shipment, ...changes } };
}

async function deliver(id, body) {
    const shipment = await findShipment(id);
    if (!shipment) return { notFound: true };
    if (shipment.status !== 'In transit') return { errors: ['Only shipments in transit can be delivered'] };

    const damaged = body.damaged === undefined || body.damaged === '' ? 0 : Number(body.damaged);
    if (!Number.isInteger(damaged) || damaged < 0 || damaged > shipment.quantity) {
        return { errors: ['Damaged must be a whole number from 0 to ' + shipment.quantity] };
    }
    if (damaged > 0 && (!body.damage_note || body.damage_note.trim() === '')) {
        return { errors: ['Describe the damage'] };
    }

    const changes = {
        status: 'Delivered',
        delivered_at: new Date().toISOString(),
        quantity_damaged: damaged,
        damage_note: damaged > 0 ? body.damage_note.trim() : null,
    };

    await knex.transaction(async (trx) => {
        await trx('shipments').where({ shipment_id: id }).update(changes);
        if (damaged > 0) {
            const request = await trx('requests').where({ request_id: shipment.request_id }).first();
            const stillSent = Math.max(0, request.quantity_allocated - damaged);
            await trx('requests').where({ request_id: shipment.request_id }).update({
                quantity_allocated: stillSent,
                status: stillSent === 0 ? 'Pending' : 'Partial',
            });
        }
    });

    return { row: { ...shipment, ...changes } };
}

module.exports = { listShipments, assignDriver, pickUp, deliver };
