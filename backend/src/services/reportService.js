const knex = require('../db');

const PROCESSED = ['Fulfilled', 'Allocated', 'Partial', 'Unfulfilled'];

async function buildReport() {
    const requests = await knex('requests')
        .leftJoin('shelters', 'requests.shelter_id', 'shelters.shelter_id')
        .select('requests.*', 'shelters.name as shelter_name')
        .orderBy('requests.request_id');

    const rows = requests.map((r) => ({
        request_id: r.request_id,
        shelter_id: r.shelter_id,
        shelter_name: r.shelter_name,
        item: r.item,
        urgency: r.urgency,
        requested: r.quantity,
        allocated: r.quantity_allocated,
        delivered: r.quantity_delivered,
        shortfall: r.quantity - r.quantity_allocated,
        status: r.status,
        replacement_pending: Boolean(r.replacement_pending),
        note: r.review_note || '',
    }));

    const withStatus = (statuses) => rows.filter((r) => statuses.includes(r.status));
    const processed = withStatus(PROCESSED);
    const unitsRequested = processed.reduce((sum, r) => sum + r.requested, 0);
    const unitsAllocated = processed.reduce((sum, r) => sum + r.allocated, 0);
    const unitsDelivered = processed.reduce((sum, r) => sum + r.delivered, 0);

    const damagedRows = await knex('shipments')
        .leftJoin('requests', 'shipments.request_id', 'requests.request_id')
        .leftJoin('shelters', 'requests.shelter_id', 'shelters.shelter_id')
        .where('shipments.quantity_damaged', '>', 0)
        .orWhere('shipments.status', 'Returned')
        .select('shipments.*', 'shelters.name as shelter_name')
        .orderBy('shipments.shipment_id');

    const damaged = damagedRows.map((s) => ({
        shipment_id: s.shipment_id,
        request_id: s.request_id,
        shelter_name: s.shelter_name,
        item: s.item,
        damaged: s.quantity_damaged,
        status: s.status,
        note: [s.damage_note, s.failure_reason ? 'Returned: ' + s.failure_reason : null].filter(Boolean).join('; '),
    }));

    const percent = (part) => (unitsRequested === 0 ? 0 : Math.round((part / unitsRequested) * 100));

    return {
        generated_at: new Date().toISOString(),
        summary: {
            total: rows.length,
            fulfilled: withStatus(['Fulfilled']).length,
            allocated: withStatus(['Allocated']).length,
            partial: withStatus(['Partial']).length,
            unfulfilled: withStatus(['Unfulfilled']).length,
            pending: withStatus(['Pending']).length,
            awaiting_review: withStatus(['Awaiting review']).length,
            rejected: withStatus(['Rejected']).length,
            replacement_pending: rows.filter((r) => r.replacement_pending).length,
            units_requested: unitsRequested,
            units_allocated: unitsAllocated,
            units_delivered: unitsDelivered,
            units_damaged: damaged.reduce((sum, d) => sum + d.damaged, 0),
            fill_rate: percent(unitsAllocated),
            delivery_rate: percent(unitsDelivered),
        },
        fulfilled: withStatus(['Fulfilled']),
        unfulfilled: withStatus(['Partial', 'Unfulfilled']),
        open: withStatus(['Pending', 'Awaiting review', 'Allocated']),
        rejected: withStatus(['Rejected']),
        damaged,
        inventory: await knex('inventory').orderBy(['warehouse_id', 'item']),
    };
}

module.exports = { buildReport };
