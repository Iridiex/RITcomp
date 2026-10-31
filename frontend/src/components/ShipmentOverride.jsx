import { useState } from 'react';
import { API } from '../session';

// For when the driver cannot update the app themselves: the coordinator records what happened after a phone call.
function ShipmentOverride({ shipment, role, onChanged }) {
    const [failing, setFailing] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const canAct =
        (role === 'coordinator' && ['In transit', 'Returning'].includes(shipment.status)) ||
        (role === 'warehouse' && shipment.status === 'Returning');
    if (!canAct) return null;

    async function send(action, body) {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`${API}/shipments/${shipment.shipment_id}/${action}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
            const data = await res.json();
            if (!res.ok) setError((data.errors || [data.error]).join(', '));
            else {
                setFailing(false);
                setReason('');
                await onChanged();
            }
        } catch {
            setError('Could not reach the server');
        }
        setBusy(false);
    }

    return (
        <div className="close-request">
            {shipment.status === 'In transit' ? (
                <>
                    <p className="muted small-note">Driver can't update the app? Record what happened after you speak to them.</p>
                    {failing ? (
                        <form onSubmit={(e) => { e.preventDefault(); send('fail', { reason }); }}>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What went wrong?" maxLength={200} autoFocus />
                            <div className="row-actions">
                                <button type="submit" className="danger small" disabled={busy || !reason.trim()}>
                                    {busy ? 'Saving…' : "Couldn't deliver"}
                                </button>
                                <button type="button" className="secondary small" onClick={() => setFailing(false)} disabled={busy}>Back</button>
                            </div>
                        </form>
                    ) : (
                        <div className="row-actions">
                            <button className="small" onClick={() => send('deliver')} disabled={busy}>
                                {busy ? 'Saving…' : 'Mark delivered'}
                            </button>
                            <button className="secondary small" onClick={() => setFailing(true)} disabled={busy}>Couldn't deliver</button>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <p className="muted small-note">Once the goods are physically back, confirm it so they go back into stock.</p>
                    <button className="small" onClick={() => send('return')} disabled={busy}>
                        {busy ? 'Saving…' : `Confirm it's back at ${shipment.warehouse_name}`}
                    </button>
                </>
            )}
            {error && <p className="errors">{error}</p>}
        </div>
    );
}

export default ShipmentOverride;
