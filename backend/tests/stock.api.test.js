const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { AUTH, warehouseAuth } = require('./helpers/auth');

const WH1 = warehouseAuth('WH-1');
const WH2 = warehouseAuth('WH-2');
const waterAt = async (id) => (await knex('inventory').where({ warehouse_id: id, item: 'water' }).first()).quantity;

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('warehouses').insert([
        { warehouse_id: 'WH-1', name: 'Depot One', latitude: 25.1, longitude: 55.2 },
        { warehouse_id: 'WH-2', name: 'Depot Two', latitude: 25.2, longitude: 55.3 },
    ]);
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'water', quantity: 100 });
});

afterAll(async () => {
    await knex.destroy();
});

test('a warehouse removes stock with a reason, and it is logged', async () => {
    const res = await request(app).post('/api/inventory/remove').set('Authorization', WH1)
        .send({ item: 'Water', quantity: 10, reason: 'Bottles past expiry date' });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(90);

    const history = await request(app).get('/api/stock/movements').set('Authorization', AUTH);
    expect(history.body[0].change).toBe(-10);
    expect(history.body[0].reason).toBe('Bottles past expiry date');
    expect(history.body[0].by_name).toBe('Test Warehouse');
});

test('cannot remove more than is in stock', async () => {
    const res = await request(app).post('/api/inventory/remove').set('Authorization', WH1)
        .send({ item: 'water', quantity: 500, reason: 'Counting error' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Only 90 water in stock');
    expect(await waterAt('WH-1')).toBe(90);
});

test('removing stock needs a reason', async () => {
    const res = await request(app).post('/api/inventory/remove').set('Authorization', WH1)
        .send({ item: 'water', quantity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Give a reason for removing stock');
});

test("a warehouse cannot remove another warehouse's stock", async () => {
    const res = await request(app).post('/api/inventory/remove').set('Authorization', WH2)
        .send({ warehouse_id: 'WH-1', item: 'water', quantity: 5, reason: 'Trying' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('WH-2 has no water');
    expect(await waterAt('WH-1')).toBe(90);
});

test('coordinator can view stock but not change it', async () => {
    expect((await request(app).get('/api/inventory').set('Authorization', AUTH)).status).toBe(200);
    const add = await request(app).post('/api/inventory').set('Authorization', AUTH)
        .send({ warehouse_id: 'WH-1', item: 'water', quantity: 5 });
    const remove = await request(app).post('/api/inventory/remove').set('Authorization', AUTH)
        .send({ warehouse_id: 'WH-1', item: 'water', quantity: 5, reason: 'x' });
    expect(add.status).toBe(403);
    expect(remove.status).toBe(403);
});

test('a warehouse only sees its own stock history', async () => {
    await request(app).post('/api/inventory').set('Authorization', WH2)
        .send({ item: 'blankets', quantity: 40, reason: 'Donation received' });
    const res = await request(app).get('/api/stock/movements').set('Authorization', WH2);
    expect(res.body.length).toBe(1);
    expect(res.body[0].warehouse_id).toBe('WH-2');
    expect(res.body[0].change).toBe(40);
});
