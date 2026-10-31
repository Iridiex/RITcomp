import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { API } from '../session';
import LoadAmount from './LoadAmount';
import SpeechInput from './SpeechInput';
import RouteAlert from './RouteAlert';
import { failureText } from '../noteLanguage';

const ACTIVE = ['Ready', 'In transit', 'Returning'];

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
        const fit = JSON.parse(key);
        if (fit.length > 0) map.fitBounds(fit, { padding: [50, 50] });
    }, [key, map]);
    return null;
}

function DriverView({ drivers, shipments, incidents = [], onChanged, fixedDriverId }) {
    const [chosenDriverId, setChosenDriverId] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    // { id, kind: 'deliver' | 'fail' | 'return' } while the driver fills in the arrival, failure or drop-off form
    const [finishing, setFinishing] = useState(null);
    const [damaged, setDamaged] = useState('0');
    const [note, setNote] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const driverId = fixedDriverId || chosenDriverId || (drivers[0] ? drivers[0].driver_id : '');
    const mine = shipments.filter((s) => s.driver_id === driverId);
    const active = mine.filter((s) => ACTIVE.includes(s.status));
    const done = mine.filter((s) => !ACTIVE.includes(s.status));
    const selected = active.find((s) => s.shipment_id === selectedId) || active[0];
    const goingBack = selected && selected.status === 'Returning';
    const route = selected ? routeOf(selected) : [];
    const directions = goingBack
        ? `https://www.google.com/maps/dir/?api=1&destination=${route[0]?.join(',')}`
        : `https://www.google.com/maps/dir/?api=1&origin=${route[0]?.join(',')}&destination=${route[1]?.join(',')}`;

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
                return null;
            }
            onChanged();
            return data;
        } catch {
            setError('Could not reach the server');
            return null;
        }
    }

    function replacementNote(data, lost) {
        if (lost === 0) return '';
        return data.replacements.length > 0
            ? ` A replacement for the missing ${lost} is on its way (${data.replacements.join(', ')}).`
            : ` The missing ${lost} will be sent automatically once stock is available.`;
    }

    async function pickUp(s, body) {
        const data = await send(s.shipment_id, 'pickup', body);
        if (data) {
            setFinishing(null);
            const lost = Number(body?.damaged || 0);
            const note = lost > 0 ? ` ${lost} damaged item(s) left at the warehouse.${replacementNote(data, lost)}` : '';
            setMessage(`${s.shipment_id} picked up.${note} Drive safe!`);
        }
    }

    function startFinish(s, kind) {
        setFinishing({ id: s.shipment_id, kind });
        setDamaged('0');
        setNote('');
        setReason('');
        setError('');
    }

    async function confirmArrive(s) {
        const data = await send(s.shipment_id, 'deliver', { damaged, damage_note: note });
        if (data) {
            setFinishing(null);
            const lost = Number(damaged);
            setMessage(lost > 0
                ? `${s.shipment_id} delivered with ${lost} damaged item(s).${replacementNote(data, lost)}`
                : `${s.shipment_id} delivered.`);
        }
    }

    async function confirmFail(s) {
        const data = await send(s.shipment_id, 'fail', { reason, damaged, damage_note: note });
        if (data) {
            setFinishing(null);
            const replaced = data.replacements.length > 0
                ? 'A replacement has been sent to the shelter.'
                : 'No spare stock right now, so the shelter gets the next stock that comes in, including this load once you drop it off.';
            setMessage(`${s.shipment_id} not delivered. Take the load back to ${s.warehouse_name} and tap "Back at warehouse" when you drop it off. ${replaced}`);
        }
    }

    async function confirmReturn(s) {
        const data = await send(s.shipment_id, 'return', { damaged, damage_note: note });
        if (data) {
            setFinishing(null);
            const resent = data.replacements.length > 0
                ? ` Sent straight out again to waiting shelters (${data.replacements.join(', ')}).`
                : '';
            setMessage(`${s.shipment_id} dropped off at ${s.warehouse_name}. ${data.returned} ${s.item} back in stock.${resent}`);
        }
    }

    function changeDriver(id) {
        setChosenDriverId(id);
        setSelectedId(null);
        setFinishing(null);
        setMessage('');
        setError('');
    }

    return (
        <>
            {!fixedDriverId && (
            <section className="card driver-bar">
                <label className="viewing-as">
                    Viewing as
                    <select value={driverId} onChange={(e) => changeDriver(e.target.value)}>
                        {drivers.map((d) => (
                            <option key={d.driver_id} value={d.driver_id}>{d.name}</option>
                        ))}
                    </select>
                </label>
                <span className="muted small-note">Coordinator preview of a driver's screen</span>
            </section>
            )}

            {message && <p className="success">{message}</p>}
            {error && <p className="errors">{error}</p>}

            <div className="driver-grid">
                <div>
                    <section className="card">
                        <h2>My deliveries ({active.length})</h2>
                        {active.length === 0 ? (
                            <p className="muted">No deliveries assigned right now.</p>
                        ) : (
                            active.map((s) => {
                                const onBoard = s.quantity - s.quantity_damaged;
                                const isFinishing = finishing && finishing.id === s.shipment_id;
                                const failing = isFinishing && finishing.kind === 'fail';
                                const returning = s.status === 'Returning';
                                const confirm = {
                                    pickup: <button onClick={() => pickUp(s, { damaged, damage_note: note })}>Picked up</button>,
                                    deliver: <button onClick={() => confirmArrive(s)}>Confirm delivery</button>,
                                    fail: <button className="danger" onClick={() => confirmFail(s)}>Head back to warehouse</button>,
                                    return: <button onClick={() => confirmReturn(s)}>Confirm drop-off</button>,
                                };
                                return (
                                <div
                                    key={s.shipment_id}
                                    className={`delivery ${selected && selected.shipment_id === s.shipment_id ? 'selected' : ''}`}
                                    onClick={() => setSelectedId(s.shipment_id)}
                                >
                                    <div className="delivery-top">
                                        <strong>{s.shipment_id}</strong>
                                        <span className={`badge ${s.status.toLowerCase().replace(' ', '-')}`}>{s.status}</span>
                                    </div>
                                    <div className="delivery-load"><LoadAmount shipment={s} shipments={shipments} quantity={onBoard} /></div>
                                    {returning ? (
                                        <div className="delivery-route">
                                            <span>Take it back to <strong>{s.warehouse_id} · {s.warehouse_name}</strong></span>
                                            <span className="damage-note">Couldn't reach {s.shelter_name}: <span dir="auto">{failureText(s, 'original')}</span></span>
                                        </div>
                                    ) : (
                                        <div className="delivery-route">
                                            <span>From <strong>{s.warehouse_id} · {s.warehouse_name}</strong></span>
                                            <span>To <strong>{s.shelter_id} · {s.shelter_name}</strong> for {s.request_id}</span>
                                            <span className="muted">About {distanceKm(...routeOf(s)).toFixed(1)} km straight-line</span>
                                        </div>
                                    )}

                                    {!returning && incidents
                                        .filter((a) => a.shelter_id === s.shelter_id && a.shipment_id !== s.shipment_id)
                                        .map((a) => <RouteAlert key={a.id} alert={a} />)}

                                    <div className="steps">
                                        <span className="step done">Assigned</span>
                                        <span className={`step ${s.status !== 'Ready' ? 'done' : ''}`}>Picked up</span>
                                        {returning ? (
                                            <>
                                                <span className="step failed">Couldn't deliver</span>
                                                <span className="step">Back at warehouse</span>
                                            </>
                                        ) : (
                                            <span className="step">Delivered</span>
                                        )}
                                    </div>

                                    {s.status === 'Ready' && !isFinishing && (
                                        <div className="actions">
                                            <button onClick={(e) => { e.stopPropagation(); pickUp(s); }}>Picked up</button>
                                            <button className="secondary" onClick={(e) => { e.stopPropagation(); startFinish(s, 'pickup'); }}>Some items damaged</button>
                                        </div>
                                    )}

                                    {s.status === 'In transit' && !isFinishing && (
                                        <div className="actions">
                                            <button onClick={(e) => { e.stopPropagation(); startFinish(s, 'deliver'); }}>Arrived</button>
                                            <button className="danger-outline" onClick={(e) => { e.stopPropagation(); startFinish(s, 'fail'); }}>Couldn't deliver</button>
                                        </div>
                                    )}

                                    {returning && !isFinishing && (
                                        <button onClick={(e) => { e.stopPropagation(); startFinish(s, 'return'); }}>Back at warehouse</button>
                                    )}

                                    {isFinishing && (
                                        <div className="arrive-form" onClick={(e) => e.stopPropagation()}>
                                            {failing && (
                                                <label>
                                                    Why couldn't it be delivered?
                                                    <SpeechInput value={reason} onChange={setReason} placeholder="e.g. Road to the shelter is flooded" />
                                                </label>
                                            )}
                                            <label>
                                                {{ pickup: 'Damaged at the warehouse (leave these behind)', return: 'Damaged on the way back' }[finishing.kind] || 'Damaged items'}
                                                <input type="number" min="0" max={onBoard} value={damaged} onChange={(e) => setDamaged(e.target.value)} />
                                            </label>
                                            {Number(damaged) > 0 && (
                                                <label>
                                                    What happened?
                                                    <SpeechInput value={note} onChange={setNote} placeholder="e.g. 5 bottles crushed in transit" />
                                                </label>
                                            )}
                                            <div className="actions">
                                                {confirm[finishing.kind]}
                                                <button className="secondary" onClick={() => setFinishing(null)}>Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })
                        )}
                    </section>

                    {done.length > 0 && (
                        <section className="card">
                            <h2>Completed ({done.length})</h2>
                            <ul className="done-list">
                                {done.map((s) => (
                                    <li key={s.shipment_id}>
                                        <strong>{s.shipment_id}</strong> · {s.quantity} {s.item} to {s.shelter_name}
                                        {s.status === 'Returned' && <span className="damage-note"> · couldn't deliver (<span dir="auto">{failureText(s, 'original')}</span>), returned to {s.warehouse_name}</span>}
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
                        {!selected && 'Select a delivery to see its route'}
                        {selected && (goingBack
                            ? `Head back to ${selected.warehouse_name}`
                            : `${selected.warehouse_name} → ${selected.shelter_name}`)}
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
                                    pathOptions={{
                                        color: goingBack ? '#dc2626' : '#2563eb',
                                        weight: 5,
                                        dashArray: selected.status === 'In transit' ? null : '8 10',
                                    }}
                                />
                                <CircleMarker center={route[0]} radius={10} pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.9 }}>
                                    <Tooltip permanent direction="top" offset={[0, -10]}>
                                        {goingBack ? 'Return to' : 'Pick up'}: {selected.warehouse_name}
                                    </Tooltip>
                                </CircleMarker>
                                <CircleMarker center={route[1]} radius={10} pathOptions={{ color: '#b91c1c', fillColor: '#dc2626', fillOpacity: 0.9 }}>
                                    <Tooltip permanent direction="top" offset={[0, -10]}>
                                        {goingBack ? "Couldn't reach" : 'Drop off'}: {selected.shelter_name}
                                    </Tooltip>
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
                            href={directions}
                        >
                            <span className="icon-text">
                                {goingBack ? 'Directions back to the warehouse' : 'Open directions in Google Maps'} <ExternalLink size={16} />
                            </span>
                        </a>
                    )}
                </section>
            </div>
        </>
    );
}

export default DriverView;
