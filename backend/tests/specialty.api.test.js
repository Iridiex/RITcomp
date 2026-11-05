const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { geminiCheck } = require('../src/ai/specialty');
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
    await knex('hospitals').insert({ hospital_id: 'H-1', name: 'City Hospital', latitude: 25.12, longitude: 55.21 });
    await knex('doctors').insert({
        doctor_id: 'DOC-01', name: 'Noura', specialty: 'Pediatrician', status: 'Available', hospital_id: 'H-1',
    });
});

afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
});

afterAll(async () => {
    await knex.destroy();
});

test('without a key there is no suggestion, and tickets still go through', async () => {
    global.fetch = jest.fn();
    const check = await request(app).post('/api/specialty/check').set('Authorization', SHELTER)
        .send({ reason: 'Two children with high fever since last night' });
    expect(check.status).toBe(200);
    expect(check.body).toBeNull();

    const created = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner', reason: 'Two children with high fever since last night' });
    expect(created.status).toBe(201);
    expect(created.body.ai_specialty).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('shelter gets the Gemini suggestion for its reason', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    answer('Pediatrician', 'The request is about children with fever.');
    const res = await request(app).post('/api/specialty/check').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner', reason: 'Two children with high fever since last night' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggested: 'Pediatrician', why: 'The request is about children with fever.' });
    expect(global.fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-key');
});

test('a ticket saves the suggestion next to the specialty the shelter chose', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    answer('Pediatrician', 'Children with fever need a pediatrician.');
    const res = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner', reason: 'Infant with high fever since last night' });
    expect(res.status).toBe(201);
    const saved = await knex('medical_requests').where({ medical_id: res.body.medical_id }).first();
    expect(saved.specialty).toBe('General Practitioner');
    expect(saved.ai_specialty).toBe('Pediatrician');
    expect(saved.ai_why).toBe('Children with fever need a pediatrician.');
});

test('when Gemini fails the ticket is saved without a suggestion', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    reply({}, false);
    const res = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner', reason: 'Someone is unwell after the flood' });
    expect(res.status).toBe(201);
    expect(res.body.ai_specialty).toBeNull();
});

test('an empty reason is refused, and other roles cannot use the check', async () => {
    const empty = await request(app).post('/api/specialty/check').set('Authorization', SHELTER).send({ reason: ' ' });
    expect(empty.status).toBe(400);
    const warehouse = await request(app).post('/api/specialty/check').set('Authorization', warehouseAuth('WH-1'))
        .send({ reason: 'Child with fever' });
    expect(warehouse.status).toBe(403);
    const coordinator = await request(app).post('/api/specialty/check').set('Authorization', AUTH)
        .send({ reason: 'Child with fever' });
    expect(coordinator.status).toBe(200);
});

test('Gemini replies: thought parts are skipped, unknown specialties and API errors throw', async () => {
    reply({ candidates: [{ content: { parts: [
        { text: 'thinking...', thought: true },
        { text: '{"suggested":"Pediatrician","why":"The patient is a child."}' },
    ] } }] });
    await expect(geminiCheck({ specialty: 'General Practitioner', reason: 'x' }))
        .resolves.toEqual({ suggested: 'Pediatrician', why: 'The patient is a child.' });

    reply({ candidates: [{ content: { parts: [{ text: '{"enough_detail":false,"suggested":"Pediatrician","why":"Need a doctor."}' }] } }] });
    await expect(geminiCheck({ specialty: 'General Practitioner', reason: 'need a doctor' })).resolves.toBeNull();

    answer('Cardiologist', 'x');
    await expect(geminiCheck({ reason: 'x' })).rejects.toThrow('unknown specialty');
    reply({}, false);
    await expect(geminiCheck({ reason: 'x' })).rejects.toThrow('Gemini 429');
});
