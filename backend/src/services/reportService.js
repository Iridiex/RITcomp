const knex = require('../db');

const PROCESSED = ['Fulfilled', 'Partial', 'Unfulfilled'];

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
        shortfall: r.quantity - r.quantity_allocated,
        status: r.status,
        note: r.review_note || '',
    }));

    const withStatus = (statuses) => rows.filter((r) => statuses.includes(r.status));
    const processed = withStatus(PROCESSED);
    const unitsRequested = processed.reduce((sum, r) => sum + r.requested, 0);
    const unitsAllocated = processed.reduce((sum, r) => sum + r.allocated, 0);

    return {
        generated_at: new Date().toISOString(),
        summary: {
            total: rows.length,
            fulfilled: withStatus(['Fulfilled']).length,
            partial: withStatus(['Partial']).length,
            unfulfilled: withStatus(['Unfulfilled']).length,
            pending: withStatus(['Pending']).length,
            awaiting_review: withStatus(['Awaiting review']).length,
            rejected: withStatus(['Rejected']).length,
            units_requested: unitsRequested,
            units_allocated: unitsAllocated,
            fill_rate: unitsRequested === 0 ? 0 : Math.round((unitsAllocated / unitsRequested) * 100),
        },
        fulfilled: withStatus(['Fulfilled']),
        unfulfilled: withStatus(['Partial', 'Unfulfilled']),
        open: withStatus(['Pending', 'Awaiting review']),
        rejected: withStatus(['Rejected']),
        inventory: await knex('inventory').orderBy(['warehouse_id', 'item']),
    };
}

module.exports = { buildReport };
