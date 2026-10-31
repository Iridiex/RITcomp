const knex = require('../db');
const { validateDriver, cleanText } = require('../validation');
const { loginFor, checkLogin, saveLogin } = require('./userService');
const { nextId } = require('../ids');
const { assignWaiting } = require('./allocationService');

const HISTORY = [['drivers', 'driver_id'], ['shipments', 'driver_id'], ['users', 'driver_id']];

function cleanDriver(body) {
    return { name: cleanText(body.name), phone: cleanText(body.phone) || null };
}

async function createDriver(body) {
    body = body || {};
    const errors = [...validateDriver(body), ...(await checkLogin(body.login, null))];
    if (errors.length > 0) { return { errors }; }

    const row = { driver_id: await nextId('DR-', 1, HISTORY), ...cleanDriver(body) };
    let username = null;
    let assigned = [];
    await knex.transaction(async (trx) => {
        await trx('drivers').insert(row);
        username = await saveLogin(trx, body.login, null, { name: row.name, role: 'driver', driver_id: row.driver_id });
        assigned = await assignWaiting(trx);
    });
    return { row: { ...row, username, assigned } };
}

async function updateDriver(id, body) {
    body = body || {};
    const existing = await knex('drivers').where({ driver_id: id }).first();
    if (!existing) { return { notFound: true }; }
    const current = await loginFor('driver_id', id);
    const errors = [...validateDriver(body), ...(await checkLogin(body.login, current))];
    if (errors.length > 0) { return { errors }; }

    const changes = cleanDriver(body);
    let username = null;
    await knex.transaction(async (trx) => {
        await trx('drivers').where({ driver_id: id }).update(changes);
        await trx('users').where({ driver_id: id }).update({ name: changes.name });
        username = await saveLogin(trx, body.login, current, { name: changes.name, role: 'driver', driver_id: id });
    });
    return { row: { ...existing, ...changes, username: username || (current ? current.username : null) } };
}

// Like shelters with requests, a driver with delivery history is kept so that history stays readable
async function deleteDriver(id) {
    const existing = await knex('drivers').where({ driver_id: id }).first();
    if (!existing) { return { notFound: true }; }
    const linked = await knex('shipments').where({ driver_id: id }).count({ n: '*' }).first();
    if (Number(linked.n) > 0) {
        return { errors: [id + ' has ' + linked.n + ' shipment(s) on record and cannot be deleted'] };
    }
    await knex.transaction(async (trx) => {
        await trx('users').where({ driver_id: id }).del();
        await trx('drivers').where({ driver_id: id }).del();
    });
    return { row: existing };
}

module.exports = { createDriver, updateDriver, deleteDriver };
