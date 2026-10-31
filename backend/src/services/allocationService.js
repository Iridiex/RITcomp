const knex = require('../db');
const { allocate } = require('../engine/allocate');
const { splitLoad } = require('../capacity');

const ACTIVE = ['Ready', 'In transit', 'Returning'];

async function driverLoads(trx) {
    const drivers = await trx('drivers').orderBy('driver_id');
    const active = await trx('shipments').whereIn('status', ACTIVE).select('driver_id');
    return drivers.map((d) => ({
        driver_id: d.driver_id,
        load: active.filter((s) => s.driver_id === d.driver_id).length,
    }));
}

// `avoid` is a preference (falls back to anyone); `exclude` is strict (no driver rather than one of these)
function leastBusy(allLoads, avoid = new Set(), exclude = new Set()) {
    const eligible = allLoads.filter((d) => !exclude.has(d.driver_id));
    const preferred = eligible.filter((d) => !avoid.has(d.driver_id));
    const loads = preferred.length > 0 ? preferred : eligible;
    if (loads.length === 0) return null;
    const pick = loads.reduce((best, d) =>
        d.load < best.load || (d.load === best.load && d.driver_id < best.driver_id) ? d : best
    );
    pick.load += 1;
    return pick.driver_id;
}

async function nextShipmentNumber(trx) {
    const rows = await trx('shipments').select('shipment_id');
    return Math.max(0, ...rows.map((s) => Number(s.shipment_id.replace('SHP-', '')) || 0)) + 1;
}

async function failedDriversByRequest(trx) {
    const rows = await trx('shipments')
        .whereIn('status', ['Returning', 'Returned'])
        .whereNotNull('driver_id')
        .select('request_id', 'driver_id');
    const byRequest = new Map();
    for (const row of rows) {
        if (!byRequest.has(row.request_id)) byRequest.set(row.request_id, new Set());
        byRequest.get(row.request_id).add(row.driver_id);
    }
    return byRequest;
}

async function dispatch(trx, requests, runId) {
    const shelters = await trx('shelters');
    const inventory = await trx('inventory');
    const { results, stock } = allocate(requests, shelters, inventory);
    const failedDrivers = await failedDriversByRequest(trx);

    for (const row of stock) {
        const before = inventory.find((i) => i.id === row.id);
        if (before.quantity !== row.quantity) {
            await trx('inventory').where({ id: row.id }).update({ quantity: row.quantity });
        }
    }

    const loads = await driverLoads(trx);
    let nextNumber = await nextShipmentNumber(trx);
    const shipments = [];

    for (const r of results) {
        const request = requests.find((q) => q.request_id === r.request_id);
        const covered = r.quantity_allocated >= request.quantity;

        await trx('requests').where({ request_id: r.request_id }).update({
            status: r.status,
            quantity_allocated: r.quantity_allocated,
            replacement_pending: covered ? false : Boolean(request.replacement_pending),
        });

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

            const carrying = new Set();
            const avoid = failedDrivers.get(r.request_id);
            for (const quantity of splitLoad(t.quantity)) {
                const driverId = leastBusy(loads, avoid, carrying);
                if (driverId) carrying.add(driverId);
                const shipment = {
                    shipment_id: 'SHP-' + String(nextNumber).padStart(3, '0'),
                    run_id: runId,
                    request_id: r.request_id,
                    warehouse_id: t.warehouse_id,
                    item: request.item,
                    quantity,
                    status: 'Ready',
                    driver_id: driverId,
                };
                await trx('shipments').insert(shipment);
                shipments.push(shipment);
                nextNumber += 1;
            }
        }
    }

    return { results, shipments };
}

async function assignWaiting(trx) {
    const waiting = await trx('shipments').where({ status: 'Ready' }).whereNull('driver_id').orderBy('shipment_id');
    if (waiting.length === 0) return [];
    const loads = await driverLoads(trx);
    const failedDrivers = await failedDriversByRequest(trx);
    const assigned = [];
    for (const s of waiting) {
        const siblings = await trx('shipments')
            .where({ run_id: s.run_id, request_id: s.request_id, warehouse_id: s.warehouse_id })
            .whereIn('status', ['Ready', 'In transit'])
            .whereNotNull('driver_id')
            .pluck('driver_id');
        const driverId = leastBusy(loads, failedDrivers.get(s.request_id), new Set(siblings));
        if (!driverId) continue;
        await trx('shipments').where({ shipment_id: s.shipment_id }).update({ driver_id: driverId });
        assigned.push({ shipment_id: s.shipment_id, driver_id: driverId });
    }
    return assigned;
}

async function runAllocation() {
    return knex.transaction(async (trx) => {
        const requests = await trx('requests');
        const { results, shipments } = await dispatch(trx, requests, `RUN-${Date.now()}`);
        const count = (s) => results.filter((r) => r.status === s).length;
        return {
            allocated: count('Allocated'),
            partial: count('Partial'),
            unfulfilled: count('Unfulfilled'),
            shipments: shipments.length,
            drivers: new Set(shipments.map((s) => s.driver_id).filter(Boolean)).size,
        };
    });
}

async function listShortages() {
    const rows = await knex('requests').whereIn('status', ['Partial', 'Unfulfilled']);
    const byItem = new Map();
    for (const r of rows) {
        const entry = byItem.get(r.item) || { item: r.item, short: 0, requests: 0, critical: 0 };
        entry.short += r.quantity - r.quantity_allocated;
        entry.requests += 1;
        if (r.urgency === 'Critical') entry.critical += 1;
        byItem.set(r.item, entry);
    }
    return [...byItem.values()].sort((a, b) => b.critical - a.critical || b.short - a.short);
}

module.exports = { runAllocation, dispatch, assignWaiting, listShortages, ACTIVE };
