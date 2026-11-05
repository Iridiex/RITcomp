import { IdLink } from '../inspect';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { API } from '../session';
import { SPECIALTIES } from '../specialties';

function ReviewRow({ ticket, onChanged }) {
    const [specialty, setSpecialty] = useState(ticket.specialty);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    async function review(action) {
        setError('');
        try {
            const res = await fetch(`${API}/medical/${ticket.medical_id}/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, specialty, review_note: note }),
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
            <td><IdLink type="medical" id={ticket.medical_id} /></td>
            <td><IdLink type="shelter" id={ticket.shelter_id} label={ticket.shelter_name || ticket.shelter_id} /></td>
            <td>
                <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                    {SPECIALTIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                {ticket.ai_specialty && (ticket.ai_specialty === ticket.specialty ? (
                    <div className="ai-flag ok" title={ticket.ai_why || ''}><Sparkles size={13} /> Check agrees</div>
                ) : (
                    <div className="ai-flag warn">
                        <span><Sparkles size={13} /> Sounds <strong>{ticket.ai_specialty}</strong></span>
                        {ticket.ai_why && <span className="ai-flag-why">{ticket.ai_why}</span>}
                        {specialty !== ticket.ai_specialty && (
                            <button type="button" className="link-button" onClick={() => setSpecialty(ticket.ai_specialty)}>Use {ticket.ai_specialty}</button>
                        )}
                    </div>
                ))}
            </td>
            <td className="review-reason">{ticket.reason || '—'}</td>
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

function MedicalReviewQueue({ medical, onChanged }) {
    const waiting = medical.filter((r) => r.status === 'Awaiting review');

    return (
        <section className="card">
            <h2>Medical review ({waiting.length})</h2>
            {waiting.length === 0 ? (
                <p className="muted">No doctor requests waiting for review.</p>
            ) : (
                <div className="table-wrap">
                    <table className="review">
                        <thead>
                            <tr>
                                <th>ID</th><th>Shelter</th><th>Specialty</th><th>Reason</th>
                                <th>Note</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {waiting.map((r) => (
                                <ReviewRow key={r.medical_id} ticket={r} onChanged={onChanged} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export default MedicalReviewQueue;
