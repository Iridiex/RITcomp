const request = require('supertest');
const app = require('../src/app');
const { AUTH, warehouseAuth } = require('./helpers/auth');
const knex = require('../src/db');

const getRequest = (id) => knex('requests').where({ request_id: id }).first();

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Test Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Test Depot', latitude: 25.2, longitude: 55.3 });
    await knex('drivers').insert({ driver_id: 'DR-1', name: 'Test Driver', phone: '050-000-0000' });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'blankets', quantity: 60 });
    await knex('requests').insert([
        { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'blankets', quantity: 100, urgency: 'High' },
        { request_id: 'RQ-002', shelter_id: 'SH-01', item: 'tents', quantity: 10, urgency: 'Moderate' },
    ]);
    await request(app).post('/api/allocations/run').set('Authorization', AUTH);
});

afterAll(async () => {
    await knex.destroy();
});

test('before new stock: blankets Partial, tents Unfulfilled', async () => {
    expect((await getRequest('RQ-001')).status).toBe('Partial');
    expect((await getRequest('RQ-002')).status).toBe('Unfulfilled');
});

test('adding blankets sends the missing 40 straight away', async () => {
    const res = await request(app).post('/api/inventory').set('Authorization', warehouseAuth('WH-1')).send({ warehouse_id: 'WH-1', item: 'blankets', quantity: 40 });
    expect(res.body.replacements.length).toBe(1);
    const saved = await getRequest('RQ-001');
    expect(saved.status).toBe('Allocated');
    expect(saved.quantity_allocated).toBe(100);
});

test('adding tents fills the Unfulfilled request', async () => {
    await request(app).post('/api/inventory').set('Authorization', warehouseAuth('WH-1')).send({ warehouse_id: 'WH-1', item: 'tents', quantity: 10 });
    expect((await getRequest('RQ-002')).status).toBe('Allocated');
});

test('stock added beyond what is owed stays in the warehouse', async () => {
    await request(app).post('/api/inventory').set('Authorization', warehouseAuth('WH-1')).send({ warehouse_id: 'WH-1', item: 'blankets', quantity: 25 });
    const row = await knex('inventory').where({ warehouse_id: 'WH-1', item: 'blankets' }).first();
    expect(row.quantity).toBe(25);
});
