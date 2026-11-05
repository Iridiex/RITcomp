const knex = require('../db');
const { validateDoctor, cleanText } = require('../validation');
const { nextId } = require('../ids');
const { SPECIALTIES, AVAILABLE, DISPATCHED } = require('../engine/medicalDispatch');

function cleanDoctor(body) {
    return {
        name: cleanText(body.name),
        specialty: cleanText(body.specialty),
        hospital_id: body.hospital_id,
    };
}

async function createDoctor(body) {
    body = body || {};
    const hospitals = (await knex('hospitals').select('hospital_id')).map((h) => h.hospital_id);
    const errors = validateDoctor(body, hospitals);
    if (!SPECIALTIES.includes(cleanText(body.specialty))) errors.push('Choose a medical specialty');
    if (errors.length > 0) return { errors };
    const row = {
        doctor_id: await nextId('DOC-', 2, [['doctors', 'doctor_id'], ['medical_requests', 'doctor_id']]),
        status: AVAILABLE,
        ...cleanDoctor(body),
    };
    await knex('doctors').insert(row);
    return { site: row };
}

async function updateDoctor(id, body) {
    body = body || {};
    const existing = await knex('doctors').where({ doctor_id: id }).first();
    if (!existing) return { notFound: true };
    const hospitals = (await knex('hospitals').select('hospital_id')).map((h) => h.hospital_id);
    const errors = validateDoctor(body, hospitals);
    if (!SPECIALTIES.includes(cleanText(body.specialty))) errors.push('Choose a medical specialty');
    if (existing.status === DISPATCHED && body.hospital_id !== existing.hospital_id) {
        errors.push('This doctor is on a call. Mark them arrived before moving hospital');
    }
    if (errors.length > 0) return { errors };
    const changes = cleanDoctor(body);
    await knex('doctors').where({ doctor_id: id }).update(changes);
    return { site: { ...existing, ...changes } };
}

async function deleteDoctor(id) {
    const existing = await knex('doctors').where({ doctor_id: id }).first();
    if (!existing) return { notFound: true };
    if (existing.status === DISPATCHED) {
        return { errors: [id + ' is on a call and cannot be deleted'] };
    }
    const linked = await knex('medical_requests').where({ doctor_id: id }).whereIn('status', ['Dispatched', 'Pending Medical Dispatch - High Urgency']).count({ n: '*' }).first();
    if (Number(linked.n) > 0) {
        return { errors: [id + ' is still tied to an open medical ticket'] };
    }
    await knex('doctors').where({ doctor_id: id }).del();
    return { site: existing };
}

module.exports = { createDoctor, updateDoctor, deleteDoctor };
