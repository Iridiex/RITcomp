import { IdLink } from '../inspect';
import { formatTime } from '../format';

const RESULTS = ['Allocated', 'Partial', 'Unfulfilled'];

function runTime(runId) {
    const ms = Number(runId.split('-').pop());
    return Number.isFinite(ms) && ms > 0 ? formatTime(new Date(ms).toISOString()) : null;
}

function AllocationLog({ log }) {
    const runs = [];
    for (const row of log) {
        let run = runs.find((r) => r.id === row.run_id);
        if (!run) {
            run = { id: row.run_id, rows: [] };
            runs.push(run);
        }
        run.rows.push(row);
    }

    if (log.length === 0) {
        return (
            <section className="card">
                <h2>Allocation runs</h2>
                <p className="muted">No allocation has been run yet. Press "Run allocation" to dispatch pending requests.</p>
            </section>
        );
    }

    return (
        <>
            {runs.map((run) => {
                const replacement = run.id.startsWith('REPLACE');
                const sent = run.rows.reduce((sum, r) => sum + r.quantity_sent, 0);
                const requestCount = new Set(run.rows.map((r) => r.request_id)).size;
                return (
                    <section key={run.id} className="card run-card">
                        <div className="run-head">
                            <div className="run-title">
                                <h3>{replacement ? 'Replacement' : 'Allocation run'} · {runTime(run.id) || run.id}</h3>
                                <span className="run-id">{run.id}</span>
                            </div>
                            <div className="run-summary">
                                <span className="pill info">{requestCount} request{requestCount === 1 ? '' : 's'} · {sent} units sent</span>
                                {RESULTS.map((result) => {
                                    const n = run.rows.filter((r) => r.result === result).length;
                                    return n > 0 && <span key={result} className={`badge ${result.toLowerCase()}`}>{n} {result}</span>;
                                })}
                            </div>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Request</th><th>Warehouse</th><th>Sent</th><th>Result</th><th>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {run.rows.map((row) => (
                                        <tr key={row.id}>
                                            <td><IdLink type="request" id={row.request_id} /></td>
                                            <td>{row.warehouse_id ? <IdLink type="warehouse" id={row.warehouse_id} /> : <span className="muted">-</span>}</td>
                                            <td>{row.quantity_sent}</td>
                                            <td><span className={`badge ${row.result.toLowerCase()}`}>{row.result}</span></td>
                                            <td className="muted">{row.reason || ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                );
            })}
        </>
    );
}

export default AllocationLog;
