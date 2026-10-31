import { useEffect, useState } from 'react';

const API = 'http://localhost:3000/api';

const STATUS_COLOURS = {
    Fulfilled: '#16a34a',
    Partial: '#d97706',
    Unfulfilled: '#dc2626',
    Pending: '#9ca3af',
    'Awaiting review': '#3b82f6',
    Rejected: '#4b5563',
};

const DOWNLOADS = [
    { format: 'PDF', icon: '📄', file: 'report.pdf', text: 'Printable report with summary, request tables and inventory' },
    { format: 'CSV', icon: '📊', file: 'requests.csv', text: 'Every request in one table. Opens in Excel or Numbers' },
    { format: 'JSON', icon: '{ }', file: 'report.json', text: 'Full report data for other systems to read' },
];

function ReportsPanel({ requests }) {
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API}/reports/report.json`)
            .then((res) => res.json())
            .then((data) => {
                setReport(data);
                setError('');
            })
            .catch(() => setError('Could not load the report preview'));
    }, [requests]);

    if (error) return <p className="errors">{error}</p>;
    if (!report) return <p className="muted">Loading report...</p>;

    const s = report.summary;
    const unitsShort = s.units_requested - s.units_allocated;

    const breakdown = [
        ['Fulfilled', s.fulfilled],
        ['Partial', s.partial],
        ['Unfulfilled', s.unfulfilled],
        ['Pending', s.pending],
        ['Awaiting review', s.awaiting_review],
        ['Rejected', s.rejected],
    ].filter(([, n]) => n > 0);

    const byItem = {};
    report.unfulfilled.forEach((r) => {
        if (!byItem[r.item]) byItem[r.item] = { item: r.item, requests: 0, requested: 0, sent: 0, short: 0 };
        byItem[r.item].requests += 1;
        byItem[r.item].requested += r.requested;
        byItem[r.item].sent += r.allocated;
        byItem[r.item].short += r.shortfall;
    });
    const shortages = Object.values(byItem).sort((a, b) => b.short - a.short);

    const generated = new Date(report.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    return (
        <>
            <div className="report-stats">
                <div className="stat">
                    <div className="stat-value">{s.fill_rate}%</div>
                    <div className="stat-label">Fill rate</div>
                </div>
                <div className="stat fulfilled">
                    <div className="stat-value">{s.units_allocated}</div>
                    <div className="stat-label">Units sent</div>
                </div>
                <div className="stat unfulfilled">
                    <div className="stat-value">{unitsShort}</div>
                    <div className="stat-label">Units short</div>
                </div>
                <div className="stat">
                    <div className="stat-value">{s.total}</div>
                    <div className="stat-label">Requests</div>
                </div>
            </div>

            <section className="card">
                <div className="panel-header">
                    <h2>Request status</h2>
                    <span className="muted small-note">Data as of {generated}</span>
                </div>
                {s.total === 0 ? (
                    <p className="muted">No requests yet.</p>
                ) : (
                    <>
                        <div className="status-bar">
                            {breakdown.map(([label, n]) => (
                                <div
                                    key={label}
                                    className="status-segment"
                                    title={`${label}: ${n}`}
                                    style={{ width: `${(n / s.total) * 100}%`, background: STATUS_COLOURS[label] }}
                                ></div>
                            ))}
                        </div>
                        <div className="legend">
                            {breakdown.map(([label, n]) => (
                                <span key={label}>
                                    <i className="dot" style={{ background: STATUS_COLOURS[label] }}></i>
                                    {label} <strong>{n}</strong>
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <section className="card">
                <h2>Shortfall by item</h2>
                {shortages.length === 0 ? (
                    <p className="muted">No shortages. Every processed request was filled.</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th><th>Requests affected</th><th>Requested</th><th>Sent</th><th>Still needed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shortages.map((row) => (
                                <tr key={row.item}>
                                    <td>{row.item}</td>
                                    <td>{row.requests}</td>
                                    <td>{row.requested}</td>
                                    <td>{row.sent}</td>
                                    <td className="out-of-stock">{row.short}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <div className="download-grid">
                {DOWNLOADS.map((d) => (
                    <a key={d.format} className="download-card" href={`${API}/reports/${d.file}`}>
                        <span className="download-icon">{d.icon}</span>
                        <span className="download-format">{d.format}</span>
                        <span className="muted small-note">{d.text}</span>
                        <span className="download-cta">Download {d.format} ↓</span>
                    </a>
                ))}
            </div>
        </>
    );
}

export default ReportsPanel;
