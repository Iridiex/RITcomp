import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { API } from '../session';

const MIN_LENGTH = 8;
const DELAY_MS = 900;

function UrgencyHint({ item, quantity, reason, urgency, onSwitch }) {
    const text = reason.trim();
    const key = text.length >= MIN_LENGTH ? JSON.stringify([item, quantity, text]) : '';
    const [hint, setHint] = useState(null);
    const [checking, setChecking] = useState('');

    useEffect(() => {
        if (!key) return undefined;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setChecking(key);
            try {
                const [i, q, r] = JSON.parse(key);
                const res = await fetch(`${API}/urgency/check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item: i, quantity: q, reason: r }),
                    signal: controller.signal,
                });
                if (res.ok) setHint({ key, result: await res.json() });
            } catch {
                // aborted or offline: show nothing
            }
            setChecking((current) => (current === key ? '' : current));
        }, DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [key]);

    const result = hint && hint.key === key ? hint.result : null;

    if (!result) {
        if (key && checking === key) {
            return <p className="ai-hint full checking"><Sparkles size={15} /> Checking how urgent this sounds…</p>;
        }
        return null;
    }

    if (result.suggested === urgency) {
        return (
            <p className="ai-hint full ok">
                <Sparkles size={15} />
                <span><strong>{urgency}</strong> fits what you wrote. {result.why}</span>
            </p>
        );
    }

    return (
        <div className="ai-hint full warn">
            <Sparkles size={15} />
            <span>This sounds <strong>{result.suggested}</strong>, not {urgency}. {result.why}</span>
            <button type="button" onClick={() => onSwitch(result.suggested)}>Switch to {result.suggested}</button>
        </div>
    );
}

export default UrgencyHint;
