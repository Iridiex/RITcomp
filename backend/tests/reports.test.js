const request = require('supertest');
const app = require('../src/app');
const { AUTH, warehouseAuth } = require('./helpers/auth');
const knex = require('../src/db');
const { csvCell, toCsv } = require('../src/reports/csv');

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert({ shelter_id: 'SH-01', name: 'Hall, North', priority: 1, latitude: 25.1, longitude: 55.2 });
    await knex('requests').insert([
        { request_id: 'RQ-001', shelter_id: 'SH-01', item: 'water', quantity: 100, urgency: 'Critical', status: 'Fulfilled', quantity_allocated: 100 },
        { request_id: 'RQ-002', shelter_id: 'SH-01', item: 'food packs', quantity: 50, urgency: 'High', status: 'Partial', quantity_allocated: 20 },
        { request_id: 'RQ-003', shelter_id: 'SH-01', item: 'tents', quantity: 10, urgency: 'Moderate', status: 'Unfulfilled', quantity_allocated: 0 },
        { request_id: 'RQ-004', shelter_id: 'SH-01', item: 'blankets', quantity: 5, urgency: 'High', status: 'Pending', quantity_allocated: 0 },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test('csvCell quotes commas and doubles inner quotes', () => {
    expect(csvCell('water')).toBe('water');
    expect(csvCell('Hall, North')).toBe('"Hall, North"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
});

test('toCsv writes a header row then one line per row', () => {
    const csv = toCsv([{ a: 1, b: 'x' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
    expect(csv).toBe('A,B\n1,x');
});

test('JSON report groups fulfilled and unfulfilled correctly', async () => {
    const res = await request(app).get('/api/reports/report.json').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    const report = JSON.parse(res.text);
    expect(report.summary.fulfilled).toBe(1);
    expect(report.summary.partial).toBe(1);
    expect(report.summary.unfulfilled).toBe(1);
    expect(report.summary.pending).toBe(1);
    expect(report.unfulfilled.map((r) => r.request_id)).toEqual(['RQ-002', 'RQ-003']);
    // 120 sent out of 160 processed = 75%
    expect(report.summary.fill_rate).toBe(75);
});

test('CSV report has a header and every request', async () => {
    const res = await request(app).get('/api/reports/requests.csv').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines[0].startsWith('Request ID,')).toBe(true);
    expect(lines.length).toBe(5);
    expect(res.text).toContain('"Hall, North"');
});

test('PDF report downloads as a PDF', async () => {
    const res = await request(app).get('/api/reports/report.pdf').set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
});
