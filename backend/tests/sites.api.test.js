const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');

beforeAll(async () => {
    await knex.migrate.latest();
});

afterAll(async () => {
    await knex.destroy();
});

test('register a shelter gets the next ID', async () => {
    const res = await request(app).post('/api/shelters')
        .send({ name: ' Karama Hall ', priority: 1, latitude: 25.24, longitude: 55.30 });
    expect(res.status).toBe(201);
    expect(res.body.shelter_id).toBe('SH-01');
    expect(res.body.name).toBe('Karama Hall');
});

test('shelter without a location or valid priority is refused', async () => {
    const res = await request(app).post('/api/shelters').send({ name: 'No Pin', priority: 7 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Pick a location on the map');
    expect(res.body.errors).toContain('Priority must be 1, 2 or 3');
});

test('editing a shelter moves its pin', async () => {
    const res = await request(app).patch('/api/shelters/SH-01')
        .send({ name: 'Karama Hall', priority: 2, latitude: 25.25, longitude: 55.31 });
    expect(res.status).toBe(200);
    const saved = await knex('shelters').where({ shelter_id: 'SH-01' }).first();
    expect(Number(saved.latitude)).toBe(25.25);
    expect(saved.priority).toBe(2);
});

test('editing a shelter that does not exist gives 404', async () => {
    const res = await request(app).patch('/api/shelters/SH-99')
        .send({ name: 'X', priority: 1, latitude: 25, longitude: 55 });
    expect(res.status).toBe(404);
});

test('register a warehouse, then adding stock twice merges into one row', async () => {
    const wh = await request(app).post('/api/warehouses')
        .send({ name: 'Test Depot', latitude: 25.1, longitude: 55.2 });
    expect(wh.body.warehouse_id).toBe('WH-1');

    await request(app).post('/api/inventory').send({ warehouse_id: 'WH-1', item: 'Water', quantity: 100 });
    const second = await request(app).post('/api/inventory').send({ warehouse_id: 'WH-1', item: 'water', quantity: 50 });
    expect(second.body.quantity).toBe(150);

    const rows = await knex('inventory').where({ warehouse_id: 'WH-1', item: 'water' });
    expect(rows.length).toBe(1);
});

test('adding negative stock or to an unknown warehouse is refused', async () => {
    const res = await request(app).post('/api/inventory')
        .send({ warehouse_id: 'WH-9', item: 'water', quantity: -10 });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBe(2);
});
