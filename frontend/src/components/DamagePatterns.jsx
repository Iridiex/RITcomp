import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { API } from '../session';
import { formatTime } from '../format';
import { IdLink } from '../inspect';

// `version` changes whenever the page reloads its data, so staleness is re-checked
function DamagePatterns({ version }) {
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function look() {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`${API}/patterns`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Could not look for patterns');
            else setState(data);
        } catch {
            setError('Could not reach the server');
        }
        setBusy(false);
    }

    useEffect(() => {
        let cancelled = false;
        fetch(`${API}/patterns`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (cancelled || !data) return;
                setState(data);
                if (data.enabled && !data.patterns && data.incidents >= data.needed) look();
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [version]);

    if (!state || !state.enabled) return null;
    const { patterns, incidents, needed, generated_at: generatedAt, stale } = state;
    const tooFew = incidents < needed;

    return (
        <section className="card patterns">
            <div className="brief-head">
                <div className="brief-title">
                    <h2>Damage &amp; delivery patterns</h2>
                    <p className="muted">
                        AI reading of driver reports from the last 30 days
                        {patterns && generatedAt ? ` · ${formatTime(generatedAt)}` : ''}
                    </p>
                </div>
                {!tooFew && (
                    <button className="secondary small icon-text" onClick={look} disabled={busy}>
                        <RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Looking…' : 'Refresh'}
                    </button>
                )}
            </div>

            {error && <p className="errors">{error}</p>}

            {tooFew && (
                <p className="muted">
                    Not enough yet: {incidents} damaged or failed {incidents === 1 ? 'delivery' : 'deliveries'} so far. Patterns show up once there are {needed}.
                </p>
            )}

            {!tooFew && !patterns && busy && <p className="muted brief-wait">Reading driver reports…</p>}

            {!tooFew && patterns && (
                <>
                    {stale && !busy && <p className="brief-stale">New reports have come in since this was checked. Refresh to update it.</p>}
                    {patterns.length === 0 ? (
                        <p className="muted">No repeated problems across {incidents} reports. Each one looks like a one-off.</p>
                    ) : (
                        <ul className="pattern-list">
                            {patterns.map((p) => (
                                <li key={p.title} className={`pattern tone-${p.tone}`}>
                                    <strong>{p.title}</strong>
                                    <p>{p.detail}</p>
                                    <p className="pattern-fix"><span>Fix:</span> {p.suggestion}</p>
                                    <div className="chips-row">
                                        {p.shipments.map((id) => <IdLink key={id} type="shipment" id={id} chip />)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}

export default DamagePatterns;
