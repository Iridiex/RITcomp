import { useState } from 'react';
import { API } from '../session';
import { SPECIALTIES } from '../specialties';

function DoctorForm({ doctor, hospitals, onSaved, onCancel }) {
    const editing = doctor !== null;
    const [name, setName] = useState(editing ? doctor.name : '');
    const [specialty, setSpecialty] = useState(editing ? doctor.specialty : '');
    const [hospitalId, setHospitalId] = useState(editing ? doctor.hospital_id : '');
    const [errors, setErrors] = useState([]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        try {
            const res = await fetch(editing ? `${API}/doctors/${doctor.doctor_id}` : `${API}/doctors`, {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, specialty, hospital_id: hospitalId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            onSaved(`${data.doctor_id} ${data.name} ${editing ? 'updated' : 'added'}.`);
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Ali" />
            </label>
            <label>
                Specialty
                <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                    <option value="">Choose a specialty</option>
                    {SPECIALTIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </label>
            <label className="full">
                Hospital
                <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
                    <option value="">Choose a hospital</option>
                    {(hospitals || []).map((h) => (
                        <option key={h.hospital_id} value={h.hospital_id}>{h.name}</option>
                    ))}
                </select>
            </label>
            {errors.length > 0 && (
                <ul className="errors full">
                    {errors.map((err) => <li key={err}>{err}</li>)}
                </ul>
            )}
            <div className="actions full">
                <button type="submit">{editing ? 'Save changes' : 'Add doctor'}</button>
                <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

export default DoctorForm;
