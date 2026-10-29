const { allocate } = require('../src/engine/allocate');

const shelters = [
    { shelter_id: 'SH-01', priority: 1 },
    { shelter_id: 'SH-02', priority: 2 },
    { shelter_id: 'SH-03', priority: 1 },
    { shelter_id: 'SH-04', priority: 3 },
    { shelter_id: 'SH-05', priority: 2 },
];

const inventory = [
    { warehouse_id: 'WH-1', item: 'water', quantity: 300 },
    { warehouse_id: 'WH-1', item: 'food packs', quantity: 200 },
    { warehouse_id: 'WH-1', item: 'blankets', quantity: 60 },
    { warehouse_id: 'WH-2', item: 'water', quantity: 150 },
    { warehouse_id: 'WH-2', item: 'food packs', quantity: 100 },
    { warehouse_id: 'WH-2', item: 'first aid kits', quantity: 20 },
];

const t = '2026-10-29T10:00:00';
const base = { status: 'Pending', quantity_allocated: 0, created_at: t };
const requests = [
    {...base, request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 200, urgency: 'Critical' },
    {...base, request_id: 'RQ-002', shelter_id: 'SH-01', item: 'first aid kits', quantity: 15, urgency: 'Critical' },
    {...base, request_id: 'RQ-003', shelter_id: 'SH-02', item: 'water', quantity: 150, urgency: 'High' },
    {...base, request_id: 'RQ-004', shelter_id: 'SH-04', item: 'food packs', quantity: 100, urgency: 'Moderate' },
    {...base, request_id: 'RQ-005', shelter_id: 'SH-04', item: 'first aid kits', quantity: 15, urgency: 'Critical' },
    {...base, request_id: 'RQ-006', shelter_id: 'SH-03', item: 'water', quantity: 200, urgency: 'Critical' },
    {...base, request_id: 'RQ-007', shelter_id: 'SH-02', item: 'blankets', quantity: 100, urgency: 'High' },
    {...base, request_id: 'RQ-008', shelter_id: 'SH-03', item: 'food packs', quantity: 150, urgency: 'High' },
    {...base, request_id: 'RQ-009', shelter_id: 'SH-05', item: 'tents', quantity: 10, urgency: 'Moderate' },
    {...base, request_id: 'RQ-010', shelter_id: 'SH-05', item: 'water', quantity: 30, urgency: 'Moderate' },
];

test('sample data gives 5 Fulfilled, 3 Partial, 2 Unfulfilled', () => {
    const { results } = allocate(requests, shelters, inventory);
    const count = (s) => results.filter((r) => r.status === s).length;

    expect(count('Fulfilled')).toEqual(5);
    expect(count('Partial')).toEqual(3);
    expect(count('Unfulfilled')).toEqual(2);
});

test('stock never goes negative', () => {
    const { stock } = allocate(requests, shelters, inventory);
    stock.forEach((row) => expect(row.quantity).toBeGreaterThanOrEqual(0));
});

test('High waits for Critical: RQ-003 only gets the 50 water left', () => {
    const { results } = allocate(requests, shelters, inventory);
    const rq3 = results.find((r) => r.request_id === 'RQ-003');
    expect(rq3.status).toEqual('Partial');
    expect(rq3.quantity_allocated).toEqual(50);
});