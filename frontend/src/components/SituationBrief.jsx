import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { API } from '../session';
import { formatTime } from '../format';

const CHECK_EVERY_MS = 60 * 1000;

// `version` changes whenever the dashboard reloads its data, so staleness is re-checked
function SituationBrief({ version }) {
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function write() {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`${API}/brief`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Could not write the brief');
            else setState(data);
        } catch {
            setError('Could not reach the server');
        }
        setBusy(false);
    }

    // Rewrites itself whenever the data behind it changes: on every reload of the dashboard,
    // and on a timer so changes made by shelters, warehouses and drivers show up too
    useEffect(() => {
        let cancelled = false;
        function check() {
            fetch(`${API}/brief`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (cancelled || !data) return;
                    setState(data);
                    if (data.enabled && (!data.brief || data.stale)) write();
                })
                .catch(() => {});
        }
        check();
        const timer = setInterval(check, CHECK_EVERY_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [version]);

    if (!state || !state.enabled) return null;
    const { brief, generated_at: generatedAt, stale } = state;

    return (
        <section className={`card brief ${brief ? `level-${brief.level.toLowerCase()}` : ''}`}>
            <div className="brief-head">
                <div className="brief-title">
                    <h2>Situation brief</h2>
                    <p className="muted">
                        {brief ? `Written by AI from live data · ${formatTime(generatedAt)}` : 'Written by AI from live data'}
                    </p>
                </div>
                {brief && <span className="brief-level">{brief.level}</span>}
                <button className="secondary small icon-text" onClick={write} disabled={busy}>
                    <RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Writing…' : 'Refresh'}
                </button>
            </div>

            {error && <p className="errors">{error}</p>}

            {!brief && busy && <p className="muted brief-wait">Reading requests, stock and deliveries…</p>}

            {brief && (
                <>
                    {stale && !busy && (
                        <p className="brief-stale">Things have changed since this brief was written. Refresh to update it.</p>
                    )}
                    <p className="brief-headline">{brief.headline}</p>
                    <div className="brief-body">
                        <ul className="brief-points">
                            {brief.points.map((p) => (
                                <li key={p.text} className={`tone-${p.tone}`}>{p.text}</li>
                            ))}
                        </ul>
                        {brief.actions.length > 0 && (
                            <div className="brief-actions">
                                <h3>Do next</h3>
                                <ol>
                                    {brief.actions.map((a) => <li key={a}>{a}</li>)}
                                </ol>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

export default SituationBrief;
