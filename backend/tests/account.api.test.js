const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const knex = require('../src/db');

async function login(username, password) {
    return request(app).post('/api/auth/login').send({ username, password });
}

async function tokenFor(username, password) {
    return 'Bearer ' + (await login(username, password)).body.token;
}

const changeMine = (auth, body) => request(app).patch('/api/auth/me').set('Authorization', auth).send(body);

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.1, longitude: 55.2 });
    await knex('drivers').insert({ driver_id: 'DR-1', name: 'Ahmed' });
    const hash = bcrypt.hashSync('old-password', 4);
    await knex('users').insert([
        { username: 'boss', password_hash: hash, name: 'Coordinator', role: 'coordinator' },
        { username: 'hall', password_hash: hash, name: 'Hall', role: 'shelter', shelter_id: 'SH-01' },
        { username: 'depot', password_hash: hash, name: 'Depot', role: 'warehouse', warehouse_id: 'WH-1' },
        { username: 'ahmed', password_hash: hash, name: 'Ahmed', role: 'driver', driver_id: 'DR-1' },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test.each(['boss', 'hall', 'depot', 'ahmed'])('%s can change their own password', async (username) => {
    const auth = await tokenFor(username, 'old-password');
    const res = await changeMine(auth, { current_password: 'old-password', new_password: 'brand-new-pass' });
    expect(res.status).toBe(200);
    expect((await login(username, 'old-password')).status).toBe(401);
    expect((await login(username, 'brand-new-pass')).status).toBe(200);
});

test('a wrong current password changes nothing and does not log the user out', async () => {
    const auth = await tokenFor('hall', 'brand-new-pass');
    const res = await changeMine(auth, { current_password: 'guess', new_password: 'hacked-pass' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Your current password is not right']);
    expect((await login('hall', 'brand-new-pass')).status).toBe(200);
});

test('changing the username returns a fresh token for the new name, keeping the role', async () => {
    const auth = await tokenFor('ahmed', 'brand-new-pass');
    const res = await changeMine(auth, { current_password: 'brand-new-pass', username: ' Ahmed.K ' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'ahmed.k', role: 'driver', driver_id: 'DR-1' });

    const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + res.body.token);
    expect(me.body.user.username).toBe('ahmed.k');
    expect((await login('ahmed.k', 'brand-new-pass')).status).toBe(200);
    expect((await login('ahmed', 'brand-new-pass')).status).toBe(401);
});

test('new credentials must follow the same rules as everywhere else', async () => {
    const auth = await tokenFor('depot', 'brand-new-pass');
    const res = await changeMine(auth, { current_password: 'brand-new-pass', username: 'boss', new_password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Username boss is already taken', 'Password must be at least 8 characters']);

    const nothing = await changeMine(auth, { current_password: 'brand-new-pass', username: 'depot' });
    expect(nothing.body.errors).toEqual(['Enter a new username or a new password']);
});

test('a user cannot change their own ID, role or linked site', async () => {
    const auth = await tokenFor('depot', 'brand-new-pass');
    const res = await changeMine(auth, {
        current_password: 'brand-new-pass', new_password: 'another-pass',
        user_id: 999, role: 'coordinator', warehouse_id: 'WH-9', shelter_id: 'SH-01',
    });
    expect(res.status).toBe(200);
    const row = await knex('users').where({ username: 'depot' }).first();
    expect(row).toMatchObject({ role: 'warehouse', warehouse_id: 'WH-1', shelter_id: null });
    expect(row.user_id).not.toBe(999);
});

test('editing a shelter, warehouse or driver never changes its ID', async () => {
    const auth = await tokenFor('boss', 'brand-new-pass');
    const edits = [
        ['/api/shelters/SH-01', { shelter_id: 'SH-99', name: 'Hall', priority: 1, latitude: 25.1, longitude: 55.2 }],
        ['/api/warehouses/WH-1', { warehouse_id: 'WH-99', name: 'Depot', latitude: 25.1, longitude: 55.2 }],
        ['/api/drivers/DR-1', { driver_id: 'DR-99', name: 'Ahmed' }],
    ];
    for (const [path, body] of edits) {
        expect((await request(app).patch(path).set('Authorization', auth).send(body)).status).toBe(200);
    }
    expect(await knex('shelters').pluck('shelter_id')).toEqual(['SH-01']);
    expect(await knex('warehouses').pluck('warehouse_id')).toEqual(['WH-1']);
    expect(await knex('drivers').pluck('driver_id')).toEqual(['DR-1']);
});

test('you must be logged in to change credentials', async () => {
    expect((await request(app).patch('/api/auth/me').send({ current_password: 'x', new_password: 'yyyyyyyy' })).status).toBe(401);
});
