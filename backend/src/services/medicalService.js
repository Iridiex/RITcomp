const knex = require('../db');
const { cleanText, isBlank } = require('../validation');
const { checkSpecialty } = require('../ai/specialty');
const {
    pickDoctor, SPECIALTIES, AVAILABLE, DISPATCHED, PENDING, COMPLETED, AWAITING, REJECTED,
} = require('../engine/medicalDispatch');

function nextMedicalId(rows) {
    const numbers = rows.map((r) => Number(String(r.medical_id).replace('MED-', '')) || 0);
    return `MED-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
}

function withNames(row) {
    return {
        ...row,
        distance_km: row.distance == null ? null : Number((row.distance * 111.32).toFixed(2)),
    };
}

async function listHospitals() {
    const [hospitals, doctors] = await Promise.all([
        knex('hospitals').orderBy('hospital_id'),
        knex('doctors').orderBy('doctor_id'),
    ]);
    return hospitals.map((h) => ({
        ...h,
        specialties: [...new Set(doctors.filter((d) => d.hospital_id === h.hospital_id).map((d) => d.specialty))],
        doctors: doctors.filter((d) => d.hospital_id === h.hospital_id),
    }));
}

async function listDoctors() {
    return knex('doctors')
        .leftJoin('hospitals', 'doctors.hospital_id', 'hospitals.hospital_id')
        .select('doctors.*', 'hospitals.name as hospital_name')
        .orderBy('doctors.doctor_id');
}

async function listMedical(shelterId) {
    const query = knex('medical_requests')
        .leftJoin('shelters', 'medical_requests.shelter_id', 'shelters.shelter_id')
        .leftJoin('hospitals', 'medical_requests.hospital_id', 'hospitals.hospital_id')
        .leftJoin('doctors', 'medical_requests.doctor_id', 'doctors.doctor_id')
        .select(
            'medical_requests.*',
            'shelters.name as shelter_name',
            'shelters.latitude as shelter_lat',
            'shelters.longitude as shelter_lng',
            'hospitals.name as hospital_name',
            'doctors.name as doctor_name',
            'doctors.specialty as doctor_specialty'
        )
        .orderBy('medical_requests.medical_id', 'desc');
    if (shelterId) query.where('medical_requests.shelter_id', shelterId);
    return (await query).map(withNames);
}

async function assignDoctor(trx, ticket, shelter) {
    const [hospitals, doctors] = await Promise.all([trx('hospitals'), trx('doctors')]);
    const pick = pickDoctor({ shelter, specialty: ticket.specialty, hospitals, doctors });
    if (!pick) {
        await trx('medical_requests').where({ medical_id: ticket.medical_id }).update({
            status: PENDING,
            doctor_id: null,
            hospital_id: null,
            distance: null,
            dispatched_at: null,
        });
        return { status: PENDING };
    }
    const updated = await trx('doctors')
        .where({ doctor_id: pick.doctor.doctor_id, status: AVAILABLE })
        .update({ status: DISPATCHED });
    if (updated === 0) {
        await trx('medical_requests').where({ medical_id: ticket.medical_id }).update({
            status: PENDING,
            doctor_id: null,
            hospital_id: null,
            distance: null,
            dispatched_at: null,
        });
        return { status: PENDING };
    }
    await trx('medical_requests').where({ medical_id: ticket.medical_id }).update({
        status: DISPATCHED,
        doctor_id: pick.doctor.doctor_id,
        hospital_id: pick.hospital.hospital_id,
        distance: pick.distance,
        dispatched_at: new Date().toISOString(),
    });
    return { status: DISPATCHED, doctor: pick.doctor, hospital: pick.hospital, distance: pick.distance };
}

async function createMedical(body) {
    body = body || {};
    const specialty = cleanText(body.specialty);
    const reason = cleanText(body.reason);
    const shelter = await knex('shelters').where({ shelter_id: body.shelter_id || '' }).first();
    const errors = [];
    if (!shelter) errors.push('Choose a shelter that exists');
    if (!SPECIALTIES.includes(specialty)) errors.push('Choose a medical specialty');
    if (isBlank(reason)) errors.push('Say why you need a doctor');
    if (errors.length > 0) return { errors };

    const check = await checkSpecialty({ specialty, reason });

    return knex.transaction(async (trx) => {
        const existing = await trx('medical_requests').select('medical_id');
        const medical_id = nextMedicalId(existing);
        const row = {
            medical_id,
            shelter_id: shelter.shelter_id,
            specialty,
            reason,
            ai_specialty: check ? check.suggested : null,
            ai_why: check ? check.why : null,
            status: AWAITING,
            doctor_id: null,
            hospital_id: null,
            distance: null,
            dispatched_at: null,
        };
        await trx('medical_requests').insert(row);
        if (body.submitted_by === 'coordinator') {
            const assigned = await assignDoctor(trx, row, shelter);
            row.status = assigned.status;
            row.doctor_id = assigned.doctor ? assigned.doctor.doctor_id : null;
            row.hospital_id = assigned.hospital ? assigned.hospital.hospital_id : null;
            row.distance = assigned.distance || null;
            row.hospital_name = assigned.hospital ? assigned.hospital.name : null;
            row.doctor_name = assigned.doctor ? assigned.doctor.name : null;
        }
        return { request: row };
    });
}

async function reviewMedical(id, body) {
    body = body || {};
    const note = cleanText(body.review_note);
    return knex.transaction(async (trx) => {
        const ticket = await trx('medical_requests').where({ medical_id: id }).first();
        if (!ticket) return { notFound: true };
        if (ticket.status !== AWAITING) return { errors: ['Only medical tickets awaiting review can be reviewed'] };

        if (body.action === 'reject') {
            if (isBlank(note)) return { errors: ['Give a reason for rejecting'] };
            await trx('medical_requests').where({ medical_id: id, status: AWAITING }).update({ status: REJECTED, review_note: note || null });
            return { row: { ...ticket, status: REJECTED, review_note: note } };
        }

        if (body.action !== 'approve') return { errors: ['Action must be approve or reject'] };

        const specialty = SPECIALTIES.includes(body.specialty) ? body.specialty : ticket.specialty;
        const shelter = await trx('shelters').where({ shelter_id: ticket.shelter_id }).first();
        await trx('medical_requests').where({ medical_id: id }).update({ specialty, review_note: note || null });
        const assigned = await assignDoctor(trx, { ...ticket, specialty }, shelter);
        const row = await trx('medical_requests').where({ medical_id: id }).first();
        return { row: { ...row, ...assigned } };
    });
}

// Free the doctor and try any tickets still waiting for that specialty, nearest first
async function completeMedical(id) {
    return knex.transaction(async (trx) => {
        const ticket = await trx('medical_requests').where({ medical_id: id }).first();
        if (!ticket) return { notFound: true };
        if (ticket.status !== DISPATCHED) return { errors: ['Only a dispatched doctor can be marked arrived'] };

        await trx('medical_requests').where({ medical_id: id }).update({
            status: COMPLETED,
            completed_at: new Date().toISOString(),
        });
        if (ticket.doctor_id) {
            await trx('doctors').where({ doctor_id: ticket.doctor_id }).update({ status: AVAILABLE });
        }

        const waiting = await trx('medical_requests').where({ status: PENDING, specialty: ticket.specialty }).orderBy('created_at');
        const filled = [];
        for (const next of waiting) {
            const shelter = await trx('shelters').where({ shelter_id: next.shelter_id }).first();
            const assigned = await assignDoctor(trx, next, shelter);
            if (assigned.status === DISPATCHED) filled.push(next.medical_id);
        }
        const updated = await trx('medical_requests').where({ medical_id: id }).first();
        return { row: updated, filled };
    });
}

module.exports = { listHospitals, listDoctors, listMedical, createMedical, reviewMedical, completeMedical, SPECIALTIES };
