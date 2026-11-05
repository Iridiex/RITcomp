import { useState } from 'react';
import LocationPicker from './LocationPicker';
import { API } from '../session';

function HospitalForm({ hospital, otherSites, onSaved, onCancel }) {
    const editing = hospital !== null;
    const [name, setName] = useState(editing ? hospital.name : '');
    const [latitude, setLatitude] = useState(editing ? Number(hospital.latitude) : '');
    const [longitude, setLongitude] = useState(editing ? Number(hospital.longitude) : '');
    const [errors, setErrors] = useState([]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        try {
            const res = await fetch(editing ? `${API}/hospitals/${hospital.hospital_id}` : `${API}/hospitals`, {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, latitude, longitude }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            onSaved(`${data.hospital_id} ${data.name} ${editing ? 'updated' : 'registered'}.`);
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <label className="full">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rashid Hospital" />
            </label>
            <div className="full">
                <LocationPicker
                    latitude={latitude}
                    longitude={longitude}
                    otherSites={otherSites}
                    onPick={(lat, lng) => {
                        setLatitude(lat);
                        setLongitude(lng);
                    }}
                />
            </div>
            {errors.length > 0 && (
                <ul className="errors full">
                    {errors.map((err) => <li key={err}>{err}</li>)}
                </ul>
            )}
            <div className="actions full">
                <button type="submit">{editing ? 'Save changes' : 'Register hospital'}</button>
                <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

export default HospitalForm;
