import { useState } from 'react';
import { ArrowRight, Check, Play } from 'lucide-react';
import { API } from '../session';
import RouteAlert from './RouteAlert';
import { useInspect } from '../inspectContext';
import { hoursSince, waitedText } from '../format';

const PROCESSED = ['Fulfilled', 'Allocated', 'Partial', 'Unfulfilled'];
const SHORT = ['Partial', 'Unfulfilled'];
const URGENCY_ORDER = { Critical: 0, High: 1, Moderate: 2 };
const LONG_WAIT_HOURS = 24;
const ON_ROAD_HOURS = 6;
const NOT_PICKED_UP_HOURS = 4;

function DashboardSide({ requests, shelters, inventory, warehouses, shipments, incidents = [], medical = [], onIncidentsChanged, onOpenRequests, onOpenShipments, onOpenMedical, onRunAllocation }) {
    const [clearing, setClearing] = useState(null);
    const [clearError, setClearError] = useState('');
    const inspect = useInspect();

    async function clearAlert(id) {
        setClearing(id);
        setClearError('');
        try {
            const res = await fetch(`${API}/incidents/${id}/resolve`, { method: 'PATCH' });
            if (!res.ok) {
                const data = await res.json();
                setClearError((data.errors || [data.error]).join(', '));
            }
            await onIncidentsChanged();
        } catch {
            setClearError('Could not reach the server');
        }
        setClearing(null);
    }

    const nameOf = (id) => {
        const shelter = shelters.find((s) => s.shelter_id === id);
        return shelter ? shelter.name : id;
    };

    const processed = requests.filter((r) => PROCESSED.includes(r.status));
    const asked = processed.reduce((n, r) => n + r.quantity, 0);
    const sent = processed.reduce((n, r) => n + r.quantity_allocated, 0);
    const fillRate = asked === 0 ? 0 : Math.round((sent / asked) * 100);

    const awaiting = requests.filter((r) => r.status === 'Awaiting review').length;
    const approved = requests.filter((r) => r.status === 'Pending').length;
    const noDriver = shipments.filter((s) => s.status === 'Ready' && !s.driver_id).length;
    const headingBack = shipments.filter((s) => s.status === 'Returning').length;
    const short = requests
        .filter((r) => SHORT.includes(r.status))
        .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
    const outOfStock = inventory.filter((row) => row.quantity === 0);
    const onRoadTooLong = shipments.filter((s) => s.status === 'In transit' && hoursSince(s.picked_up_at) >= ON_ROAD_HOURS);
    const notPickedUp = shipments.filter((s) => s.status === 'Ready' && s.driver_id && hoursSince(s.created_at) >= NOT_PICKED_UP_HOURS);
    const medicalPending = medical.filter((r) => String(r.status).startsWith('Pending'));
    const medicalOpen = medical.filter((r) => r.status === 'Dispatched');
    const medicalReview = medical.filter((r) => r.status === 'Awaiting review');
    const allClear = incidents.length + awaiting + approved + noDriver + headingBack + short.length + outOfStock.length + onRoadTooLong.length + notPickedUp.length + medicalPending.length + medicalOpen.length + medicalReview.length === 0;

    const maxQty = Math.max(1, ...inventory.map((row) => row.quantity));

    return (
        <div className="dash-side">
            <section className="card">
                <h2>Fill rate</h2>
                <div className="big-number">{fillRate}%</div>
                <div className="progress">
                    <div className="progress-bar" style={{ width: `${fillRate}%` }}></div>
                </div>
                <p className="muted small-note">
                    {processed.length === 0 ? 'Run allocation to see results' : `${sent} of ${asked} units sent`}
                </p>
            </section>

            <section className="card">
                <h2>Needs attention</h2>
                {clearError && <p className="errors">{clearError}</p>}
                {allClear ? (
                    <p className="muted">All clear. Nothing needs action right now.</p>
                ) : (
                    <ul className="attention">
                        {incidents.map((a) => (
                            <li key={`alert-${a.id}`} className="attention-alert">
                                <RouteAlert alert={{ ...a, summary: `${a.shelter_name || a.shelter_id}: ${a.summary}` }}>
                                    <button className="secondary small icon-text" onClick={() => clearAlert(a.id)} disabled={clearing === a.id}>
                                        <Check size={14} /> {clearing === a.id ? 'Clearing…' : 'Mark resolved'}
                                    </button>
                                </RouteAlert>
                            </li>
                        ))}
                        {awaiting > 0 && (
                            <li className="attention-item info" onClick={() => onOpenRequests('Awaiting review')}>
                                <span><strong>{awaiting}</strong> waiting for review</span>
                                <span className="go icon-text">Review <ArrowRight size={14} /></span>
                            </li>
                        )}
                        {medicalReview.length > 0 && (
                            <li className="attention-item info" onClick={onOpenMedical}>
                                <span><strong>{medicalReview.length}</strong> doctor request(s) waiting for review</span>
                                <span className="go icon-text">Review <ArrowRight size={14} /></span>
                            </li>
                        )}
                        {medicalPending.map((r) => (
                            <li key={r.medical_id} className="attention-item danger" onClick={() => inspect.open('medical', r.medical_id)}>
                                <span>
                                    <strong>{r.medical_id}</strong> {r.specialty} at {r.shelter_name || r.shelter_id}. No matching doctor is free.
                                </span>
                                <span className="go icon-text">Open <ArrowRight size={14} /></span>
                            </li>
                        ))}
                        {medicalOpen.map((r) => (
                            <li key={r.medical_id} className="attention-item info" onClick={() => inspect.open('medical', r.medical_id)}>
                                <span>
                                    <strong>{r.medical_id}</strong> {r.doctor_id} heading to {r.shelter_name || r.shelter_id}
                                </span>
                                <span className="go icon-text">Open <ArrowRight size={14} /></span>
                            </li>
                        ))}
                        {approved > 0 && (
                            <li className="attention-item info" onClick={onRunAllocation}>
                                <span><strong>{approved}</strong> approved, not sent yet</span>
                                <span className="go icon-text"><Play size={13} /> Run allocation</span>
                            </li>
                        )}
                        {noDriver > 0 && (
                            <li className="attention-item danger" onClick={onOpenShipments}>
                                <span>
                                    <strong>{noDriver}</strong> shipment(s) have no driver. They are assigned automatically when a driver
                                    frees up, or you can assign one now
                                </span>
                                <span className="go icon-text">Assign <ArrowRight size={14} /></span>
                            </li>
                        )}
                        {headingBack > 0 && (
                            <li className="attention-item warn" onClick={onOpenShipments}>
                                <span><strong>{headingBack}</strong> couldn't be delivered and are heading back to a warehouse</span>
                                <span className="go icon-text">View <ArrowRight size={14} /></span>
                            </li>
                        )}
                        {onRoadTooLong.map((s) => (
                            <li key={s.shipment_id} className="attention-item danger" onClick={() => inspect.open('shipment', s.shipment_id)}>
                                <span>
                                    <strong>{s.shipment_id}</strong> on the road for {waitedText(s.picked_up_at)} with {s.driver_name}.
                                    <span className="attention-sub">Call the driver, then record whether it was delivered</span>
                                </span>
                                <span className="go icon-text">Open <ArrowRight size={14} /></span>
                            </li>
                        ))}
                        {notPickedUp.length > 0 && (
                            <li className="attention-item warn" onClick={onOpenShipments}>
                                <span>
                                    <strong>{notPickedUp.length}</strong> shipment(s) not picked up after {NOT_PICKED_UP_HOURS}h or more.
                                    <span className="attention-sub">Check with the drivers, or reassign them to someone free</span>
                                </span>
                                <span className="go icon-text">View <ArrowRight size={14} /></span>
                            </li>
                        )}
                        {short.map((r) => {
                            const longWait = hoursSince(r.created_at) >= LONG_WAIT_HOURS;
                            return (
                                <li key={r.request_id} className={`attention-item ${r.urgency === 'Critical' ? 'danger' : 'warn'}`} onClick={() => inspect.open('request', r.request_id)}>
                                    <span>
                                        <strong>{r.request_id}</strong> {r.urgency}: {r.quantity - r.quantity_allocated} {r.item} short at {nameOf(r.shelter_id)}
                                        <span className="muted"> · waiting {waitedText(r.created_at)}</span>
                                        <span className="attention-sub">
                                            {longWait
                                                ? `No ${r.item} for over a day. Find another source, or close it if the shelter no longer needs it`
                                                : `Goes out automatically as soon as a warehouse adds ${r.item}`}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                        {outOfStock.map((row) => (
                            <li key={row.id} className="attention-item warn static">
                                <span><strong>{row.warehouse_id}</strong> is out of {row.item}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="card">
                <h2>Stock</h2>
                {warehouses.map((w) => {
                    const rows = inventory.filter((row) => row.warehouse_id === w.warehouse_id);
                    return (
                        <div key={w.warehouse_id} className="stock-group">
                            <div className="stock-title">{w.name}</div>
                            {rows.length === 0 ? (
                                <p className="muted small-note">No stock yet</p>
                            ) : (
                                rows.map((row) => (
                                    <div key={row.id} className="stock-row">
                                        <span className="stock-item">{row.item}</span>
                                        <div className="stock-bar">
                                            <div
                                                className={`stock-fill ${row.quantity === 0 ? 'empty' : ''}`}
                                                style={{ width: `${(row.quantity / maxQty) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className={`stock-qty ${row.quantity === 0 ? 'out-of-stock' : ''}`}>{row.quantity}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

export default DashboardSide;
