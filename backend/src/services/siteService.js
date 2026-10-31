const knex = require('../db');
const { validateSite, cleanText } = require('../validation');
const { ACTIVE } = require('./allocationService');
const { loginFor, checkLogin, saveLogin } = require('./userService');
const { nextId } = require('../ids');

// `history` lists every other table that keeps this site's ID
const SITES = {
    shelter: {
        table: 'shelters', idColumn: 'shelter_id', prefix: 'SH-', pad: 2, needsPriority: true,
        history: ['requests', 'users'],
    },
    warehouse: {
        table: 'warehouses', idColumn: 'warehouse_id', prefix: 'WH-', pad: 1, needsPriority: false,
        history: ['inventory', 'shipments', 'allocation_log', 'stock_movements', 'users'],
    },
};

function newSiteId(site) {
    return nextId(site.prefix, site.pad, [site.table, ...site.history].map((table) => [table, site.idColumn]));
}

function cleanSite(body, site) {
    const row = {
        name: cleanText(body.name),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
    };
    if (site.needsPriority) { row.priority = Number(body.priority); }
    return row;
}

async function createSite(kind, body) {
    body = body || {};
    const site = SITES[kind];
    const errors = [...validateSite(body, site), ...(await checkLogin(body.login, null))];
    if (errors.length > 0) { return { errors }; }

    const row = { [site.idColumn]: await newSiteId(site), ...cleanSite(body, site) };
    let username = null;
    await knex.transaction(async (trx) => {
        await trx(site.table).insert(row);
        username = await saveLogin(trx, body.login, null, { name: row.name, role: kind, [site.idColumn]: row[site.idColumn] });
    });
    return { site: { ...row, username } };
}

async function updateSite(kind, id, body) {
    body = body || {};
    const site = SITES[kind];
    const existing = await knex(site.table).where({ [site.idColumn]: id }).first();
    if (!existing) { return { notFound: true }; }
    const current = await loginFor(site.idColumn, id);
    const errors = [...validateSite(body, site), ...(await checkLogin(body.login, current))];
    if (errors.length > 0) { return { errors }; }

    const changes = cleanSite(body, site);
    let username = null;
    await knex.transaction(async (trx) => {
        await trx(site.table).where({ [site.idColumn]: id }).update(changes);
        await trx('users').where({ [site.idColumn]: id }).update({ name: changes.name });
        username = await saveLogin(trx, body.login, current, { name: changes.name, role: kind, [site.idColumn]: id });
    });
    return { site: { ...existing, ...changes, username: username || (current ? current.username : null) } };
}

async function deleteSite(kind, id) {
    const site = SITES[kind];
    const existing = await knex(site.table).where({ [site.idColumn]: id }).first();
    if (!existing) { return { notFound: true }; }

    if (kind === 'shelter') {
        const linked = await knex('requests').where({ shelter_id: id }).count({ n: '*' }).first();
        if (Number(linked.n) > 0) {
            return { errors: [id + ' has ' + linked.n + ' request(s) and cannot be deleted'] };
        }
    } else {
        const stock = await knex('inventory').where({ warehouse_id: id }).sum({ total: 'quantity' }).first();
        if (Number(stock.total) > 0) {
            return { errors: [id + ' still holds ' + stock.total + ' units of stock and cannot be deleted'] };
        }
        const open = await knex('shipments').where({ warehouse_id: id }).whereIn('status', ACTIVE).count({ n: '*' }).first();
        if (Number(open.n) > 0) {
            return { errors: [id + ' has ' + open.n + ' shipment(s) still to deliver and cannot be deleted'] };
        }
    }

    await knex.transaction(async (trx) => {
        if (kind === 'warehouse') {
            await trx('inventory').where({ warehouse_id: id }).del();
        }
        await trx('users').where({ [site.idColumn]: id }).del();
        await trx(site.table).where({ [site.idColumn]: id }).del();
    });
    return { site: existing };
}

module.exports = { createSite, updateSite, deleteSite };
