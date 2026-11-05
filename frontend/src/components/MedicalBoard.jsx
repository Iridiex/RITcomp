import { useState } from 'react';
import { Check } from 'lucide-react';
import { API } from '../session';
import { IdLink } from '../inspect';

function badgeClass(status) {
    if (status === 'Dispatched') return 'allocated';
    if (status === 'Completed' || status === 'Available') return 'fulfilled';
    if (status === 'Rejected' || String(status).startsWith('Pending')) return 'unfulfilled';
    if (status === 'Awaiting review') return 'awaiting-review';
    return 'pending';
}

function distanceText(row) {
    if (row.distance == null) return '—';
    const km = row.distance_km != null ? row.distance_km : Number((row.distance * 111.32).toFixed(2));
    return `${Number(row.distance).toFixed(4)} (${km} km)`;
}

function MedicalBoard({ medical, hospitals, canComplete, onChanged }) {
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    const doctors = (hospitals || []).flatMap((h) => (h.doctors || []).map((d) => ({ ...d, hospital_name: h.name })));
    const pending = medical.filter((r) => String(r.status).startsWith('Pending'));
    const open = medical.filter((r) => r.status === 'Dispatched');

    async function complete(id) {
        setBusy(id);
        setError('');
        try {
            const res = await fetch(`${API}/medical/${id}/complete`, { method: 'PATCH' });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
            }
            await onChanged();
        } catch {
            setError('Could not reach the server');
        }
        setBusy(null);
    }

    return (
        <>
            <section className="card">
                <h2>Medical tickets</h2>
                {error && <p className="errors">{error}</p>}
                {medical.length === 0 ? (
                    <p className="muted">No medical requests yet.</p>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket</th>
                                    <th>Shelter</th>
                                    <th>Specialty</th>
                                    <th>Reason</th>
                                    <th>Doctor ID</th>
                                    <th>Hospital</th>
                                    <th>Travel distance</th>
                                    <th>Status</th>
                                    {canComplete && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {medical.map((row) => (
                                    <tr key={row.medical_id}>
                                        <td className="nowrap"><IdLink type="medical" id={row.medical_id} /></td>
                                        <td><IdLink type="shelter" id={row.shelter_id} label={row.shelter_name || row.shelter_id} /></td>
                                        <td>{row.specialty}</td>
                                        <td>{row.reason || '—'}</td>
                                        <td className="nowrap">
                                            {row.doctor_id ? <IdLink type="doctor" id={row.doctor_id} /> : '—'}
                                        </td>
                                        <td>
                                            {row.hospital_id
                                                ? <IdLink type="hospital" id={row.hospital_id} label={row.hospital_name || row.hospital_id} />
                                                : '—'}
                                        </td>
                                        <td className="nowrap">{distanceText(row)}</td>
                                        <td><span className={`badge ${badgeClass(row.status)}`}>{row.status}</span></td>
                                        {canComplete && (
                                            <td>
                                                {row.status === 'Dispatched' && (
                                                    <button className="secondary small icon-text" onClick={() => complete(row.medical_id)} disabled={busy === row.medical_id}>
                                                        <Check size={14} /> {busy === row.medical_id ? 'Saving…' : 'Doctor arrived'}
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {(pending.length > 0 || open.length > 0) && (
                    <p className="muted small-note">
                        {open.length} doctor(s) on the way
                        {pending.length > 0 ? ` · ${pending.length} waiting because no matching doctor is free` : ''}
                    </p>
                )}
            </section>

            {hospitals && (
                <section className="card">
                    <h2>On-call doctors</h2>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Doctor ID</th>
                                    <th>Name</th>
                                    <th>Specialty</th>
                                    <th>Hospital</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctors.map((d) => (
                                    <tr key={d.doctor_id}>
                                        <td className="nowrap"><IdLink type="doctor" id={d.doctor_id} /></td>
                                        <td><IdLink type="doctor" id={d.doctor_id} label={d.name} /></td>
                                        <td>{d.specialty}</td>
                                        <td><IdLink type="hospital" id={d.hospital_id} label={d.hospital_name} /></td>
                                        <td><span className={`badge ${badgeClass(d.status)}`}>{d.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </>
    );
}

export default MedicalBoard;
