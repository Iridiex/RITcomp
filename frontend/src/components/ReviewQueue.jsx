import { IdLink } from '../inspect';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { API } from '../session';

// One row: its own urgency choice, note and error message
function ReviewRow({ request, shelterName, onChanged }) {
    const [urgency, setUrgency] = useState(request.urgency);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    async function review(action) {
        setError('');
        try {
            const res = await fetch(`${API}/requests/${request.request_id}/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, urgency, review_note: note }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
                return;
            }
            onChanged();
        } catch {
            setError('Could not reach the server');
        }
    }

    return (
        <tr>
            <td><IdLink type="request" id={request.request_id} /></td>
            <td><IdLink type="shelter" id={request.shelter_id} label={shelterName} /></td>
            <td>{request.quantity} {request.item}</td>
            <td className="review-reason">{request.reason || '-'}</td>
            <td>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Moderate">Moderate</option>
                </select>
                {request.ai_urgency && (request.ai_urgency === request.urgency ? (
                    <div className="ai-flag ok" title={request.ai_why || ''}><Sparkles size={13} /> Check agrees</div>
                ) : (
                    <div className="ai-flag warn">
                        <span><Sparkles size={13} /> Sounds <strong>{request.ai_urgency}</strong></span>
                        {request.ai_why && <span className="ai-flag-why">{request.ai_why}</span>}
                        {urgency !== request.ai_urgency && (
                            <button type="button" className="link-button" onClick={() => setUrgency(request.ai_urgency)}>Use {request.ai_urgency}</button>
                        )}
                    </div>
                ))}
            </td>
            <td>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed to reject)" />
            </td>
            <td>
                <div className="actions">
                    <button onClick={() => review('approve')}>Approve</button>
                    <button className="danger" onClick={() => review('reject')}>Reject</button>
                </div>
                {error && <div className="row-error">{error}</div>}
            </td>
        </tr>
    );
}

// The whole section: only requests that are Awaiting review
function ReviewQueue({ requests, shelters, onChanged }) {
    const waiting = requests.filter((r) => r.status === 'Awaiting review');
    const nameOf = (id) => {
        const shelter = shelters.find((s) => s.shelter_id === id);
        return shelter ? shelter.name : id;
    };

    return (
        <section className="card">
            <h2>Awaiting review ({waiting.length})</h2>
            {waiting.length === 0 ? (
                <p className="muted">No requests waiting for review.</p>
            ) : (
                <div className="table-wrap">
                    <table className="review">
                        <thead>
                            <tr>
                                <th>ID</th><th>Shelter</th><th>Request</th><th>Reason</th>
                                <th>Urgency</th><th>Note</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {waiting.map((r) => (
                                <ReviewRow key={r.request_id} request={r} shelterName={nameOf(r.shelter_id)} onChanged={onChanged} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export default ReviewQueue;
