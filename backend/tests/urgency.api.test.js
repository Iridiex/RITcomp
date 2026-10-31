const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { geminiCheck } = require('../src/ai/urgency');
const { AUTH, shelterAuth, warehouseAuth } = require('./helpers/auth');

const SHELTER = shelterAuth('SH-01');
const realFetch = global.fetch;

function reply(body, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 429, json: async () => body, text: async () => 'quota' });
}

function answer(suggested, why) {
    reply({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggested, why }) }] } }] });
}

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({
        shelter_id: 'SH-01', name: 'Test Shelter', priority: 1, latitude: 25.1, longitude: 55.2,
    });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'water', quantity: 100 });
});

afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
});

afterAll(async () => {
    await knex.destroy();
});

test('without a key there is no suggestion, and requests still go through', async () => {
    global.fetch = jest.fn();
    const check = await request(app).post('/api/urgency/check').set('Authorization', SHELTER)
        .send({ reason: 'No drinking water left' });
    expect(check.status).toBe(200);
    expect(check.body).toBeNull();

    const created = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'water', quantity: 20, urgency: 'High', reason: 'No drinking water left' });
    expect(created.status).toBe(201);
    expect(created.body.ai_urgency).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('shelter gets the Gemini suggestion for its reason', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    answer('Critical', 'Elderly people without water are at risk today.');
    const res = await request(app).post('/api/urgency/check').set('Authorization', SHELTER)
        .send({ item: 'water', quantity: 20, reason: 'Elderly residents, no drinking water left' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggested: 'Critical', why: 'Elderly people without water are at risk today.' });
    expect(global.fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-key');
});

test('a request saves the suggestion next to the urgency the shelter chose', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    answer('Critical', 'A child is injured.');
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'water', quantity: 30, urgency: 'Moderate', reason: 'Child injured, no water today' });
    expect(res.status).toBe(201);
    const saved = await knex('requests').where({ request_id: res.body.request_id }).first();
    expect(saved.urgency).toBe('Moderate');
    expect(saved.ai_urgency).toBe('Critical');
    expect(saved.ai_why).toBe('A child is injured.');
});

test('when Gemini fails the request is saved without a suggestion', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    reply({}, false);
    const res = await request(app).post('/api/requests').set('Authorization', SHELTER)
        .send({ item: 'water', quantity: 40, urgency: 'High', reason: 'Running low by Friday' });
    expect(res.status).toBe(201);
    expect(res.body.ai_urgency).toBeNull();
});

test('an empty reason is refused, and other roles cannot use the check', async () => {
    const empty = await request(app).post('/api/urgency/check').set('Authorization', SHELTER).send({ reason: ' ' });
    expect(empty.status).toBe(400);
    const warehouse = await request(app).post('/api/urgency/check').set('Authorization', warehouseAuth('WH-1'))
        .send({ reason: 'No water' });
    expect(warehouse.status).toBe(403);
    const coordinator = await request(app).post('/api/urgency/check').set('Authorization', AUTH)
        .send({ reason: 'No water' });
    expect(coordinator.status).toBe(200);
});

test('Gemini replies: thought parts are skipped, unknown levels and API errors throw', async () => {
    reply({ candidates: [{ content: { parts: [
        { text: 'thinking...', thought: true },
        { text: '{"suggested":"High","why":"Supplies run out in two days."}' },
    ] } }] });
    await expect(geminiCheck({ item: 'water', quantity: 5, reason: 'x' }))
        .resolves.toEqual({ suggested: 'High', why: 'Supplies run out in two days.' });

    reply({ candidates: [{ content: { parts: [{ text: '{"enough_detail":false,"suggested":"Critical","why":"Cold is dangerous."}' }] } }] });
    await expect(geminiCheck({ item: 'blankets', quantity: 100, reason: 'it is cold' })).resolves.toBeNull();

    answer('Urgent', 'x');
    await expect(geminiCheck({ reason: 'x' })).rejects.toThrow('unknown level');
    reply({}, false);
    await expect(geminiCheck({ reason: 'x' })).rejects.toThrow('Gemini 429');
});
