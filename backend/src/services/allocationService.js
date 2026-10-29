const knex = require('../db');
const { allocate } = require('../engine/allocate');

async function runAllocation() {
    return knex.transaction(async(trx) => {

        const shelters = await trx('shelters');
        const inventory = await trx('inventory');
        const requests = await trx('requests');

        const { results, stock } = allocate(requests, shelters, inventory);

        const count = (s) => results.filter((r) => r.status === s).length;
        return {
            fulfilled: count('Fulfilled'),
            partial: count('Partial'),
            unfulfilled: count("Unfulfilled"),
        };
    });
}

module.exports = { runAllocation };