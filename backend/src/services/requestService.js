const knex = require('../db');
const { validateNewRequest, cleanText, isBlank, URGENCIES } = require('../validation');
const { checkUrgency } = require('../ai/urgency');

async function listItems() {
    const rows = await knex('inventory').distinct('item').orderBy('item');
    return rows.map((r) => ({ item: r.item }));
}

async function createRequest(body) {
    body = body || {};
    const shelters = await knex('shelters').select('shelter_id');
    const shelterIds = shelters.map((s) => s.shelter_id);
    const knownItems = (await listItems()).map((i) => i.item);
    const errors = validateNewRequest(body, shelterIds, knownItems);
    if (errors.length > 0) {
        return { errors };
    }

    const status = body.submitted_by === 'shelter' ? 'Awaiting review' : 'Pending';
    const item = cleanText(body.item).toLowerCase();
    const reason = cleanText(body.reason) || null;
    const check = await checkUrgency({ item, quantity: body.quantity, reason });

    const request = {
        shelter_id: body.shelter_id,
        item,
        quantity: Number(body.quantity),
        urgency: body.urgency,
        reason,
        status,
        ai_urgency: check ? check.suggested : null,
        ai_why: check ? check.why : null,
    };

    await knex.transaction(async (trx) => {
        const rows = await trx('requests').select('request_id');
        const numbers = rows.map((r) => Number(r.request_id.replace('RQ-', '')) || 0);
        request.request_id = `RQ-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
        await trx('requests').insert(request);
    });

    return { request };
}

async function reviewRequest(requestId, body) {
    body = body || {};
    const note = cleanText(body.review_note);
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
        const updated = await knex('requests').where({ request_id: requestId, status: 'Awaiting review' })
            .update({ status: 'Pending', urgency, review_note: note || null });
        if (updated === 0) return { errors: ['This request was already reviewed'] };
        return { request: {...request, status: 'Pending', urgency, review_note: note || null } };
    }

    if (body.action === 'reject') {
        if (isBlank(note)) {
            return { errors: ['Give a reason for rejecting'] };
        }
        const updated = await knex('requests').where({ request_id: requestId, status: 'Awaiting review' })
            .update({ status: 'Rejected', review_note: note });
        if (updated === 0) return { errors: ['This request was already reviewed'] };
        return { request: {...request, status: 'Rejected', review_note: note } };
    }

    return { errors: ['Action must be approve or reject'] };
}

const CLOSABLE = ['Awaiting review', 'Pending', 'Partial', 'Unfulfilled'];

// Stops waiting for whatever has not been sent yet. Anything already on a truck still arrives.
async function closeRequest(requestId, body) {
    body = body || {};
    const note = cleanText(body.note);
    const request = await knex('requests').where({ request_id: requestId }).first();
    if (!request) return { notFound: true };
    if (!CLOSABLE.includes(request.status)) {
        return { errors: ['Only requests that are still waiting for stock or review can be closed'] };
    }
    if (isBlank(note)) return { errors: ['Say why it is no longer needed'] };

    const sent = request.quantity_allocated;
    let status = 'Allocated';
    if (sent === 0) status = 'Cancelled';
    else if (request.quantity_delivered >= sent) status = 'Fulfilled';
    const changes = {
        status,
        quantity: sent,
        quantity_closed: request.quantity_closed + request.quantity - sent,
        close_note: note,
        replacement_pending: false,
    };

    const updated = await knex('requests')
        .where({ request_id: requestId, status: request.status, quantity_allocated: sent })
        .update(changes);
    if (updated === 0) return { errors: ['This request changed while you were closing it. Refresh and try again.'] };
    return { request: { ...request, ...changes } };
}

module.exports = { closeRequest, createRequest, reviewRequest, listItems };