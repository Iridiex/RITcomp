import { API } from './session';

async function call(path, method, body) {
    const res = await fetch(`${API}/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.errors || [data.error || 'Something went wrong']).join(', '));
    return data;
}

const RUN = {
    approve_request: async (a) => {
        await call(`requests/${a.request_id}/review`, 'PATCH', { action: 'approve', urgency: a.urgency });
        return `${a.request_id} approved as ${a.urgency}`;
    },
    reject_request: async (a) => {
        await call(`requests/${a.request_id}/review`, 'PATCH', { action: 'reject', review_note: a.note });
        return `${a.request_id} rejected`;
    },
    assign_driver: async (a) => {
        await call(`shipments/${a.shipment_id}/assign`, 'PATCH', { driver_id: a.driver_id });
        return `${a.shipment_id} given to ${a.driver_name || a.driver_id}`;
    },
    resolve_alert: async (a) => {
        await call(`incidents/${a.alert_id}/resolve`, 'PATCH');
        return 'Alert marked resolved';
    },
    run_allocation: async () => {
        const r = await call('allocations/run', 'POST');
        return `Allocation run: ${r.allocated} allocated, ${r.partial} partial, ${r.unfulfilled} unfulfilled · ${r.shipments} shipment(s) to ${r.drivers} driver(s)`;
    },
};

// Runs confirmed actions one at a time and stops at the first failure, so nothing runs on a broken assumption
export async function runActions(actions) {
    const results = [];
    for (const action of actions) {
        try {
            results.push({ ok: true, text: await RUN[action.type](action) });
        } catch (err) {
            results.push({ ok: false, text: `${action.summary.split(':')[0]} failed: ${err.message}` });
            break;
        }
    }
    return results;
}

// Only driver changes can be undone: the shipment goes back to whoever had it before
export function canUndo(action) {
    return action.type === 'assign_driver' && Boolean(action.previous_driver_id);
}

export async function undoAction(action) {
    await call(`shipments/${action.shipment_id}/assign`, 'PATCH', { driver_id: action.previous_driver_id });
    return `undone, ${action.shipment_id} is back with ${action.previous_driver_name || action.previous_driver_id}`;
}

// What the model is told about an earlier card, so it never assumes something happened that didn't
export function historyText(message) {
    if (!message.actions || message.actions.length === 0) return message.text;
    const outcome = {
        waiting: 'not confirmed yet',
        cancelled: 'the coordinator cancelled these, nothing was changed',
        expired: 'never confirmed, nothing was changed',
        done: (message.results || []).map((r) => (r.undone ? `${r.text} (later ${r.undone})` : r.text)).join('; '),
    }[message.state] || 'not confirmed';
    return `${message.text}\n[Prepared actions: ${message.actions.map((a) => a.summary).join(' | ')}. Outcome: ${outcome}]`;
}
