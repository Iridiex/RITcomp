import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatTime } from '../format';

const FILTERS = [
    { id: 'active', label: 'Active', test: (s) => s.status === 'Ready' || s.status === 'In transit' },
    { id: 'delivered', label: 'Delivered', test: (s) => s.status === 'Delivered' },
    { id: 'incidents', label: 'Incidents', test: (s) => s.quantity_damaged > 0 || s.status === 'Returned' },
    { id: 'all', label: 'All', test: () => true },
];

function incidentsOf(s) {
    const list = s.damage_note ? s.damage_note.split('; ') : [];
    if (s.failure_reason) list.push('Returned: ' + s.failure_reason);
    return list;
}

function ShipmentTracker({ shipments, direction }) {
    const [filter, setFilter] = useState('active');
    const current = FILTERS.find((f) => f.id === filter);
    const shown = shipments.filter(current.test).sort((a, b) => b.shipment_id.localeCompare(a.shipment_id));
    const incoming = direction === 'incoming';

    return (
        <section className="card">
            <div className="chips">
                {FILTERS.map((f) => (
                    <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                        {f.label} <span className="chip-count">{shipments.filter(f.test).length}</span>
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <p className="muted">Nothing here right now.</p>
            ) : (
                <div className="tracker-grid">
                    {shown.map((s) => {
                        const notes = incidentsOf(s);
                        return (
                            <div key={s.shipment_id} className={`delivery ${notes.length > 0 ? 'has-incident' : ''}`}>
                                <div className="delivery-top">
                                    <strong>
                                        {s.shipment_id}
                                        {s.run_id.startsWith('REPLACE') && <span className="tag">Replacement</span>}
                                    </strong>
                                    <span className={`badge ${s.status.toLowerCase().replace(' ', '-')}`}>{s.status}</span>
                                </div>
                                <div className="delivery-load">{s.quantity - s.quantity_damaged} {s.item}</div>
                                <div className="delivery-route">
                                    {incoming ? (
                                        <span>From <strong>{s.warehouse_name}</strong></span>
                                    ) : (
                                        <span>To <strong>{s.shelter_name}</strong></span>
                                    )}
                                    <span className="muted">For {s.request_id} · Driver: {s.driver_name || 'not assigned yet'}</span>
                                </div>
                                <ul className="timeline">
                                    <li className="done">Dispatched {formatTime(s.created_at)}</li>
                                    <li className={s.picked_up_at ? 'done' : ''}>Picked up {formatTime(s.picked_up_at) || '-'}</li>
                                    {s.status === 'Returned' ? (
                                        <li className="failed">Returned to warehouse</li>
                                    ) : (
                                        <li className={s.delivered_at ? 'done' : ''}>Delivered {formatTime(s.delivered_at) || '-'}</li>
                                    )}
                                </ul>
                                {notes.length > 0 && (
                                    <div className="incident-box">
                                        <span className="icon-text">
                                            <AlertTriangle size={16} />
                                            {s.quantity_damaged > 0 ? `${s.quantity_damaged} damaged` : 'Delivery problem'}
                                        </span>
                                        <ul>
                                            {notes.map((n) => <li key={n}>{n}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default ShipmentTracker;
