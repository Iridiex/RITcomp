const knex = require('../db');
const { validateStock } = require('../validation');

async function addStock(body) {
    const warehouses = await knex('warehouses').select('warehouse_id');
    const errors = validateStock(body, warehouses.map((w) => w.warehouse_id));
    if (errors.length > 0) { return { errors }; }

    const item = body.item.trim().toLowerCase();
    const quantity = Number(body.quantity);
    const existing = await knex('inventory').where({ warehouse_id: body.warehouse_id, item }).first();

    if (existing) {
        const newQuantity = existing.quantity + quantity;
        await knex('inventory').where({ id: existing.id }).update({ quantity: newQuantity });
        return { row: { ...existing, quantity: newQuantity } };
    }
    const [id] = await knex('inventory').insert({ warehouse_id: body.warehouse_id, item, quantity });
    return { row: { id, warehouse_id: body.warehouse_id, item, quantity } };
}

module.exports = { addStock };
