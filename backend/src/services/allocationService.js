const knex = require('../db');
const { allocate } = require('../engine/allocate');

async function runAllocation() {
    return knex.transaction(async(trx) => {

        const shelters = await trx('shelters');
        const inventory = await trx('inventory');
        const requests = await trx('requests');

        const { results, stock } = allocate(requests, shelters, inventory);

        const runId = `RUN-${Date.now()}`;

        for (const row of stock) {
            await trx('inventory')
                .where({ id: row.id })
                .update({ quantity: row.quantity });
        }

        for (const r of results) {
            await trx('requests')
                .where({ request_id: r.request_id })
                .update({ status: r.status, quantity_allocated: r.quantity_allocated });
        }

        for (const r of results) {
            if (r.takes.length === 0) {
                await trx('allocation_log').insert({
                    run_id: runId,
                    request_id: r.request_id,
                    warehouse_id: null,
                    quantity_sent: 0,
                    result: r.status,
                    reason: r.reason,
                });
            }
            for (const t of r.takes) {
                await trx('allocation_log').insert({
                    run_id: runId,
                    request_id: r.request_id,
                    warehouse_id: t.warehouse_id,
                    quantity_sent: t.quantity,
                    result: r.status,
                    reason: r.reason,
                });
            }
        }

        const count = (s) => results.filter((r) => r.status === s).length;
        return {
            runId,
            fulfilled: count('Fulfilled'),
            partial: count('Partial'),
            unfulfilled: count('Unfulfilled'),
        };
    });
}



module.exports = { runAllocation };