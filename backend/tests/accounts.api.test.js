const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { AUTH, shelterAuth } = require('./helpers/auth');

const place = { latitude: 25.2, longitude: 55.3 };

async function login(username, password) {
    return request(app).post('/api/auth/login').send({ username, password });
}

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Old Hall', priority: 2, ...place });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', ...place });
    await knex('drivers').insert({ driver_id: 'DR-1', name: 'Busy Driver', phone: '050-000-0001' });
    await knex('requests').insert({ request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 5, urgency: 'High' });
    await knex('shipments').insert({
        shipment_id: 'SHP-001', run_id: 'RUN-1', request_id: 'RQ-001', warehouse_id: 'WH-1',
        item: 'water', quantity: 5, status: 'Delivered', driver_id: 'DR-1',
    });
});

afterAll(async () => {
    await knex.destroy();
});

test('registering a shelter with a login lets that shelter log in', async () => {
    const res = await request(app).post('/api/shelters').set('Authorization', AUTH)
        .send({ name: 'Karama Hall', priority: 1, ...place, login: { username: ' Karama ', password: 'safe-pass-1' } });
    expect(res.status).toBe(201);
    expect(res.body.shelter_id).toBe('SH-02');
    expect(res.body.username).toBe('karama');

    const session = await login('karama', 'safe-pass-1');
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ role: 'shelter', shelter_id: 'SH-02', name: 'Karama Hall' });
});

test('a taken username or short password refuses the whole registration', async () => {
    const res = await request(app).post('/api/warehouses').set('Authorization', AUTH)
        .send({ name: 'Second Depot', ...place, login: { username: 'karama', password: 'short' } });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Username karama is already taken', 'Password must be at least 8 characters']);
    expect(await knex('warehouses').where({ name: 'Second Depot' }).first()).toBeUndefined();
});

test('registering without a login still works', async () => {
    const res = await request(app).post('/api/warehouses').set('Authorization', AUTH)
        .send({ name: 'No Login Depot', ...place, login: { username: '', password: '' } });
    expect(res.status).toBe(201);
    expect(res.body.username).toBeNull();
});

test('editing an existing site can add a login, and a later edit resets its password', async () => {
    const added = await request(app).patch('/api/shelters/SH-01').set('Authorization', AUTH)
        .send({ name: 'Renamed Hall', priority: 2, ...place, login: { username: 'sh01', password: 'first-pass' } });
    expect(added.status).toBe(200);
    expect(added.body.username).toBe('sh01');
    expect((await login('sh01', 'first-pass')).body.user.name).toBe('Renamed Hall');

    const reset = await request(app).patch('/api/shelters/SH-01').set('Authorization', AUTH)
        .send({ name: 'Renamed Hall', priority: 2, ...place, login: { password: 'second-pass' } });
    expect(reset.status).toBe(200);
    expect((await login('sh01', 'first-pass')).status).toBe(401);
    expect((await login('sh01', 'second-pass')).status).toBe(200);
});

test('a coordinator can add a driver with a login, who then only sees their own deliveries', async () => {
    const res = await request(app).post('/api/drivers').set('Authorization', AUTH)
        .send({ name: 'Sara Ali', phone: '050-555-1234', login: { username: 'sara', password: 'drive-safe' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ driver_id: 'DR-2', name: 'Sara Ali', phone: '050-555-1234', username: 'sara' });

    const session = await login('sara', 'drive-safe');
    expect(session.body.user).toMatchObject({ role: 'driver', driver_id: 'DR-2' });
    const mine = await request(app).get('/api/shipments').set('Authorization', 'Bearer ' + session.body.token);
    expect(mine.body).toEqual([]);
});

test('a driver needs a name and a sensible phone number', async () => {
    const res = await request(app).post('/api/drivers').set('Authorization', AUTH).send({ name: ' ', phone: 'call me' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Enter a name', 'Phone must be a number like 050-123-4567']);
});

test('a driver with delivery history cannot be deleted; one without can, along with their login', async () => {
    const busy = await request(app).delete('/api/drivers/DR-1').set('Authorization', AUTH);
    expect(busy.status).toBe(400);
    expect(busy.body.errors).toEqual(['DR-1 has 1 shipment(s) on record and cannot be deleted']);

    const gone = await request(app).delete('/api/drivers/DR-2').set('Authorization', AUTH);
    expect(gone.status).toBe(200);
    expect((await login('sara', 'drive-safe')).status).toBe(401);
});

test('deleting a shelter removes its login too', async () => {
    expect((await request(app).delete('/api/shelters/SH-02').set('Authorization', AUTH)).status).toBe(200);
    expect((await login('karama', 'safe-pass-1')).status).toBe(401);
});

test('the user list never includes password hashes, and only coordinators can manage accounts', async () => {
    const users = await request(app).get('/api/users').set('Authorization', AUTH);
    expect(users.status).toBe(200);
    expect(users.body.map((u) => u.username)).toEqual(['sh01']);
    expect(users.body[0].password_hash).toBeUndefined();

    const shelter = shelterAuth('SH-01');
    expect((await request(app).get('/api/users').set('Authorization', shelter)).status).toBe(403);
    expect((await request(app).post('/api/drivers').set('Authorization', shelter).send({ name: 'Sneaky' })).status).toBe(403);
});
