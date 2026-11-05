import { IdLink } from '../inspect';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Shelter pin colour by priority (1 = most important)
const PRIORITY_COLOURS = { 1: '#dc2626', 2: '#d97706', 3: '#6b7280' };
const OPEN_STATUSES = ['Awaiting review', 'Pending', 'Partial', 'Unfulfilled'];

function MapView({ shelters, warehouses, requests, inventory, hospitals = [], medical = [] }) {
    const openRequests = (id) =>
        requests.filter((r) => r.shelter_id === id && OPEN_STATUSES.includes(r.status));
    const stockAt = (id) => inventory.filter((row) => row.warehouse_id === id);

    return (
        <section className="card">
            <h2>Map</h2>
            <div className="legend">
                <span><i className="dot" style={{ background: '#dc2626' }}></i>Shelter, priority 1</span>
                <span><i className="dot" style={{ background: '#d97706' }}></i>Priority 2</span>
                <span><i className="dot" style={{ background: '#6b7280' }}></i>Priority 3</span>
                <span><i className="dot" style={{ background: '#2563eb' }}></i>Warehouse</span>
                <span><i className="dot" style={{ background: '#0f766e' }}></i>Hospital</span>
            </div>

            <MapContainer center={[25.2, 55.3]} zoom={11} className="map">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {shelters.map((s) => (
                    <CircleMarker
                        key={s.shelter_id}
                        center={[s.latitude, s.longitude]}
                        radius={9}
                        pathOptions={{ color: PRIORITY_COLOURS[s.priority] || '#6b7280', fillOpacity: 0.8 }}
                    >
                        <Popup>
                            <strong>{s.name}</strong><br />
                            <IdLink type="shelter" id={s.shelter_id} /> · Priority {s.priority}<br />
                            Open requests: {openRequests(s.shelter_id).length}
                            <ul className="popup-list">
                                {openRequests(s.shelter_id).map((r) => (
                                    <li key={r.request_id}>{r.quantity} {r.item} ({r.urgency})</li>
                                ))}
                            </ul>
                        </Popup>
                    </CircleMarker>
                ))}

                {warehouses.map((w) => (
                    <CircleMarker
                        key={w.warehouse_id}
                        center={[w.latitude, w.longitude]}
                        radius={12}
                        pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.9 }}
                    >
                        <Popup>
                            <strong>{w.name}</strong><br />
                            <IdLink type="warehouse" id={w.warehouse_id} />
                            <ul className="popup-list">
                                {stockAt(w.warehouse_id).map((row) => (
                                    <li key={row.id}>{row.item}: {row.quantity}</li>
                                ))}
                            </ul>
                        </Popup>
                    </CircleMarker>
                ))}

                {hospitals.map((h) => {
                    const assigned = medical.filter((r) => r.hospital_id === h.hospital_id && r.status === 'Dispatched');
                    const free = (h.doctors || []).filter((d) => d.status === 'Available').length;
                    return (
                        <CircleMarker
                            key={h.hospital_id}
                            center={[h.latitude, h.longitude]}
                            radius={10}
                            pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.85 }}
                        >
                            <Popup>
                                <strong>{h.name}</strong><br />
                                <IdLink type="hospital" id={h.hospital_id} /> · {free} doctor(s) free
                                <ul className="popup-list">
                                    {(h.doctors || []).map((d) => (
                                        <li key={d.doctor_id}>
                                            <IdLink type="doctor" id={d.doctor_id} /> {d.specialty} ({d.status})
                                        </li>
                                    ))}
                                </ul>
                                {assigned.length > 0 && (
                                    <p>
                                        On call now:{' '}
                                        {assigned.map((r, i) => (
                                            <span key={r.medical_id}>
                                                {i > 0 ? ', ' : ''}
                                                <IdLink type="medical" id={r.medical_id} />
                                            </span>
                                        ))}
                                    </p>
                                )}
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>
        </section>
    );
}

export default MapView;
