const request = require('supertest');
const app = require('../src/app');
const { AUTH, warehouseAuth } = require('./helpers/auth');
const knex = require('../src/db');

const WH1 = warehouseAuth('WH-1');
const act = (id, action, body = {}) =>
    request(app).patch(`/api/shipments/${id}/${action}`).set('Authorization', AUTH).send(body);
const shipment = (id) => knex('shipments').where({ shipment_id: id }).first();
const req = (id) => knex('requests').where({ request_id: id }).first();
const stockOf = async (item) => (await knex('inventory').where({ warehouse_id: 'WH-1', item }).first()).quantity;

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert([
        { warehouse_id: 'WH-1', item: 'water', quantity: 50 },
        { warehouse_id: 'WH-1', item: 'blankets', quantity: 30 },
        { warehouse_id: 'WH-1', item: 'food', quantity: 60 },
    ]);
    await knex('drivers').insert([{ driver_id: 'DR-1', name: 'One' }, { driver_id: 'DR-2', name: 'Two' }, { driver_id: 'DR-3', name: 'Three' }]);
    await knex('requests').insert([
        { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 50, urgency: 'Critical' },
        { request_id: 'RQ-002', shelter_id: 'SH-01', item: 'blankets', quantity: 30, urgency: 'Critical' },
        { request_id: 'RQ-003', shelter_id: 'SH-01', item: 'food', quantity: 40, urgency: 'Critical' },
    ]);
    await request(app).post('/api/allocations/run').set('Authorization', AUTH);
});

afterAll(async () => {
    await knex.destroy();
});

test('goods brought back after a failed delivery go straight to the shelter still waiting for them', async () => {
    expect((await shipment('SHP-001')).driver_id).toBe('DR-1');
    await act('SHP-001', 'pickup');
    const failed = await act('SHP-001', 'fail', { reason: 'Road flooded' });
    expect(failed.body.replacements).toEqual([]);
    expect((await req('RQ-001')).status).toBe('Unfulfilled');

    const back = await act('SHP-001', 'return', { damaged: 10, damage_note: 'Crushed on the way back' });
    expect(back.status).toBe(200);
    expect(back.body.replacements).toHaveLength(1);

    const replacement = await shipment(back.body.replacements[0]);
    expect(replacement.quantity).toBe(40);
    expect(replacement.driver_id).not.toBe('DR-1');
    expect(await stockOf('water')).toBe(0);
    expect(await req('RQ-001')).toMatchObject({ status: 'Partial', quantity_allocated: 40, replacement_pending: 1 });
});

test('items damaged on arrival are replaced when the warehouse restocks, then the request completes', async () => {
    await act('SHP-002', 'pickup');
    const delivered = await act('SHP-002', 'deliver', { damaged: 5, damage_note: 'Torn' });
    expect(delivered.body.replacements).toEqual([]);
    expect(await req('RQ-002')).toMatchObject({ status: 'Partial', quantity_allocated: 25, quantity_delivered: 25 });

    const restock = await request(app).post('/api/inventory').set('Authorization', WH1)
        .send({ item: 'blankets', quantity: 10 });
    expect(restock.body.replacements).toHaveLength(1);
    const replacement = await shipment(restock.body.replacements[0]);
    expect(replacement.quantity).toBe(5);
    expect(await stockOf('blankets')).toBe(5);

    await act(replacement.shipment_id, 'pickup');
    await act(replacement.shipment_id, 'deliver');
    expect(await req('RQ-002')).toMatchObject({ status: 'Fulfilled', quantity_delivered: 30, replacement_pending: 0 });
});

test('items damaged at pickup are replaced straight away from spare stock', async () => {
    const res = await act('SHP-003', 'pickup', { damaged: 10, damage_note: 'Wet boxes' });
    expect(res.body.replacements).toHaveLength(1);
    expect((await shipment(res.body.replacements[0])).quantity).toBe(10);
    expect(await stockOf('food')).toBe(10);

    await act('SHP-003', 'deliver');
    await act(res.body.replacements[0], 'pickup');
    await act(res.body.replacements[0], 'deliver');
    expect(await req('RQ-003')).toMatchObject({ status: 'Fulfilled', quantity_delivered: 40 });
});

test('a restock never hands the job back to the driver who could not deliver it', async () => {
    await knex('requests').insert({ request_id: 'RQ-004', shelter_id: 'SH-01', item: 'soap', quantity: 20, urgency: 'High', status: 'Unfulfilled' });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'soap', quantity: 20 });
    await request(app).post('/api/allocations/run').set('Authorization', AUTH);
    const first = await knex('shipments').where({ request_id: 'RQ-004' }).first();
    await act(first.shipment_id, 'pickup');
    await act(first.shipment_id, 'fail', { reason: 'Shelter closed' });
    await act(first.shipment_id, 'return', { damaged: 20, damage_note: 'All ruined' });

    const restock = await request(app).post('/api/inventory').set('Authorization', WH1).send({ item: 'soap', quantity: 20 });
    expect(restock.body.replacements).toHaveLength(1);
    expect((await shipment(restock.body.replacements[0])).driver_id).not.toBe(first.driver_id);
});
