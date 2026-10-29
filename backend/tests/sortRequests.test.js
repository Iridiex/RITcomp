const { sortRequests } = require('../src/engine/allocate');
const { orderWarehouses } = require('../src/engine/allocate');

test('same urgency: higher-priority shelter goes first', () => {
    const shelters = [
        { shelter_id: 'SH-A', priority: 3 },
        { shelter_id: 'SH-B', priority: 1 },
    ];
    const requests = [
        { request_id: 'RQ-001', shelter_id: 'SH-A', urgency: 'Critical', created_at: '2026-10-29T10:00:00' },
        { request_id: 'RQ-002', shelter_id: 'SH-B', urgency: 'Critical', created_at: '2026-10-29T11:00:00' },
    ];

    const result = sortRequests(requests, shelters);

    expect(result[0].request_id).toEqual('RQ-002');
});

test('Critical comes before High', () => {
    const shelters = [
        { shelter_id: 'SH-A', priority: 3 },
        { shelter_id: 'SH-B', priority: 1 },
    ];
    const requests = [
        { request_id: 'RQ-001', shelter_id: 'SH-A', urgency: 'High', created_at: '2026-10-29T10:00:00' },
        { request_id: 'RQ-002', shelter_id: 'SH-B', urgency: 'Critical', created_at: '2026-10-29T11:00:00' },
    ];
    const result = sortRequests(requests, shelters);

    expect(result[0].request_id).toEqual('RQ-002');
});

test('orderWarehouses: only this item, no empty rows, most stock first', () => {
    const inventory = [
        { warehouse_id: 'WH-1', item: 'water', quantity: 150 },
        { warehouse_id: 'WH-2', item: 'water', quantity: 300 },
        { warehouse_id: 'WH-3', item: 'water', quantity: 0 },
        { warehouse_id: 'WH-1', item: 'blankets', quantity: 60 },
    ];

    const result = orderWarehouses(inventory, 'water');

    expect(result.map((r) => r.warehouse_id)).toEqual(['WH-2', 'WH-1']);
});