const knex = require('../db');
const { allocate } = require('../engine/allocate');

const ACTIVE = ['Ready', 'In transit'];

async function driverLoads(trx) {
    const drivers = await trx('drivers').orderBy('driver_id');
    const active = await trx('shipments').whereIn('status', ACTIVE).select('driver_id');
    return drivers.map((d) => ({
        driver_id: d.driver_id,
        load: active.filter((s) => s.driver_id === d.driver_id).length,
    }));
}

function leastBusy(loads) {
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

async function dispatch(trx, requests, runId) {
    const shelters = await trx('shelters');
    const inventory = await trx('inventory');
    const { results, stock } = allocate(requests, shelters, inventory);

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

            const shipment = {
                shipment_id: 'SHP-' + String(nextNumber).padStart(3, '0'),
                run_id: runId,
                request_id: r.request_id,
                warehouse_id: t.warehouse_id,
                item: request.item,
                quantity: t.quantity,
                status: 'Ready',
                driver_id: leastBusy(loads),
            };
            await trx('shipments').insert(shipment);
            shipments.push(shipment);
            nextNumber += 1;
        }
    }

    return { results, shipments };
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

module.exports = { runAllocation, dispatch };
