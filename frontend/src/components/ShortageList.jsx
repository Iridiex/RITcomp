import { HandHeart } from 'lucide-react';

function ShortageList({ shortages }) {
    return (
        <section className="card">
            <h2><HandHeart size={20} /> Shelters are waiting for</h2>
            {shortages.length === 0 ? (
                <p className="muted">Every shelter has what it asked for. Nothing is waiting on stock.</p>
            ) : (
                <>
                    <p className="muted small-note">
                        Stock you add for these items goes straight out to these shelters, most urgent first.
                    </p>
                    <ul className="shortage-list">
                        {shortages.map((s) => (
                            <li key={s.item} className={s.critical > 0 ? 'critical' : ''}>
                                <span className="shortage-amount">{s.short}</span>
                                <span className="shortage-item">
                                    <strong>{s.item}</strong>
                                    <span className="muted">
                                        {s.requests} shelter request{s.requests === 1 ? '' : 's'}
                                        {s.critical > 0 && <> · <span className="shortage-critical">{s.critical} critical</span></>}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}

export default ShortageList;
