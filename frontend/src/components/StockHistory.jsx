import { formatTime } from '../format';
import { IdLink } from '../inspect';

function StockHistory({ movements, showWarehouse }) {
    return (
        <section className="card">
            <h2>Stock history</h2>
            {movements.length === 0 ? (
                <p className="muted">No stock changes yet.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>When</th>
                            {showWarehouse && <th>Warehouse</th>}
                            <th>Item</th><th>Change</th><th>Reason</th><th>By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movements.map((m) => (
                            <tr key={m.id}>
                                <td>{formatTime(m.created_at)}</td>
                                {showWarehouse && <td><IdLink type="warehouse" id={m.warehouse_id} /></td>}
                                <td>{m.item}</td>
                                <td className={m.change < 0 ? 'change-down' : 'change-up'}>
                                    {m.change > 0 ? `+${m.change}` : m.change}
                                </td>
                                <td>{m.reason}</td>
                                <td>{m.by_name || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export default StockHistory;
