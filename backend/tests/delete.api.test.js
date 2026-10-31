const request = require('supertest');
const app = require('../src/app');
const { AUTH, warehouseAuth } = require('./helpers/auth');
const knex = require('../src/db');

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert([
        { shelter_id: 'SH-01', name: 'Busy Hall', priority: 1, latitude: 25.1, longitude: 55.2 },
        { shelter_id: 'SH-02', name: 'Empty Hall', priority: 2, latitude: 25.2, longitude: 55.3 },
    ]);
    await knex('requests').insert({ request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 10, urgency: 'High' });
    await knex('warehouses').insert([
        { warehouse_id: 'WH-1', name: 'Full Depot', latitude: 25.1, longitude: 55.2 },
        { warehouse_id: 'WH-2', name: 'Empty Depot', latitude: 25.2, longitude: 55.3 },
    ]);
    await knex('inventory').insert([
        { warehouse_id: 'WH-1', item: 'water', quantity: 50 },
        { warehouse_id: 'WH-2', item: 'water', quantity: 0 },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test('a shelter with requests cannot be deleted', async () => {
    const res = await request(app).delete('/api/shelters/SH-01').set('Authorization', AUTH);
    expect(res.status).toBe(400);
    const still = await knex('shelters').where({ shelter_id: 'SH-01' }).first();
    expect(still).toBeDefined();
});

test('a shelter with no requests is deleted', async () => {
    const res = await request(app).delete('/api/shelters/SH-02').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    const gone = await knex('shelters').where({ shelter_id: 'SH-02' }).first();
    expect(gone).toBeUndefined();
});

test('a warehouse holding stock cannot be deleted', async () => {
    const res = await request(app).delete('/api/warehouses/WH-1').set('Authorization', AUTH);
    expect(res.status).toBe(400);
});

test('an empty warehouse is deleted along with its zero-stock rows', async () => {
    const res = await request(app).delete('/api/warehouses/WH-2').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    const rows = await knex('inventory').where({ warehouse_id: 'WH-2' });
    expect(rows.length).toBe(0);
});

test('deleting something that does not exist gives 404', async () => {
    const res = await request(app).delete('/api/shelters/SH-99').set('Authorization', AUTH);
    expect(res.status).toBe(404);
});
