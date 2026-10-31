import { useState } from 'react';

const API = 'http://localhost:3000/api';
const FILTERS = ['All', 'Ready', 'In transit', 'Delivered'];

function ShipmentsPanel({ shipments, drivers, onChanged }) {
    const [filter, setFilter] = useState('All');
    const [error, setError] = useState('');

    async function assign(shipmentId, driverId) {
        if (!driverId) return;
        setError('');
        try {
            const res = await fetch(`${API}/shipments/${shipmentId}/assign`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_id: driverId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
                return;
            }
            onChanged();
        } catch (err) {
            setError('Could not reach the server');
        }
    }

    const shown = shipments.filter((s) => filter === 'All' || s.status === filter);
    const countOf = (f) => (f === 'All' ? shipments.length : shipments.filter((s) => s.status === f).length);
    const unassigned = shipments.filter((s) => s.status === 'Ready' && !s.driver_id).length;

    return (
        <section className="card">
            <div className="panel-header">
                <h2>Shipments</h2>
                {unassigned > 0 && <span className="pill warn">{unassigned} waiting for a driver</span>}
            </div>

            <div className="chips">
                {FILTERS.map((f) => (
                    <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                        {f} <span className="chip-count">{countOf(f)}</span>
                    </button>
                ))}
            </div>

            {error && <p className="errors">{error}</p>}

            {shown.length === 0 ? (
                <p className="muted">No shipments here. Run allocation to create them.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Load</th><th>From</th><th>To</th>
                            <th>Urgency</th><th>Driver</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((s) => (
                            <tr key={s.shipment_id}>
                                <td>{s.shipment_id}</td>
                                <td>
                                    {s.quantity} {s.item}
                                    {s.quantity_damaged > 0 && (
                                        <div className="damage-note">{s.quantity_damaged} damaged: {s.damage_note}</div>
                                    )}
                                </td>
                                <td>{s.warehouse_name}</td>
                                <td>{s.shelter_name}</td>
                                <td><span className={`badge ${(s.urgency || '').toLowerCase()}`}>{s.urgency}</span></td>
                                <td>
                                    {s.status === 'Ready' ? (
                                        <select
                                            className="inline-select"
                                            value={s.driver_id || ''}
                                            onChange={(e) => assign(s.shipment_id, e.target.value)}
                                        >
                                            <option value="">Assign driver</option>
                                            {drivers.map((d) => (
                                                <option key={d.driver_id} value={d.driver_id}>{d.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        s.driver_name || '-'
                                    )}
                                </td>
                                <td><span className={`badge ${s.status.toLowerCase().replace(' ', '-')}`}>{s.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export default ShipmentsPanel;
