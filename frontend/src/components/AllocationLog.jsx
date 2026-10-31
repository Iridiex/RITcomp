import { IdLink } from '../inspect';
function AllocationLog({ log }) {
    return (
        <section className="card">
            <h2>Allocation log</h2>
            {log.length === 0 ? (
                <p className="muted">No allocation has been run yet.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Run</th><th>Request</th><th>Warehouse</th>
                            <th>Sent</th><th>Result</th><th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {log.map((row) => (
                            <tr key={row.id}>
                                <td>{row.run_id}</td>
                                <td><IdLink type="request" id={row.request_id} /></td>
                                <td>{row.warehouse_id ? <IdLink type="warehouse" id={row.warehouse_id} /> : '-'}</td>
                                <td>{row.quantity_sent}</td>
                                <td><span className={`badge ${row.result.toLowerCase()}`}>{row.result}</span></td>
                                <td>{row.reason || ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

export default AllocationLog;
