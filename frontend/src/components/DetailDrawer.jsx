import { ArrowLeft, X } from 'lucide-react';
import MiniMap from './MiniMap';
import { useEffect } from 'react';
import { IdLink, useInspect } from '../inspect';

const TITLES = { request: 'Request', shipment: 'Shipment', shelter: 'Shelter', warehouse: 'Warehouse' };

function formatTime(value) {
    if (!value) return null;
    const text = String(value);
    const iso = text.includes('T') ? text : text.replace(' ', 'T') + 'Z';
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Field({ label, children }) {
    return (
        <div className="field">
            <span className="field-label">{label}</span>
            <span>{children}</span>
        </div>
    );
}

function Badge({ value }) {
    if (!value) return null;
    return <span className={`badge ${value.toLowerCase().replace(' ', '-')}`}>{value}</span>;
}

function ShipmentList({ shipments }) {
    if (shipments.length === 0) return <p className="muted small-note">No shipments yet.</p>;
    return (
        <ul className="link-list">
            {shipments.map((s) => (
                <li key={s.shipment_id}>
                    <IdLink type="shipment" id={s.shipment_id} /> · {s.quantity} {s.item} ·{' '}
                    <IdLink type="warehouse" id={s.warehouse_id} chip /> → <IdLink type="shelter" id={s.shelter_id} chip />{' '}
                    <Badge value={s.status} />
                    {s.driver_name && <span className="muted"> · {s.driver_name}</span>}
                </li>
            ))}
        </ul>
    );
}

function RequestDetail({ id, data }) {
    const r = data.requests.find((x) => x.request_id === id);
    if (!r) return <p className="muted">Not found. It may have been deleted.</p>;
    const shelter = data.shelters.find((s) => s.shelter_id === r.shelter_id);
    const shipments = data.shipments.filter((s) => s.request_id === id);
    const log = data.log.filter((l) => l.request_id === id);
    const sources = data.warehouses.filter((w) => shipments.some((s) => s.warehouse_id === w.warehouse_id));
    const pct = Math.round((r.quantity_delivered / r.quantity) * 100);

    return (
        <>
            <div className="detail-head">
                <h3>{r.quantity} {r.item}</h3>
                <Badge value={r.status} />
                {Boolean(r.replacement_pending) && <span className="tag warn">Replacement pending</span>}
            </div>
            <Field label="Shelter">
                <IdLink type="shelter" id={r.shelter_id} label={shelter ? `${r.shelter_id} · ${shelter.name}` : r.shelter_id} />
            </Field>
            <Field label="Urgency"><Badge value={r.urgency} /></Field>
            {r.reason && <Field label="Reason">{r.reason}</Field>}
            {r.review_note && <Field label="Review note">{r.review_note}</Field>}
            <Field label="Reserved">{r.quantity_allocated} of {r.quantity}</Field>
            <Field label="Delivered">{r.quantity_delivered} of {r.quantity} ({pct}%)</Field>
            <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }}></div></div>
            {shelter && (
                <MiniMap
                    points={[
                        { lat: shelter.latitude, lng: shelter.longitude, color: '#dc2626', label: shelter.name },
                        ...sources.map((w) => ({ lat: w.latitude, lng: w.longitude, color: '#2563eb', label: w.name })),
                    ]}
                    lines={sources.map((w) => [{ lat: w.latitude, lng: w.longitude }, { lat: shelter.latitude, lng: shelter.longitude }])}
                />
            )}

            <h4>Shipments ({shipments.length})</h4>
            <ShipmentList shipments={shipments} />

            <h4>Allocation history</h4>
            {log.length === 0 ? (
                <p className="muted small-note">Not allocated yet.</p>
            ) : (
                <ul className="link-list">
                    {log.map((l) => (
                        <li key={l.id}>
                            {l.run_id.startsWith('REPLACE') ? 'Replacement' : 'Run'} · {l.quantity_sent} from{' '}
                            {l.warehouse_id ? <IdLink type="warehouse" id={l.warehouse_id} chip /> : 'no warehouse'} <Badge value={l.result} />
                            {l.reason && <span className="muted"> · {l.reason}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

function ShipmentDetail({ id, data }) {
    const s = data.shipments.find((x) => x.shipment_id === id);
    if (!s) return <p className="muted">Not found.</p>;
    const siblings = data.shipments.filter((x) => x.request_id === s.request_id && x.shipment_id !== id);

    return (
        <>
            <div className="detail-head">
                <h3>{s.quantity} {s.item}</h3>
                <Badge value={s.status} />
                {s.run_id.startsWith('REPLACE') && <span className="tag">Replacement</span>}
            </div>
            <Field label="For request"><IdLink type="request" id={s.request_id} /></Field>
            <Field label="From"><IdLink type="warehouse" id={s.warehouse_id} label={`${s.warehouse_id} · ${s.warehouse_name}`} /></Field>
            <Field label="To"><IdLink type="shelter" id={s.shelter_id} label={`${s.shelter_id} · ${s.shelter_name}`} /></Field>
            <Field label="Driver">{s.driver_name || 'Not assigned'}</Field>
            <Field label="Urgency"><Badge value={s.urgency} /></Field>
            <MiniMap
                points={[
                    { lat: s.warehouse_lat, lng: s.warehouse_lng, color: '#2563eb', label: 'Pick up: ' + s.warehouse_name },
                    { lat: s.shelter_lat, lng: s.shelter_lng, color: '#dc2626', label: 'Drop off: ' + s.shelter_name },
                ]}
                lines={[[{ lat: s.warehouse_lat, lng: s.warehouse_lng }, { lat: s.shelter_lat, lng: s.shelter_lng }]]}
            />

            <h4>Timeline</h4>
            <ul className="timeline">
                <li className="done">Created {formatTime(s.created_at)}</li>
                <li className={s.picked_up_at ? 'done' : ''}>Picked up {formatTime(s.picked_up_at) || '-'}</li>
                {s.status === 'Returned' ? (
                    <li className="failed">Returned: {s.failure_reason}</li>
                ) : (
                    <li className={s.delivered_at ? 'done' : ''}>Delivered {formatTime(s.delivered_at) || '-'}</li>
                )}
            </ul>

            {s.quantity_damaged > 0 && (
                <p className="damage-note">{s.quantity_damaged} written off: {s.damage_note}</p>
            )}

            <h4>Other shipments for {s.request_id}</h4>
            <ShipmentList shipments={siblings} />
        </>
    );
}

function ShelterDetail({ id, data }) {
    const shelter = data.shelters.find((x) => x.shelter_id === id);
    if (!shelter) return <p className="muted">Not found. It may have been deleted.</p>;
    const requests = data.requests.filter((r) => r.shelter_id === id);
    const shipments = data.shipments.filter((s) => s.shelter_id === id);

    return (
        <>
            <div className="detail-head">
                <h3>{shelter.name}</h3>
                <span className="tag">Priority {shelter.priority}</span>
            </div>
            <Field label="Location">{Number(shelter.latitude).toFixed(4)}, {Number(shelter.longitude).toFixed(4)}</Field>
            <MiniMap points={[{ lat: shelter.latitude, lng: shelter.longitude, color: '#dc2626', label: shelter.name }]} />
            <Field label="Requests">{requests.length}</Field>

            <h4>Requests</h4>
            {requests.length === 0 ? (
                <p className="muted small-note">No requests yet.</p>
            ) : (
                <ul className="link-list">
                    {requests.map((r) => (
                        <li key={r.request_id}>
                            <IdLink type="request" id={r.request_id} /> · {r.quantity} {r.item} <Badge value={r.status} />
                            <span className="muted"> · {r.quantity_delivered}/{r.quantity} delivered</span>
                        </li>
                    ))}
                </ul>
            )}

            <h4>Shipments heading here ({shipments.length})</h4>
            <ShipmentList shipments={shipments} />
        </>
    );
}

function WarehouseDetail({ id, data }) {
    const warehouse = data.warehouses.find((x) => x.warehouse_id === id);
    if (!warehouse) return <p className="muted">Not found. It may have been deleted.</p>;
    const stock = data.inventory.filter((row) => row.warehouse_id === id);
    const shipments = data.shipments.filter((s) => s.warehouse_id === id);

    return (
        <>
            <div className="detail-head">
                <h3>{warehouse.name}</h3>
            </div>
            <Field label="Location">{Number(warehouse.latitude).toFixed(4)}, {Number(warehouse.longitude).toFixed(4)}</Field>
            <MiniMap points={[{ lat: warehouse.latitude, lng: warehouse.longitude, color: '#2563eb', label: warehouse.name }]} />

            <h4>Stock</h4>
            {stock.length === 0 ? (
                <p className="muted small-note">No stock.</p>
            ) : (
                <ul className="link-list">
                    {stock.map((row) => (
                        <li key={row.id}>
                            {row.item}: <strong className={row.quantity === 0 ? 'out-of-stock' : ''}>{row.quantity}</strong>
                        </li>
                    ))}
                </ul>
            )}

            <h4>Shipments from here ({shipments.length})</h4>
            <ShipmentList shipments={shipments} />
        </>
    );
}

const DETAILS = { request: RequestDetail, shipment: ShipmentDetail, shelter: ShelterDetail, warehouse: WarehouseDetail };

function DetailDrawer() {
    const inspect = useInspect();

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') inspect.close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [inspect]);

    if (!inspect || !inspect.current) return null;
    const { type, id } = inspect.current;
    const Detail = DETAILS[type];

    return (
        <>
            <div className="drawer-backdrop" onClick={inspect.close}></div>
            <aside className="drawer">
                <div className="drawer-top">
                    {inspect.canGoBack ? (
                        <button className="secondary small icon-text" onClick={inspect.back}><ArrowLeft size={16} /> Back</button>
                    ) : (
                        <span></span>
                    )}
                    <span className="drawer-kind">{TITLES[type]} {id}</span>
                    <button className="secondary icon-button" aria-label="Close" onClick={inspect.close}><X size={18} /></button>
                </div>
                <div className="drawer-body">
                    <Detail id={id} data={inspect.data} />
                </div>
            </aside>
        </>
    );
}

export default DetailDrawer;
