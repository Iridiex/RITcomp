const knex = require('../db');
const { validateSite } = require('../validation');

const SITES = {
    shelter: { table: 'shelters', idColumn: 'shelter_id', prefix: 'SH-', pad: 2, needsPriority: true },
    warehouse: { table: 'warehouses', idColumn: 'warehouse_id', prefix: 'WH-', pad: 1, needsPriority: false },
};

async function nextId(site) {
    const rows = await knex(site.table).select(site.idColumn);
    const numbers = rows.map((r) => Number(r[site.idColumn].replace(site.prefix, '')) || 0);
    const next = Math.max(0, ...numbers) + 1;
    return site.prefix + String(next).padStart(site.pad, '0');
}

function cleanSite(body, site) {
    const row = {
        name: body.name.trim(),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
    };
    if (site.needsPriority) { row.priority = Number(body.priority); }
    return row;
}

async function createSite(kind, body) {
    const site = SITES[kind];
    const errors = validateSite(body, site);
    if (errors.length > 0) { return { errors }; }
    const row = { [site.idColumn]: await nextId(site), ...cleanSite(body, site) };
    await knex(site.table).insert(row);
    return { site: row };
}

async function updateSite(kind, id, body) {
    const site = SITES[kind];
    const existing = await knex(site.table).where({ [site.idColumn]: id }).first();
    if (!existing) { return { notFound: true }; }
    const errors = validateSite(body, site);
    if (errors.length > 0) { return { errors }; }
    const changes = cleanSite(body, site);
    await knex(site.table).where({ [site.idColumn]: id }).update(changes);
    return { site: { ...existing, ...changes } };
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
    }

    await knex.transaction(async (trx) => {
        if (kind === 'warehouse') {
            await trx('inventory').where({ warehouse_id: id }).del();
        }
        await trx(site.table).where({ [site.idColumn]: id }).del();
    });
    return { site: existing };
}

module.exports = { createSite, updateSite, deleteSite };
