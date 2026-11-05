const request = require('supertest');
const app = require('../src/app');
const knex = require('../src/db');
const { AUTH, shelterAuth, warehouseAuth } = require('./helpers/auth');

const SHELTER = shelterAuth('SH-91');
const OTHER = shelterAuth('SH-92');

beforeAll(async () => {
    await knex.migrate.latest();
    await knex('shelters').insert([
        { shelter_id: 'SH-91', name: 'Al Barsha School Shelter', priority: 1, latitude: 25.1124, longitude: 55.2006 },
        { shelter_id: 'SH-92', name: 'Deira Community Centre', priority: 2, latitude: 25.2711, longitude: 55.3075 },
    ]);
    await knex('hospitals').insert([
        { hospital_id: 'H-91', name: 'Mediclinic Parkview', latitude: 25.0900, longitude: 55.1900 },
        { hospital_id: 'H-92', name: "Al Jalila Children's Hospital", latitude: 25.2310, longitude: 55.3130 },
        { hospital_id: 'H-93', name: 'Rashid Hospital', latitude: 25.2510, longitude: 55.3170 },
    ]);
    await knex('doctors').insert([
        { doctor_id: 'DOC-91', name: 'Omar', specialty: 'General Practitioner', status: 'Available', hospital_id: 'H-91' },
        { doctor_id: 'DOC-92', name: 'Noura', specialty: 'Pediatrician', status: 'Available', hospital_id: 'H-92' },
        { doctor_id: 'DOC-93', name: 'Fatima', specialty: 'Trauma Specialist', status: 'Available', hospital_id: 'H-93' },
    ]);
});

afterAll(async () => {
    await knex.destroy();
});

test('a shelter must say why, and the ticket waits for review', async () => {
    expect((await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner' })).status).toBe(400);

    const res = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner', reason: 'Elderly resident with chest pain' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
        medical_id: 'MED-001',
        shelter_id: 'SH-91',
        status: 'Awaiting review',
        doctor_id: null,
        reason: 'Elderly resident with chest pain',
    });
    expect((await knex('doctors').where({ doctor_id: 'DOC-91' }).first()).status).toBe('Available');
});

test('approving assigns the nearest hospital with that specialty', async () => {
    const res = await request(app).patch('/api/medical/MED-001/review').set('Authorization', AUTH)
        .send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        status: 'Dispatched',
        doctor_id: 'DOC-91',
        hospital_id: 'H-91',
    });
    expect((await knex('doctors').where({ doctor_id: 'DOC-91' }).first()).status).toBe('Dispatched');
});

test('falls back to the next-closest hospital when the nearest has no matching doctor', async () => {
    const created = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'Pediatrician', reason: 'Infant with high fever' });
    const res = await request(app).patch(`/api/medical/${created.body.medical_id}/review`).set('Authorization', AUTH)
        .send({ action: 'approve' });
    expect(res.body).toMatchObject({
        status: 'Dispatched',
        doctor_id: 'DOC-92',
        hospital_id: 'H-92',
    });
});

test('marks the ticket pending high urgency when no doctor is free', async () => {
    const first = await request(app).post('/api/medical').set('Authorization', AUTH)
        .send({ shelter_id: 'SH-92', specialty: 'Trauma Specialist', reason: 'Crush injury' });
    expect(first.body.status).toBe('Dispatched');

    const created = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'Trauma Specialist', reason: 'Second trauma case' });
    const second = await request(app).patch(`/api/medical/${created.body.medical_id}/review`).set('Authorization', AUTH)
        .send({ action: 'approve' });
    expect(second.body).toMatchObject({
        status: 'Pending Medical Dispatch - High Urgency',
        doctor_id: null,
        hospital_id: null,
    });
});

test('the shelter marks arrival, which frees the doctor and fills a waiting ticket', async () => {
    const waiting = await knex('medical_requests').where({ status: 'Pending Medical Dispatch - High Urgency' }).first();
    const dispatched = await knex('medical_requests').where({ doctor_id: 'DOC-93', status: 'Dispatched' }).first();
    expect((await request(app).patch(`/api/medical/${dispatched.medical_id}/complete`).set('Authorization', SHELTER)).status).toBe(403);

    const res = await request(app).patch(`/api/medical/${dispatched.medical_id}/complete`).set('Authorization', shelterAuth(dispatched.shelter_id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Completed');
    expect((await knex('medical_requests').where({ medical_id: waiting.medical_id }).first()).status).toBe('Dispatched');
    expect((await knex('doctors').where({ doctor_id: 'DOC-93' }).first()).status).toBe('Dispatched');
});

test('a shelter only sees its own medical tickets', async () => {
    const mine = await request(app).get('/api/medical').set('Authorization', SHELTER);
    expect(mine.status).toBe(200);
    expect(mine.body.every((row) => row.shelter_id === 'SH-91')).toBe(true);
});

test('approving can switch the specialty before dispatch', async () => {
    const created = await request(app).post('/api/medical').set('Authorization', SHELTER)
        .send({ specialty: 'General Practitioner', reason: 'Woman in labour, contractions every few minutes' });
    const res = await request(app).patch(`/api/medical/${created.body.medical_id}/review`).set('Authorization', AUTH)
        .send({ action: 'approve', specialty: 'Pediatrician' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        specialty: 'Pediatrician',
        status: 'Pending Medical Dispatch - High Urgency',
        doctor_id: null,
    });
});

test('warehouse cannot log a medical request', async () => {
    const res = await request(app).post('/api/medical').set('Authorization', warehouseAuth('WH-1'))
        .send({ specialty: 'General Practitioner', reason: 'Test' });
    expect(res.status).toBe(403);
});

test('a missing specialty is refused', async () => {
    const res = await request(app).post('/api/medical').set('Authorization', AUTH)
        .send({ shelter_id: 'SH-91', specialty: 'Cardiologist', reason: 'Heart' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Choose a medical specialty']);
});

test('JSON and CSV reports include doctor, specialty, hospital and travel distance', async () => {
    const json = await request(app).get('/api/reports/report.json').set('Authorization', AUTH);
    expect(json.status).toBe(200);
    const report = JSON.parse(json.text);
    expect(report.medical.length).toBeGreaterThan(0);
    expect(report.medical[0]).toEqual(expect.objectContaining({
        doctor_id: expect.anything(),
        specialty: expect.any(String),
        hospital_name: expect.anything(),
        travel_distance: expect.anything(),
    }));

    const csv = await request(app).get('/api/reports/medical.csv').set('Authorization', AUTH);
    expect(csv.status).toBe(200);
    expect(csv.text.split('\n')[0]).toBe('Doctor ID,Specialty,Hospital Name,Travel Distance');
    expect(csv.text).toContain('Pediatrician');
});
