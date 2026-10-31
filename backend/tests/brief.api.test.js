const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { buildFacts, levelOf, forgetBrief } = require('../src/ai/brief');
const { AUTH, shelterAuth } = require('./helpers/auth');

const realFetch = global.fetch;
const BRIEF = {
    headline: 'Mirdif needs first aid kits.',
    points: [{ tone: 'urgent', text: 'RQ-001 is 10 first aid kits short.' }, { tone: 'loud', text: 'dropped' }],
    actions: ['Restock first aid kits'],
};

function reply(body, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }),
        text: async () => 'server error',
    });
}

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Mirdif', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('warehouses').insert({ warehouse_id: 'WH-1', name: 'Depot', latitude: 25.2, longitude: 55.3 });
    await knex('inventory').insert({ warehouse_id: 'WH-1', item: 'first aid kits', quantity: 0 });
    await knex('requests').insert({
        request_id: 'RQ-001', shelter_id: 'SH-01', item: 'first aid kits', quantity: 15, quantity_allocated: 5,
        urgency: 'Critical', status: 'Partial', reason: 'Injuries',
    });
});

beforeEach(() => {
    forgetBrief();
    process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
});

afterAll(async () => {
    await knex.destroy();
});

test('facts name shelters, count what is short, and list never-stocked items as zero', async () => {
    await knex('requests').insert({
        request_id: 'RQ-002', shelter_id: 'SH-01', item: 'tents', quantity: 4, quantity_allocated: 0,
        urgency: 'Moderate', status: 'Unfulfilled', reason: 'Spare',
    });
    const state = {
        requests: await knex('requests'), inventory: await knex('inventory'), shipments: [], drivers: [],
        shelters: await knex('shelters'), warehouses: await knex('warehouses'), movements: [],
    };
    const facts = buildFacts(state, Date.now());
    expect(facts.short[0]).toMatchObject({ id: 'RQ-001', shelter: 'Mirdif', still_needed: 10, urgency: 'Critical' });
    expect(facts.stock_total_by_item).toEqual({ 'first aid kits': 0, tents: 0 });
    expect(facts.empty_shelves).toEqual(['Depot: first aid kits']);
    expect(levelOf(facts)).toBe('Critical');
    expect(levelOf({ ...facts, short: [facts.short[1]] })).toBe('Strained');
    expect(levelOf({ ...facts, short: [] })).toBe('Stable');
    await knex('requests').where({ request_id: 'RQ-002' }).del();
});

test('without a key the brief is switched off and Gemini is never called', async () => {
    delete process.env.GEMINI_API_KEY;
    global.fetch = jest.fn();
    const res = await request(app).get('/api/brief').set('Authorization', AUTH);
    expect(res.body).toEqual({ enabled: false });
    const post = await request(app).post('/api/brief').set('Authorization', AUTH);
    expect(post.body).toEqual({ enabled: false });
    expect(global.fetch).not.toHaveBeenCalled();
});

test('only the coordinator gets a brief', async () => {
    const res = await request(app).get('/api/brief').set('Authorization', shelterAuth('SH-01'));
    expect(res.status).toBe(403);
});

test('a brief is written once, kept while nothing changes, and marked stale after a change', async () => {
    reply(BRIEF);
    const first = await request(app).post('/api/brief').set('Authorization', AUTH);
    expect(first.status).toBe(200);
    expect(first.body.brief).toEqual({
        level: 'Critical',
        headline: BRIEF.headline,
        points: [BRIEF.points[0]],
        actions: BRIEF.actions,
    });
    const prompt = JSON.parse(JSON.parse(global.fetch.mock.calls[0][1].body).contents[0].parts[0].text);
    expect(prompt.level).toBe('Critical');

    await request(app).post('/api/brief').set('Authorization', AUTH);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await request(app).get('/api/brief').set('Authorization', AUTH)).body.stale).toBe(false);

    await knex('inventory').update({ quantity: 50 });
    expect((await request(app).get('/api/brief').set('Authorization', AUTH)).body.stale).toBe(true);
});

test('when Gemini fails the coordinator gets a clear error', async () => {
    reply({}, false);
    const res = await request(app).post('/api/brief').set('Authorization', AUTH);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Could not write the brief/);
});
