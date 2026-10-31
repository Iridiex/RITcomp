export const CAPACITY = 200;
export const GRACE = 10;

export function isOverCapacity(quantity) {
    return Number(quantity) > CAPACITY;
}

// Parts of one split load share a run, request and warehouse.
export function partOf(shipment, shipments) {
    const parts = shipments.filter((s) =>
        s.run_id === shipment.run_id && s.request_id === shipment.request_id && s.warehouse_id === shipment.warehouse_id
    );
    if (parts.length < 2) return null;
    return { index: parts.findIndex((s) => s.shipment_id === shipment.shipment_id) + 1, total: parts.length };
}
