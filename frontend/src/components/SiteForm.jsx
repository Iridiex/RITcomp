import { useState } from 'react';
import LocationPicker from './LocationPicker';

const API = 'http://localhost:3000/api';

function SiteForm({ kind, site, otherSites, onSaved, onCancel }) {
    const isShelter = kind === 'shelter';
    const idField = isShelter ? 'shelter_id' : 'warehouse_id';
    const label = isShelter ? 'shelter' : 'warehouse';
    const editing = site !== null;

    const [name, setName] = useState(editing ? site.name : '');
    const [priority, setPriority] = useState(editing && site.priority ? String(site.priority) : '2');
    const [latitude, setLatitude] = useState(editing ? Number(site.latitude) : '');
    const [longitude, setLongitude] = useState(editing ? Number(site.longitude) : '');
    const [errors, setErrors] = useState([]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        const path = isShelter ? 'shelters' : 'warehouses';
        const url = editing ? `${API}/${path}/${site[idField]}` : `${API}/${path}`;
        const body = { name, latitude, longitude };
        if (isShelter) body.priority = Number(priority);

        try {
            const res = await fetch(url, {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            onSaved(`${data[idField]} ${data.name} ${editing ? 'updated' : 'registered'}`);
        } catch (err) {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <h3 className="full form-title">{editing ? `Edit ${site[idField]}` : `Register a new ${label}`}</h3>

            <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isShelter ? 'e.g. Karama Sports Hall' : 'e.g. Al Quoz Relief Depot'} />
            </label>

            {isShelter && (
                <label>
                    Priority
                    <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                        <option value="1">1: highest (many vulnerable people)</option>
                        <option value="2">2: medium</option>
                        <option value="3">3: lower</option>
                    </select>
                </label>
            )}

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
                <button type="submit">{editing ? 'Save changes' : `Register ${label}`}</button>
                <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

export default SiteForm;
