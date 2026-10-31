import { IdLink } from '../inspect';

function InventoryTable({ inventory, warehouses }) {
    const ids = [...new Set(inventory.map((row) => row.warehouse_id))];
    const shown = [
        ...warehouses.filter((w) => ids.includes(w.warehouse_id)),
        ...ids.filter((id) => !warehouses.some((w) => w.warehouse_id === id)).map((id) => ({ warehouse_id: id, name: id })),
    ];
    const maxQty = Math.max(1, ...inventory.map((row) => row.quantity));

    return (
        <section className="card">
            <h2>Stock levels</h2>
            {shown.length === 0 ? (
                <p className="muted">No stock recorded yet.</p>
            ) : (
                <div className="warehouse-grid">
                    {shown.map((w) => {
                        const rows = inventory.filter((row) => row.warehouse_id === w.warehouse_id);
                        const total = rows.reduce((sum, row) => sum + row.quantity, 0);
                        const empty = rows.filter((row) => row.quantity === 0).length;
                        return (
                            <div key={w.warehouse_id} className="warehouse-card">
                                <div className="warehouse-card-head">
                                    <div>
                                        <IdLink type="warehouse" id={w.warehouse_id} label={w.name} />
                                        <div className="id-line">
                                            {w.warehouse_id}
                                            {empty > 0 && <span className="tag warn">{empty} out of stock</span>}
                                        </div>
                                    </div>
                                    <div className="warehouse-total"><strong>{total}</strong>units</div>
                                </div>
                                {rows.map((row) => (
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
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default InventoryTable;
