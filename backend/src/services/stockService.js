const knex = require('../db');
const { validateStock } = require('../validation');
const { dispatch } = require('./allocationService');

async function logMovement(trx, warehouseId, item, change, reason, byName) {
    await trx('stock_movements').insert({
        warehouse_id: warehouseId,
        item,
        change,
        reason,
        by_name: byName || null,
    });
}

async function addToStock(trx, warehouseId, item, quantity, reason = 'Returned from a failed delivery', byName = null) {
    const existing = await trx('inventory').where({ warehouse_id: warehouseId, item }).first();
    let id;
    if (existing) {
        await trx('inventory').where({ id: existing.id }).update({ quantity: existing.quantity + quantity });
        id = existing.id;
    } else {
        [id] = await trx('inventory').insert({ warehouse_id: warehouseId, item, quantity });
    }
    await logMovement(trx, warehouseId, item, quantity, reason, byName);
    return id;
}

async function addStock(body) {
    const warehouses = await knex('warehouses').select('warehouse_id');
    const errors = validateStock(body, warehouses.map((w) => w.warehouse_id));
    if (errors.length > 0) {
        return { errors };
    }

    const item = body.item.trim().toLowerCase();
    const reason = (body.reason && body.reason.trim()) || 'Stock received';

    return knex.transaction(async (trx) => {
        const id = await addToStock(trx, body.warehouse_id, item, Number(body.quantity), reason, body.by_name);

        let replacements = [];
        const waiting = await trx('requests').where({ item }).whereIn('status', ['Partial', 'Unfulfilled']);
        if (waiting.length > 0) {
            const result = await dispatch(trx, waiting, `REPLACE-${Date.now()}`);
            replacements = result.shipments.map((s) => s.shipment_id);
        }

        const row = await trx('inventory').where({ id }).first();
        return { row: { ...row, replacements } };
    });
}

async function removeStock(body) {
    const errors = [];
    const item = body.item ? String(body.item).trim().toLowerCase() : '';
    const quantity = Number(body.quantity);
    const row = item ? await knex('inventory').where({ warehouse_id: body.warehouse_id, item }).first() : null;

    if (!item) {
        errors.push('Choose an item');
    } else if (!row) {
        errors.push(`${body.warehouse_id} has no ${item}`);
    }
    if (!(Number.isInteger(quantity) && quantity > 0)) {
        errors.push('Quantity must be a whole number above 0');
    } else if (row && quantity > row.quantity) {
        errors.push(`Only ${row.quantity} ${item} in stock`);
    }
    if (!body.reason || String(body.reason).trim() === '') {
        errors.push('Give a reason for removing stock');
    }
    if (errors.length > 0) {
        return { errors };
    }

    return knex.transaction(async (trx) => {
        const newQuantity = row.quantity - quantity;
        await trx('inventory').where({ id: row.id }).update({ quantity: newQuantity });
        await logMovement(trx, body.warehouse_id, item, -quantity, String(body.reason).trim(), body.by_name);
        return { row: { ...row, quantity: newQuantity } };
    });
}

async function listMovements(warehouseId) {
    const query = knex('stock_movements').orderBy('id', 'desc');
    if (warehouseId) {
        query.where({ warehouse_id: warehouseId });
    }
    return query;
}

module.exports = { addStock, addToStock, removeStock, listMovements };
