import { useState } from 'react';
import { API } from '../session';

const CLOSABLE = ['Awaiting review', 'Pending', 'Partial', 'Unfulfilled'];

function CloseRequest({ request, onChanged }) {
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!CLOSABLE.includes(request.status)) return null;
    const owed = request.quantity - request.quantity_allocated;
    const sent = request.quantity_allocated;

    async function close(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`${API}/requests/${request.request_id}/close`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
            } else {
                setOpen(false);
                setNote('');
                await onChanged();
            }
        } catch {
            setError('Could not reach the server');
        }
        setBusy(false);
    }

    if (!open) {
        return (
            <div className="close-request">
                <p className="muted small-note">
                    No longer needed, or got it somewhere else? Close it so stock that arrives later goes to other shelters.
                </p>
                <button className="secondary small" onClick={() => setOpen(true)}>
                    {sent > 0 ? `Close the remaining ${owed}` : 'Cancel this request'}
                </button>
            </div>
        );
    }

    return (
        <form className="close-request open" onSubmit={close}>
            <p className="small-note">
                {sent > 0
                    ? `The ${sent} already sent still arrive. The other ${owed} ${request.item} will not be sent.`
                    : `Nothing has been sent yet, so the whole request is cancelled.`}
            </p>
            <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is it no longer needed?"
                maxLength={200}
                autoFocus
            />
            {error && <p className="errors">{error}</p>}
            <div className="row-actions">
                <button type="submit" className="danger small" disabled={busy || !note.trim()}>
                    {busy ? 'Closing…' : sent > 0 ? 'Close the rest' : 'Cancel request'}
                </button>
                <button type="button" className="secondary small" onClick={() => setOpen(false)} disabled={busy}>Keep waiting</button>
            </div>
        </form>
    );
}

export default CloseRequest;
