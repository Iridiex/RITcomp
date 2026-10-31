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
        { warehouse_id: 'WH-3', name: 'Dispatching Depot', latitude: 25.3, longitude: 55.4 },
    ]);
    await knex('inventory').insert([
        { warehouse_id: 'WH-1', item: 'water', quantity: 50 },
        { warehouse_id: 'WH-2', item: 'water', quantity: 0 },
        { warehouse_id: 'WH-3', item: 'water', quantity: 0 },
    ]);
    await knex('shipments').insert({
        shipment_id: 'SHP-001', run_id: 'RUN-1', request_id: 'RQ-001', warehouse_id: 'WH-3',
        item: 'water', quantity: 10, status: 'In transit',
    });
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

test('a warehouse with shipments still on the road cannot be deleted', async () => {
    const res = await request(app).delete('/api/warehouses/WH-3').set('Authorization', AUTH);
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('WH-3 has 1 shipment(s) still to deliver and cannot be deleted');
});

test("a deleted warehouse's ID is never reused, so its history stays its own", async () => {
    const created = await request(app).post('/api/warehouses').set('Authorization', AUTH)
        .send({ name: 'Short-lived Depot', latitude: 25.1, longitude: 55.2 });
    const id = created.body.warehouse_id;
    expect(id).toBe('WH-4');

    const auth = warehouseAuth(id);
    await request(app).post('/api/inventory').set('Authorization', auth).send({ item: 'tents', quantity: 5 });
    await request(app).post('/api/inventory/remove').set('Authorization', auth).send({ item: 'tents', quantity: 5, reason: 'Moved out' });
    expect((await request(app).delete('/api/warehouses/' + id).set('Authorization', AUTH)).status).toBe(200);

    const next = await request(app).post('/api/warehouses').set('Authorization', AUTH)
        .send({ name: 'Brand New Depot', latitude: 25.1, longitude: 55.2 });
    expect(next.body.warehouse_id).toBe('WH-5');
});

test('deleting something that does not exist gives 404', async () => {
    const res = await request(app).delete('/api/shelters/SH-99').set('Authorization', AUTH);
    expect(res.status).toBe(404);
});
