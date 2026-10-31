const knex = require('./db');

// Next free ID such as SH-07. `sources` are [table, column] pairs that can still hold
// the IDs of deleted records, so an ID that was ever used is never handed out again.
async function nextId(prefix, pad, sources) {
    const numbers = [];
    for (const [table, column] of sources) {
        const rows = await knex(table).distinct(column).whereNotNull(column);
        rows.forEach((r) => numbers.push(Number(String(r[column]).replace(prefix, '')) || 0));
    }
    return prefix + String(Math.max(0, ...numbers) + 1).padStart(pad, '0');
}

module.exports = { nextId };
