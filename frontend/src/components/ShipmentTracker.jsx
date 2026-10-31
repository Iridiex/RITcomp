import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatTime } from '../format';
import LoadAmount from './LoadAmount';
import ShipmentOverride from './ShipmentOverride';
import { NoteLanguageToggle, NoteText } from './DriverNotes';
import { damageLines, failureText, hasDriverNotes, useNoteLanguage } from '../noteLanguage';

const FILTERS = [
    { id: 'active', label: 'Active', test: (s) => ['Ready', 'In transit', 'Returning'].includes(s.status) },
    { id: 'delivered', label: 'Delivered', test: (s) => s.status === 'Delivered' },
    { id: 'incidents', label: 'Incidents', test: (s) => s.quantity_damaged > 0 || Boolean(s.failure_reason) },
    { id: 'all', label: 'All', test: () => true },
];

function incidentsOf(s, lang) {
    const list = damageLines(s, lang);
    if (s.failure_reason) list.push(`${lang === 'ar' ? 'تعذر التسليم' : "Couldn't deliver"}: ${failureText(s, lang)}`);
    return list;
}

function ShipmentTracker({ shipments, direction, onChanged }) {
    const [filter, setFilter] = useState('active');
    const current = FILTERS.find((f) => f.id === filter);
    const shown = shipments.filter(current.test).sort((a, b) => b.shipment_id.localeCompare(a.shipment_id));
    const incoming = direction === 'incoming';
    const lang = useNoteLanguage();

    return (
        <section className="card">
            <div className="chips-row">
                <div className="chips">
                    {FILTERS.map((f) => (
                        <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                            {f.label} <span className="chip-count">{shipments.filter(f.test).length}</span>
                        </button>
                    ))}
                </div>
                {hasDriverNotes(shipments) && <NoteLanguageToggle />}
            </div>

            {shown.length === 0 ? (
                <p className="muted">Nothing here right now.</p>
            ) : (
                <div className="tracker-grid">
                    {shown.map((s) => {
                        const notes = incidentsOf(s, lang);
                        return (
                            <div key={s.shipment_id} className={`delivery ${notes.length > 0 ? 'has-incident' : ''}`}>
                                <div className="delivery-top">
                                    <strong>
                                        {s.shipment_id}
                                        {s.run_id.startsWith('REPLACE') && <span className="tag">Replacement</span>}
                                    </strong>
                                    <span className={`badge ${s.status.toLowerCase().replace(' ', '-')}`}>{s.status}</span>
                                </div>
                                <div className="delivery-load">
                                    <LoadAmount shipment={s} shipments={shipments} quantity={s.quantity - s.quantity_damaged} />
                                </div>
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
                                    {s.failure_reason ? (
                                        <>
                                            <li className="failed">Couldn't deliver</li>
                                            <li className={s.returned_at ? 'done' : ''}>
                                                Back at warehouse {formatTime(s.returned_at) || '(on the way)'}
                                            </li>
                                        </>
                                    ) : (
                                        <li className={s.delivered_at ? 'done' : ''}>Delivered {formatTime(s.delivered_at) || '-'}</li>
                                    )}
                                </ul>
                                {!incoming && <ShipmentOverride shipment={s} role="warehouse" onChanged={onChanged} />}
                                {notes.length > 0 && (
                                    <div className="incident-box">
                                        <span className="icon-text">
                                            <AlertTriangle size={16} />
                                            {s.quantity_damaged > 0 ? `${s.quantity_damaged} damaged` : 'Delivery problem'}
                                        </span>
                                        <NoteText shipment={s} kinds={['damage', 'failure']} block>
                                            <ul>
                                                {notes.map((n) => <li key={n} dir="auto">{n}</li>)}
                                            </ul>
                                        </NoteText>
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
