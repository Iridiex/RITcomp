import { API, withToken } from '../session';
import { FileText, FileSpreadsheet, Braces, Download, Gauge, Send, TrendingDown, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';

const STATUS_COLOURS = {
    Fulfilled: '#16a34a',
    Allocated: '#2563eb',
    Partial: '#d97706',
    Unfulfilled: '#dc2626',
    Pending: '#9ca3af',
    'Awaiting review': '#3b82f6',
    Rejected: '#4b5563',
    Cancelled: '#94a3b8',
};

const DOWNLOADS = [
    { format: 'PDF', icon: FileText, file: 'report.pdf', text: 'Printable report with summary, request tables and inventory' },
    { format: 'CSV', icon: FileSpreadsheet, file: 'requests.csv', text: 'Every request in one table. Opens in Excel or Numbers' },
    { format: 'JSON', icon: Braces, file: 'report.json', text: 'Full report data for other systems to read' },
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
        ['Allocated', s.allocated],
        ['Partial', s.partial],
        ['Unfulfilled', s.unfulfilled],
        ['Pending', s.pending],
        ['Awaiting review', s.awaiting_review],
        ['Rejected', s.rejected],
        ['Cancelled', s.cancelled],
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
                {[
                    { label: 'Fill rate', value: `${s.fill_rate}%`, tone: 'allocated', icon: Gauge },
                    { label: 'Units sent', value: s.units_allocated, tone: 'fulfilled', icon: Send },
                    { label: 'Units short', value: unitsShort, tone: 'unfulfilled', icon: TrendingDown },
                    { label: 'Requests', value: s.total, tone: 'total', icon: ClipboardList },
                ].map((stat) => (
                    <div key={stat.label} className={`stat tone-${stat.tone}`}>
                        <span className="stat-icon"><stat.icon size={17} /></span>
                        <div className="stat-value">{stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                    </div>
                ))}
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
                    <div className="table-wrap">
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
                    </div>
                )}
            </section>

            <div className="download-grid">
                {DOWNLOADS.map((d) => (
                    <a key={d.format} className="download-card" href={withToken(`${API}/reports/${d.file}`)}>
                        <span className="download-icon"><d.icon size={26} strokeWidth={1.75} /></span>
                        <span className="download-format">{d.format}</span>
                        <span className="muted small-note">{d.text}</span>
                        <span className="download-cta icon-text"><Download size={16} /> Download {d.format}</span>
                    </a>
                ))}
            </div>
        </>
    );
}

export default ReportsPanel;
