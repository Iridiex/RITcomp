const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { retryUntranslated } = require('../src/services/noteService');
const { AUTH, shelterAuth } = require('./helpers/auth');
const { signToken } = require('../src/auth');

const DRIVER = 'Bearer ' + signToken({ user_id: 9, username: 'one', name: 'One', role: 'driver', driver_id: 'DR-1' });
const realFetch = global.fetch;
const act = (id, action, body = {}) =>
    request(app).patch(`/api/shipments/${id}/${action}`).set('Authorization', AUTH).send(body);

const TRANSLATIONS = {
    'सड़क पर पानी भर गया है': { language: 'Hindi', english: 'The road is flooded', arabic: 'الطريق غارق بالمياه' },
    'पांच बोतलें टूट गईं': { language: 'Hindi', english: 'Five bottles broke', arabic: 'انكسرت خمس زجاجات' },
};

function gemini(answer) {
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }) };
}

// Answers speech with `heard`, and translations from TRANSLATIONS; anything else fails like an outage
function fakeGemini(heard) {
    global.fetch = jest.fn(async (url, options) => {
        const body = JSON.parse(options.body);
        const part = body.contents[0].parts[0];
        if (part.inlineData) return gemini(heard);
        if (TRANSLATIONS[part.text]) return gemini(TRANSLATIONS[part.text]);
        return { ok: false, status: 503, text: async () => 'unavailable' };
    });
}

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Hall', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'water', quantity: 90 });
    await knex('drivers').insert([{ driver_id: 'DR-1', name: 'One' }, { driver_id: 'DR-2', name: 'Two' }, { driver_id: 'DR-3', name: 'Three' }]);
    await knex('requests').insert([
        { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 30, urgency: 'Critical' },
        { request_id: 'RQ-002', shelter_id: 'SH-01', item: 'water', quantity: 30, urgency: 'High' },
        { request_id: 'RQ-003', shelter_id: 'SH-01', item: 'water', quantity: 30, urgency: 'Moderate' },
    ]);
    await request(app).post('/api/allocations/run').set('Authorization', AUTH);
});

afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
});

afterAll(async () => {
    await knex.destroy();
});

test('AI status is visible to every role and follows the key', async () => {
    const off = await request(app).get('/api/ai/status').set('Authorization', DRIVER);
    expect(off.body).toEqual({ enabled: false });
    process.env.GEMINI_API_KEY = 'test-key';
    const on = await request(app).get('/api/ai/status').set('Authorization', shelterAuth('SH-01'));
    expect(on.body).toEqual({ enabled: true });
});

test('a driver speaks and gets back the language and their own words', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    fakeGemini({ heard: true, language: 'Hindi', text: 'सड़क पर पानी भर गया है' });
    const res = await request(app).post('/api/speech').set('Authorization', DRIVER)
        .set('Content-Type', 'audio/wav').send(Buffer.from('RIFF....WAVEfmt fake audio'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ language: 'Hindi', text: 'सड़क पर पानी भर गया है' });
    const sent = JSON.parse(global.fetch.mock.calls[0][1].body).contents[0].parts[0].inlineData;
    expect(sent.mimeType).toBe('audio/wav');
    expect(Buffer.from(sent.data, 'base64').toString()).toBe('RIFF....WAVEfmt fake audio');
});

test('silence, empty uploads, a missing key and other roles are all refused', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    fakeGemini({ heard: false, language: '', text: '' });
    const silent = await request(app).post('/api/speech').set('Authorization', DRIVER).set('Content-Type', 'audio/wav').send(Buffer.from('x'));
    expect(silent.status).toBe(400);
    expect(silent.body.errors[0]).toMatch(/Didn't catch that/);

    const empty = await request(app).post('/api/speech').set('Authorization', DRIVER).set('Content-Type', 'audio/wav');
    expect(empty.status).toBe(400);

    const shelter = await request(app).post('/api/speech').set('Authorization', shelterAuth('SH-01')).set('Content-Type', 'audio/wav').send(Buffer.from('x'));
    expect(shelter.status).toBe(403);

    delete process.env.GEMINI_API_KEY;
    const off = await request(app).post('/api/speech').set('Authorization', DRIVER).set('Content-Type', 'audio/wav').send(Buffer.from('x'));
    expect(off.status).toBe(503);
});

test('notes are saved with English and Arabic, and the shipment keeps the English for reports', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    fakeGemini();
    await act('SHP-001', 'pickup');
    const res = await act('SHP-001', 'fail', { reason: 'सड़क पर पानी भर गया है', damaged: 5, damage_note: 'पांच बोतलें टूट गईं' });
    expect(res.status).toBe(200);
    expect(res.body.failure_reason).toBe('The road is flooded');
    expect(res.body.damage_note).toBe('When delivery failed: Five bottles broke');

    const list = await request(app).get('/api/shipments').set('Authorization', AUTH);
    const notes = list.body.find((s) => s.shipment_id === 'SHP-001').notes;
    expect(notes).toEqual([
        { kind: 'failure', stage: 'When delivery failed', original: 'सड़क पर पानी भर गया है', language: 'Hindi', english: 'The road is flooded', arabic: 'الطريق غارق بالمياه' },
        { kind: 'damage', stage: 'When delivery failed', original: 'पांच बोतलें टूट गईं', language: 'Hindi', english: 'Five bottles broke', arabic: 'انكسرت خمس زجاجات' },
    ]);
});

test('without a key notes are saved exactly as typed', async () => {
    await act('SHP-002', 'pickup');
    const res = await act('SHP-002', 'deliver', { damaged: 2, damage_note: 'Two cans dented' });
    expect(res.body.damage_note).toBe('On arrival: Two cans dented');
    const note = await knex('shipment_notes').where({ shipment_id: 'SHP-002' }).first();
    expect(note).toMatchObject({ original: 'Two cans dented', english: null, arabic: null });
});

test('a note saved during an outage is translated later and the English summary is updated', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    fakeGemini();
    await act('SHP-003', 'pickup', { damaged: 1, damage_note: 'ایک ڈبہ پھٹ گیا' });
    expect((await knex('shipments').where({ shipment_id: 'SHP-003' }).first()).damage_note).toBe('At pickup: ایک ڈبہ پھٹ گیا');

    TRANSLATIONS['ایک ڈبہ پھٹ گیا'] = { language: 'Urdu', english: 'One box burst', arabic: 'انفجر صندوق واحد' };
    await retryUntranslated();
    expect((await knex('shipments').where({ shipment_id: 'SHP-003' }).first()).damage_note).toBe('At pickup: One box burst');
    expect(await knex('shipment_notes').where({ shipment_id: 'SHP-003' }).first())
        .toMatchObject({ language: 'Urdu', english: 'One box burst', arabic: 'انفجر صندوق واحد' });
});
