const knex = require('../db');
const { validateNewRequest, URGENCIES } = require('../validation');

async function createRequest(body) {
    const shelters = await knex('shelters').select('shelter_id');
    const shelterIds = shelters.map((s) => s.shelter_id);
    const errors = validateNewRequest(body, shelterIds);
    if (errors.length > 0) {
        return { errors };
    }

    const rows = await knex('requests').select('request_id');
    const numbers = rows.map((r) => Number(r.request_id.replace('RQ-', '')) || 0);
    const next = Math.max(0, ...numbers) + 1;
    const request_id = `RQ-${String(next).padStart(3, '0')}`;

    const status = body.submitted_by === 'shelter' ? 'Awaiting review' : 'Pending';

    const request = {
        request_id,
        shelter_id: body.shelter_id,
        item: body.item.trim().toLowerCase(),
        quantity: Number(body.quantity),
        urgency: body.urgency,
        reason: body.reason ? body.reason.trim() : null,
        status,
    };

    await knex('requests').insert(request);

    return { request };
}

async function reviewRequest(requestId, body) {
    const request = await knex('requests').where({ request_id: requestId }).first();
    if (!request) {
        return { notFound: true };
    }

    if (request.status !== 'Awaiting review') {
        return { errors: ['Only requests awaiting review can be reviewed'] };
    }

    if (body.action === 'approve') {
        const urgency = body.urgency || request.urgency;
        if (!URGENCIES.includes(urgency)) {
            return { errors: ['Urgency must be Critical, High or Moderate'] };
        }
        await knex('requests').where({ request_id: requestId })
            .update({ status: 'Pending', urgency, review_note: body.review_note || null });
        return { request: {...request, status: 'Pending', urgency, review_note: body.review_note || null } };
    }

    if (body.action === 'reject') {
        if (!body.review_note || body.review_note.trim() === '') {
            return { errors: ['Give a reason for rejecting'] };
        }
        await knex('requests').where({ request_id: requestId })
            .update({ status: 'Rejected', review_note: body.review_note.trim() });
        return { request: {...request, status: 'Rejected', review_note: body.review_note.trim() } };
    }

    return { errors: ['Action must be approve or reject'] };
}

module.exports = { createRequest, reviewRequest };