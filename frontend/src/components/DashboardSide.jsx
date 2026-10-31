const PROCESSED = ['Fulfilled', 'Partial', 'Unfulfilled'];

function DashboardSide({ requests, shelters, inventory, warehouses, onOpenRequests }) {
    const nameOf = (id) => {
        const shelter = shelters.find((s) => s.shelter_id === id);
        return shelter ? shelter.name : id;
    };

    const processed = requests.filter((r) => PROCESSED.includes(r.status));
    const asked = processed.reduce((n, r) => n + r.quantity, 0);
    const sent = processed.reduce((n, r) => n + r.quantity_allocated, 0);
    const fillRate = asked === 0 ? 0 : Math.round((sent / asked) * 100);

    const awaiting = requests.filter((r) => r.status === 'Awaiting review').length;
    const criticalShort = requests.filter(
        (r) => r.urgency === 'Critical' && (r.status === 'Partial' || r.status === 'Unfulfilled')
    );
    const outOfStock = inventory.filter((row) => row.quantity === 0);
    const allClear = awaiting === 0 && criticalShort.length === 0 && outOfStock.length === 0;

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
                {allClear ? (
                    <p className="muted">All clear. Nothing needs action right now.</p>
                ) : (
                    <ul className="attention">
                        {awaiting > 0 && (
                            <li className="attention-item info" onClick={() => onOpenRequests('Awaiting review')}>
                                <span><strong>{awaiting}</strong> waiting for review</span>
                                <span className="go">Review →</span>
                            </li>
                        )}
                        {criticalShort.map((r) => (
                            <li key={r.request_id} className="attention-item danger" onClick={() => onOpenRequests(r.status)}>
                                <span>
                                    <strong>{r.request_id}</strong> Critical: {r.quantity - r.quantity_allocated} {r.item} short at {nameOf(r.shelter_id)}
                                </span>
                            </li>
                        ))}
                        {outOfStock.map((row) => (
                            <li key={row.id} className="attention-item warn">
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
