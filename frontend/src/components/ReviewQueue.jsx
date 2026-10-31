import { IdLink } from '../inspect';
import { useState } from 'react';

const API = 'http://localhost:3000/api';

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
        } catch (err) {
            setError('Could not reach the server');
        }
    }

    return (
        <tr>
            <td><IdLink type="request" id={request.request_id} /></td>
            <td><IdLink type="shelter" id={request.shelter_id} label={shelterName} /></td>
            <td>{request.quantity} {request.item}</td>
            <td>{request.reason || '-'}</td>
            <td>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Moderate">Moderate</option>
                </select>
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
            )}
        </section>
    );
}

export default ReviewQueue;
