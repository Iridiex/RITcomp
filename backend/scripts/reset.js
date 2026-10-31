const bcrypt = require('bcryptjs');
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
    await knex('shipments').del();
    await knex('allocation_log').del();
    await knex('requests').del();
    await knex('inventory').del();
    await knex('shelters').del();
    await knex('warehouses').del();
    await knex('drivers').del();
    await knex('users').del();
    await knex('stock_movements').del();

    const shelters = readCsv('shelters.csv').map((row) => ({
        ...row,
        priority: Number(row.priority),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
    }));
    await knex('shelters').insert(shelters);

    const warehouses = readCsv('warehouses.csv').map((row) => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
    }));
    await knex('warehouses').insert(warehouses);

    await knex('drivers').insert(readCsv('drivers.csv'));

    const users = readCsv('users.csv').map((row) => ({
        username: row.username.toLowerCase(),
        password_hash: bcrypt.hashSync(row.password, 10),
        name: row.name,
        role: row.role,
        shelter_id: row.shelter_id || null,
        warehouse_id: row.warehouse_id || null,
        driver_id: row.driver_id || null,
    }));
    await knex('users').insert(users);

    const inventory = readCsv('inventory.csv').map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        item: row.item.trim().toLowerCase(),
    }));
    await knex('inventory').insert(inventory);

    const requests = readCsv('requests.csv').map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        item: row.item.trim().toLowerCase(),
    }));
    await knex('requests').insert(requests);

    console.log('Database reset with sample data');
    await knex.destroy();
}

main();
