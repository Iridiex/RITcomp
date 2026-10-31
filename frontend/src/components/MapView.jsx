import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Shelter pin colour by priority (1 = most important)
const PRIORITY_COLOURS = { 1: '#dc2626', 2: '#d97706', 3: '#6b7280' };
const OPEN_STATUSES = ['Awaiting review', 'Pending', 'Partial'];

function MapView({ shelters, warehouses, requests, inventory }) {
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
                            {s.shelter_id} · Priority {s.priority}<br />
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
                            {w.warehouse_id}
                            <ul className="popup-list">
                                {stockAt(w.warehouse_id).map((row) => (
                                    <li key={row.id}>{row.item}: {row.quantity}</li>
                                ))}
                            </ul>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>
        </section>
    );
}

export default MapView;
