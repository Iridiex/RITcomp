import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API = 'http://localhost:3000/api';

function distanceKm([lat1, lng1], [lat2, lng2]) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeOf(s) {
    return [[Number(s.warehouse_lat), Number(s.warehouse_lng)], [Number(s.shelter_lat), Number(s.shelter_lng)]];
}

function FitRoute({ points }) {
    const map = useMap();
    const key = JSON.stringify(points);
    useEffect(() => {
        if (points.length > 0) map.fitBounds(points, { padding: [50, 50] });
    }, [key, map]);
    return null;
}

function DriverView({ drivers, shipments, onChanged }) {
    const [driverId, setDriverId] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [arrivingId, setArrivingId] = useState(null);
    const [damaged, setDamaged] = useState('0');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!driverId && drivers.length > 0) setDriverId(drivers[0].driver_id);
    }, [drivers, driverId]);

    const mine = shipments.filter((s) => s.driver_id === driverId);
    const active = mine.filter((s) => s.status !== 'Delivered');
    const done = mine.filter((s) => s.status === 'Delivered');
    const selected = active.find((s) => s.shipment_id === selectedId) || active[0];
    const route = selected ? routeOf(selected) : [];

    async function send(id, action, body) {
        setError('');
        setMessage('');
        try {
            const res = await fetch(`${API}/shipments/${id}/${action}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
                return false;
            }
            onChanged();
            return true;
        } catch (err) {
            setError('Could not reach the server');
            return false;
        }
    }

    async function pickUp(s) {
        if (await send(s.shipment_id, 'pickup')) {
            setMessage(`${s.shipment_id} picked up. Drive safe!`);
        }
    }

    function startArrive(s) {
        setArrivingId(s.shipment_id);
        setDamaged('0');
        setNote('');
        setError('');
    }

    async function confirmArrive(s) {
        if (await send(s.shipment_id, 'deliver', { damaged, damage_note: note })) {
            setArrivingId(null);
            setMessage(
                Number(damaged) > 0
                    ? `${s.shipment_id} delivered. ${damaged} damaged item(s) reported, a replacement goes back in the queue.`
                    : `${s.shipment_id} delivered.`
            );
        }
    }

    function changeDriver(id) {
        setDriverId(id);
        setSelectedId(null);
        setArrivingId(null);
        setMessage('');
        setError('');
    }

    return (
        <>
            <section className="card driver-bar">
                <label className="viewing-as">
                    Viewing as
                    <select value={driverId} onChange={(e) => changeDriver(e.target.value)}>
                        {drivers.map((d) => (
                            <option key={d.driver_id} value={d.driver_id}>{d.name}</option>
                        ))}
                    </select>
                </label>
                <span className="muted small-note">Replaced by the driver's own login later</span>
            </section>

            {message && <p className="success">{message}</p>}
            {error && <p className="errors">{error}</p>}

            <div className="driver-grid">
                <div>
                    <section className="card">
                        <h2>My deliveries ({active.length})</h2>
                        {active.length === 0 ? (
                            <p className="muted">No deliveries assigned right now.</p>
                        ) : (
                            active.map((s) => (
                                <div
                                    key={s.shipment_id}
                                    className={`delivery ${selected && selected.shipment_id === s.shipment_id ? 'selected' : ''}`}
                                    onClick={() => setSelectedId(s.shipment_id)}
                                >
                                    <div className="delivery-top">
                                        <strong>{s.shipment_id}</strong>
                                        <span className={`badge ${s.status.toLowerCase().replace(' ', '-')}`}>{s.status}</span>
                                    </div>
                                    <div className="delivery-load">{s.quantity} {s.item}</div>
                                    <div className="delivery-route">
                                        <span>From <strong>{s.warehouse_name}</strong></span>
                                        <span>To <strong>{s.shelter_name}</strong></span>
                                        <span className="muted">About {distanceKm(...routeOf(s)).toFixed(1)} km straight-line</span>
                                    </div>

                                    <div className="steps">
                                        <span className="step done">Assigned</span>
                                        <span className={`step ${s.status === 'In transit' ? 'done' : ''}`}>Picked up</span>
                                        <span className="step">Delivered</span>
                                    </div>

                                    {s.status === 'Ready' && (
                                        <button onClick={(e) => { e.stopPropagation(); pickUp(s); }}>Picked up</button>
                                    )}

                                    {s.status === 'In transit' && arrivingId !== s.shipment_id && (
                                        <button onClick={(e) => { e.stopPropagation(); startArrive(s); }}>Arrived</button>
                                    )}

                                    {arrivingId === s.shipment_id && (
                                        <div className="arrive-form" onClick={(e) => e.stopPropagation()}>
                                            <label>
                                                Damaged items
                                                <input type="number" min="0" max={s.quantity} value={damaged} onChange={(e) => setDamaged(e.target.value)} />
                                            </label>
                                            {Number(damaged) > 0 && (
                                                <label>
                                                    What happened?
                                                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 5 bottles crushed in transit" />
                                                </label>
                                            )}
                                            <div className="actions">
                                                <button onClick={() => confirmArrive(s)}>Confirm delivery</button>
                                                <button className="secondary" onClick={() => setArrivingId(null)}>Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </section>

                    {done.length > 0 && (
                        <section className="card">
                            <h2>Completed ({done.length})</h2>
                            <ul className="done-list">
                                {done.map((s) => (
                                    <li key={s.shipment_id}>
                                        <strong>{s.shipment_id}</strong> · {s.quantity} {s.item} to {s.shelter_name}
                                        {s.quantity_damaged > 0 && <span className="damage-note"> · {s.quantity_damaged} damaged</span>}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <section className="card">
                    <h2>Route</h2>
                    <p className="muted small-note">
                        {selected ? `${selected.warehouse_name} → ${selected.shelter_name}` : 'Select a delivery to see its route'}
                    </p>
                    <MapContainer center={[25.2, 55.3]} zoom={11} className="map driver-map">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {selected && (
                            <>
                                <Polyline
                                    key={selected.shipment_id + selected.status}
                                    positions={route}
                                    pathOptions={{ color: '#2563eb', weight: 5, dashArray: selected.status === 'Ready' ? '8 10' : null }}
                                />
                                <CircleMarker center={route[0]} radius={10} pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.9 }}>
                                    <Tooltip permanent direction="top" offset={[0, -10]}>Pick up: {selected.warehouse_name}</Tooltip>
                                </CircleMarker>
                                <CircleMarker center={route[1]} radius={10} pathOptions={{ color: '#b91c1c', fillColor: '#dc2626', fillOpacity: 0.9 }}>
                                    <Tooltip permanent direction="top" offset={[0, -10]}>Drop off: {selected.shelter_name}</Tooltip>
                                </CircleMarker>
                                <FitRoute points={route} />
                            </>
                        )}
                    </MapContainer>
                    {selected && (
                        <a
                            className="button-link secondary nav-link"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://www.google.com/maps/dir/?api=1&origin=${route[0].join(',')}&destination=${route[1].join(',')}`}
                        >
                            Open directions in Google Maps ↗
                        </a>
                    )}
                </section>
            </div>
        </>
    );
}

export default DriverView;
