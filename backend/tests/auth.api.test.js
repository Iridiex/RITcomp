const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const knex = require('../src/db');

async function login(username) {
    const res = await request(app).post('/api/auth/login').send({ username, password: 'pass123' });
    return res.body.token;
}

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert([
        { shelter_id: 'SH-01', name: 'Shelter One', priority: 1, latitude: 25.1, longitude: 55.2 },
        { shelter_id: 'SH-02', name: 'Shelter Two', priority: 2, latitude: 25.2, longitude: 55.3 },
    ]);
    await knex('warehouses').insert([
        { warehouse_id: 'WH-1', name: 'Depot One', latitude: 25.1, longitude: 55.2 },
        { warehouse_id: 'WH-2', name: 'Depot Two', latitude: 25.2, longitude: 55.3 },
    ]);
    await knex('drivers').insert([
        { driver_id: 'DR-1', name: 'Ahmed', phone: '050-000-0001' },
        { driver_id: 'DR-2', name: 'Priya', phone: '050-000-0002' },
    ]);
    await knex('requests').insert([
        { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 10, urgency: 'High' },
        { request_id: 'RQ-002', shelter_id: 'SH-02', item: 'food packs', quantity: 5, urgency: 'High' },
    ]);
    await knex('shipments').insert({
        shipment_id: 'SHP-001', run_id: 'RUN-1', request_id: 'RQ-001', warehouse_id: 'WH-1',
        item: 'water', quantity: 10, status: 'Ready', driver_id: 'DR-2',
    });
    const hash = bcrypt.hashSync('pass123', 4);
    await knex('users').insert([
        { username: 'boss', password_hash: hash, name: 'Coordinator', role: 'coordinator' },
        { username: 'sh01', password_hash: hash, name: 'Shelter One', role: 'shelter', shelter_id: 'SH-01' },
        { username: 'wh2', password_hash: hash, name: 'Depot Two', role: 'warehouse', warehouse_id: 'WH-2' },
        { username: 'ahmed', password_hash: hash, name: 'Ahmed', role: 'driver', driver_id: 'DR-1' },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test('wrong password is refused', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'sh01', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
});

test('correct login returns a token and the role, never the password hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'SH01', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('shelter');
    expect(res.body.user.shelter_id).toBe('SH-01');
    expect(res.body.user.password_hash).toBeUndefined();
});

test('no token or a fake token gets 401', async () => {
    expect((await request(app).get('/api/requests')).status).toBe(401);
    expect((await request(app).get('/api/requests').set('Authorization', 'Bearer fake')).status).toBe(401);
});

test('a driver cannot run allocation', async () => {
    const token = await login('ahmed');
    const res = await request(app).post('/api/allocations/run').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(403);
});

test('a shelter only sees its own requests', async () => {
    const token = await login('sh01');
    const res = await request(app).get('/api/requests').set('Authorization', 'Bearer ' + token);
    expect(res.body.map((r) => r.request_id)).toEqual(['RQ-001']);
});

test('a shelter request is forced to its own shelter and goes to review', async () => {
    const token = await login('sh01');
    const res = await request(app).post('/api/requests').set('Authorization', 'Bearer ' + token)
        .send({ shelter_id: 'SH-02', item: 'blankets', quantity: 20, urgency: 'High' });
    expect(res.status).toBe(201);
    expect(res.body.shelter_id).toBe('SH-01');
    expect(res.body.status).toBe('Awaiting review');
});

test("a driver cannot touch another driver's delivery", async () => {
    const token = await login('ahmed');
    const res = await request(app).patch('/api/shipments/SHP-001/pickup').set('Authorization', 'Bearer ' + token).send({});
    expect(res.status).toBe(403);
});

test('a driver only sees their own shipments', async () => {
    const token = await login('ahmed');
    const res = await request(app).get('/api/shipments').set('Authorization', 'Bearer ' + token);
    expect(res.body).toEqual([]);
});

test('a warehouse can only add stock to itself', async () => {
    const token = await login('wh2');
    const res = await request(app).post('/api/inventory').set('Authorization', 'Bearer ' + token)
        .send({ warehouse_id: 'WH-1', item: 'water', quantity: 30 });
    expect(res.status).toBe(201);
    expect(res.body.warehouse_id).toBe('WH-2');
});

test('report downloads need a coordinator token', async () => {
    const boss = await login('boss');
    const shelter = await login('sh01');
    expect((await request(app).get('/api/reports/report.json?token=' + boss)).status).toBe(200);
    expect((await request(app).get('/api/reports/report.json?token=' + shelter)).status).toBe(403);
});
