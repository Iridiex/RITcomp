const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');

// Build the tables in the in-memory database and add one shelter
beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({
        shelter_id: 'SH-01', name: 'Test Shelter', priority: 1, latitude: 25.1, longitude: 55.2,
    });
});

afterAll(async () => {
    await knex.destroy();
});

test('coordinator request is saved as Pending, item cleaned up', async () => {
    const res = await request(app).post('/api/requests')
        .send({ shelter_id: 'SH-01', item: '  Water ', quantity: 50, urgency: 'High' });
    expect(res.status).toBe(201);
    expect(res.body.request_id).toBe('RQ-001');
    expect(res.body.status).toBe('Pending');
    expect(res.body.item).toBe('water');
});

test('bad input is refused with every error, and nothing is saved', async () => {
    const res = await request(app).post('/api/requests')
        .send({ shelter_id: 'SH-99', item: '', quantity: -5, urgency: 'Urgent' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBe(4);
    const rows = await knex('requests');
    expect(rows.length).toBe(1);
});

test('Critical without a reason is refused', async () => {
    const res = await request(app).post('/api/requests')
        .send({ shelter_id: 'SH-01', item: 'water', quantity: 10, urgency: 'Critical' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Critical requests need a reason');
});

test('shelter request waits for review', async () => {
    const res = await request(app).post('/api/requests')
        .send({ shelter_id: 'SH-01', item: 'blankets', quantity: 40, urgency: 'Critical', reason: 'Cold night', submitted_by: 'shelter' });
    expect(res.status).toBe(201);
    expect(res.body.request_id).toBe('RQ-002');
    expect(res.body.status).toBe('Awaiting review');
});

test('coordinator approves and downgrades urgency', async () => {
    const res = await request(app).patch('/api/requests/RQ-002/review')
        .send({ action: 'approve', urgency: 'Moderate', review_note: 'Not life-threatening' });
    expect(res.status).toBe(200);
    const saved = await knex('requests').where({ request_id: 'RQ-002' }).first();
    expect(saved.status).toBe('Pending');
    expect(saved.urgency).toBe('Moderate');
});

test('a request cannot be reviewed twice', async () => {
    const res = await request(app).patch('/api/requests/RQ-002/review')
        .send({ action: 'approve' });
    expect(res.status).toBe(400);
});

test('reject needs a note, then sets Rejected', async () => {
    const created = await request(app).post('/api/requests')
        .send({ shelter_id: 'SH-01', item: 'tents', quantity: 5, urgency: 'High', submitted_by: 'shelter' });
    const id = created.body.request_id;

    const noNote = await request(app).patch(`/api/requests/${id}/review`).send({ action: 'reject' });
    expect(noNote.status).toBe(400);

    const withNote = await request(app).patch(`/api/requests/${id}/review`)
        .send({ action: 'reject', review_note: 'Tents not stocked' });
    expect(withNote.status).toBe(200);
    expect(withNote.body.status).toBe('Rejected');
});

test('reviewing a request that does not exist gives 404', async () => {
    const res = await request(app).patch('/api/requests/RQ-999/review').send({ action: 'approve' });
    expect(res.status).toBe(404);
});
