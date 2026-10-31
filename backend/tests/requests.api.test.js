const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { AUTH, shelterAuth } = require('./helpers/auth');

const SHELTER = shelterAuth('SH-01');

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({
        shelter_id: 'SH-01', name: 'Test Shelter', priority: 1, latitude: 25.1, longitude: 55.2,
    });
    await knex('warehouses').insert([
        { warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 },
        { warehouse_id: 'WH-2', name: 'Store', latitude: 25.3, longitude: 55.4 },
    ]);
    await knex('inventory').insert([
        { warehouse_id: 'WH-1', item: 'water', quantity: 100 },
        { warehouse_id: 'WH-2', item: 'water', quantity: 50 },
        { warehouse_id: 'WH-1', item: 'tents', quantity: 10 },
        { warehouse_id: 'WH-2', item: 'rice', quantity: 0 },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test('shelter request waits for review, item cleaned up', async () => {
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: '  Water ', quantity: 50, urgency: 'High', reason: 'Supply ran out' });
    expect(res.status).toBe(201);
    expect(res.body.request_id).toBe('RQ-001');
    expect(res.body.shelter_id).toBe('SH-01');
    expect(res.body.status).toBe('Awaiting review');
    expect(res.body.item).toBe('water');
});

test('bad input is refused with every error, and nothing is saved', async () => {
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: '', quantity: -5, urgency: 'Urgent' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBe(4);
    const rows = await knex('requests');
    expect(rows.length).toBe(1);
});

test.each(['Critical', 'High', 'Moderate'])('a %s request without a reason is refused', async (urgency) => {
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'water', quantity: 10, urgency, reason: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Say why you need this']);
});

test('an item no warehouse stocks is refused', async () => {
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'Unicorns', quantity: 1, urgency: 'High', reason: 'Morale' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Choose an item from the list. Warehouses do not stock Unicorns']);
});

test('the item list names each stocked item once, keeps items that have run out, and hides quantities', async () => {
    const res = await request(app).get('/api/items').set('Authorization', SHELTER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ item: 'rice' }, { item: 'tents' }, { item: 'water' }]);
});

test('coordinator can view but not create requests', async () => {
    expect((await request(app).get('/api/requests').set('Authorization', AUTH)).status).toBe(200);
    const res = await request(app).post('/api/requests').set('Authorization', AUTH)
        .send({ shelter_id: 'SH-01', item: 'water', quantity: 10, urgency: 'High' });
    expect(res.status).toBe(403);
});

test('a shelter cannot review requests', async () => {
    const res = await request(app).patch('/api/requests/RQ-001/review').set('Authorization', SHELTER)
        .send({ action: 'approve' });
    expect(res.status).toBe(403);
});

test('coordinator approves and downgrades urgency', async () => {
    const res = await request(app).patch('/api/requests/RQ-001/review').set('Authorization', AUTH)
        .send({ action: 'approve', urgency: 'Moderate', review_note: 'Not life-threatening' });
    expect(res.status).toBe(200);
    const saved = await knex('requests').where({ request_id: 'RQ-001' }).first();
    expect(saved.status).toBe('Pending');
    expect(saved.urgency).toBe('Moderate');
});

test('a request cannot be reviewed twice', async () => {
    const res = await request(app).patch('/api/requests/RQ-001/review').set('Authorization', AUTH)
        .send({ action: 'approve' });
    expect(res.status).toBe(400);
});

test('reject needs a note, then sets Rejected', async () => {
    const created = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'tents', quantity: 5, urgency: 'High', reason: 'Roof damaged' });
    const id = created.body.request_id;

    const noNote = await request(app).patch(`/api/requests/${id}/review`).set('Authorization', AUTH)
        .send({ action: 'reject' });
    expect(noNote.status).toBe(400);

    const withNote = await request(app).patch(`/api/requests/${id}/review`).set('Authorization', AUTH)
        .send({ action: 'reject', review_note: 'Tents not stocked' });
    expect(withNote.status).toBe(200);
    expect(withNote.body.status).toBe('Rejected');
});

test('text fields that are not text are refused, not crashed on', async () => {
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 42, quantity: 10, urgency: 'Critical', reason: { why: 'x' } });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Enter an item', 'Say why you need this']);
});

test('a review with no body is refused, not crashed on', async () => {
    const created = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'rice', quantity: 5, urgency: 'High', reason: 'No food left' });
    const res = await request(app).patch(`/api/requests/${created.body.request_id}/review`).set('Authorization', AUTH);
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Action must be approve or reject']);
});

test('reviewing a request that does not exist gives 404', async () => {
    const res = await request(app).patch('/api/requests/RQ-999/review').set('Authorization', AUTH)
        .send({ action: 'approve' });
    expect(res.status).toBe(404);
});
