const knex = require('knex')(require('../knexfile').development);
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function readCsv(fileName) {
    const filePath = path.join(__dirname, '../data/sample', fileName);
    const text = fs.readFileSync(filePath, 'utf8');
    return parse(text, { columns: true, trim: true });
}

async function main() {
    await knex('allocation_log').del();
    await knex('requests').del();
    await knex('inventory').del();
    await knex('shelters').del();

    const shelterRows = readCsv('shelters.csv');
    const shelters = shelterRows.map((row) => ({
        ...row,
        priority: Number(row.priority),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
    }));
    await knex('shelters').insert(shelters);

    const inventoryRows = readCsv('inventory.csv');
    const inventory = inventoryRows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        item: row.item.trim().toLowerCase(),
    }));
    await knex('inventory').insert(inventory);

    const requestRows = readCsv('requests.csv');
    const requests = requestRows.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        item: row.item.trim().toLowerCase(),
    }));
    await knex('requests').insert(requests);

    console.log('Database reset with sample data');
    await knex.destroy();
}

main();