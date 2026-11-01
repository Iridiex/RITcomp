import { useState } from 'react';
import LocationPicker from './LocationPicker';
import LoginFields from './LoginFields';
import { API } from '../session';
import { NO_LOGIN, loginNote } from '../accounts';

function SiteForm({ kind, site, currentLogin, otherSites, onSaved, onCancel }) {
    const isShelter = kind === 'shelter';
    const idField = isShelter ? 'shelter_id' : 'warehouse_id';
    const label = isShelter ? 'shelter' : 'warehouse';
    const editing = site !== null;

    const [name, setName] = useState(editing ? site.name : '');
    const [priority, setPriority] = useState(editing && site.priority ? String(site.priority) : '2');
    const [latitude, setLatitude] = useState(editing ? Number(site.latitude) : '');
    const [longitude, setLongitude] = useState(editing ? Number(site.longitude) : '');
    const [login, setLogin] = useState(NO_LOGIN);
    const [errors, setErrors] = useState([]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        const path = isShelter ? 'shelters' : 'warehouses';
        const url = editing ? `${API}/${path}/${site[idField]}` : `${API}/${path}`;
        const body = { name, latitude, longitude, login };
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
            onSaved(`${data[idField]} ${data.name} ${editing ? 'updated' : 'registered'}.${loginNote(login, data.username)}`);
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <label>
                Name
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isShelter ? 'e.g. Karama Sports Hall' : 'e.g. Al Quoz Relief Depot'}
                />
            </label>

            {isShelter && (
                <label>
                    Priority
                    <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                        <option value="1">1: highest (many vulnerable people)</option>
                        <option value="2">2: Moderate</option>
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

            <LoginFields current={currentLogin} value={login} onChange={setLogin} />

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
