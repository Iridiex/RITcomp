import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, RotateCcw, Check, CircleAlert, Undo2 } from 'lucide-react';
import { API } from '../session';
import { IdLink } from '../inspect';
import { useInspect } from '../inspectContext';
import Logo from './Logo';
import { runActions, historyText, canUndo, undoAction } from '../assistantActions';
import { useFloatingBox } from '../floatingBox';

const STARTERS = [
    'What needs my attention right now?',
    'Which shelters are still short, and of what?',
    'How much stock do we have of each item?',
    'Which deliveries failed or had damage today?',
];

const ID_PATTERN = /\b(RQ-\d+|SHP-\d+|SH-\d+|WH-\d+|DR-\d+)\b/g;
const TYPES = [['RQ-', 'request', 'requests', 'request_id'], ['SHP-', 'shipment', 'shipments', 'shipment_id'], ['SH-', 'shelter', 'shelters', 'shelter_id'], ['WH-', 'warehouse', 'warehouses', 'warehouse_id'], ['DR-', 'driver', 'drivers', 'driver_id']];

const WAITING_STEPS = ['Reading requests', 'Checking stock', 'Looking at shipments'];

function Thinking() {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setStep((n) => Math.min(n + 1, WAITING_STEPS.length - 1)), 1100);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="assistant-msg from-assistant thinking" role="status" aria-label="The assistant is answering">
            <Logo size={22} className="thinking-logo" />
            <div className="thinking-text">
                <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                <span key={step} className="thinking-step">{WAITING_STEPS[step]}…</span>
            </div>
        </div>
    );
}

// Turns IDs in a reply into links, but only IDs that really exist
function ReplyText({ text }) {
    const inspect = useInspect();
    const parts = text.split(ID_PATTERN);
    return parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const [, type, list, key] = TYPES.find(([prefix]) => part.startsWith(prefix));
        const known = inspect && (inspect.data[list] || []).some((row) => row[key] === part);
        return known ? <IdLink key={i} type={type} id={part} /> : part;
    });
}

// Nothing the assistant prepares happens until the coordinator presses Confirm
function ActionCard({ message, onConfirm, onCancel, onUndo }) {
    const { actions, state, results = [] } = message;
    return (
        <div className={`action-card state-${state}`}>
            <div className="action-card-title">
                {state === 'waiting' && 'Needs your approval'}
                {state === 'running' && 'Working…'}
                {state === 'done' && (results.every((r) => r.ok) ? 'Done' : 'Stopped')}
                {state === 'cancelled' && 'Cancelled, nothing was changed'}
                {state === 'expired' && 'Not confirmed, nothing was changed'}
            </div>
            <ol>
                {actions.map((a, i) => <li key={i}><ReplyText text={a.summary} /></li>)}
            </ol>
            {results.length > 0 && (
                <ul className="action-results">
                    {results.map((r, i) => (
                        <li key={i} className={r.ok ? 'ok' : 'failed'}>
                            {r.ok ? <Check size={14} /> : <CircleAlert size={14} />}
                            <span className="action-result-text">
                                <ReplyText text={r.text} />
                                {r.undone && <span className="muted"> · <ReplyText text={r.undone} /></span>}
                                {r.undoError && <span className="action-undo-error"> · {r.undoError}</span>}
                            </span>
                            {r.ok && !r.undone && canUndo(actions[i]) && (
                                <button className="link-button" disabled={r.undoing} onClick={() => onUndo(i)}>
                                    <Undo2 size={13} /> {r.undoing ? 'Undoing…' : 'Undo'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {state === 'waiting' && (
                <div className="actions">
                    <button className="small" onClick={onConfirm}>Confirm</button>
                    <button className="secondary small" onClick={onCancel}>Cancel</button>
                </div>
            )}
        </div>
    );
}

// `messages` lives in the workspace so the conversation survives moving between pages
function Assistant({ messages, setMessages, onChanged }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const bodyRef = useRef(null);
    const inputRef = useRef(null);
    const panel = useFloatingBox('relief-assistant-box');

    useEffect(() => {
        const body = bodyRef.current;
        if (body) body.scrollTop = body.scrollHeight;
    }, [open, messages, busy]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    async function ask(text) {
        const question = text.trim();
        if (!question || busy) return;
        // A card left unconfirmed may no longer match the data, so it can't be confirmed later
        const earlier = messages.map((m) => (m.state === 'waiting' ? { ...m, state: 'expired' } : m));
        const next = [...earlier, { role: 'user', text: question }];
        setMessages(next);
        setDraft('');
        setError('');
        setBusy(true);
        try {
            const res = await fetch(`${API}/assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: historyText(m) })) }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'The assistant could not answer');
            else {
                const actions = data.actions || [];
                setMessages([...next, { role: 'assistant', text: data.reply, actions, state: actions.length ? 'waiting' : undefined }]);
            }
        } catch {
            setError('Could not reach the server');
        }
        setBusy(false);
    }

    const update = (index, changes) => setMessages((list) => list.map((m, i) => (i === index ? { ...m, ...changes } : m)));

    async function confirm(index) {
        update(index, { state: 'running' });
        const results = await runActions(messages[index].actions);
        update(index, { state: 'done', results });
        onChanged();
    }

    function updateResult(index, i, changes) {
        setMessages((list) => list.map((m, n) => (n === index
            ? { ...m, results: m.results.map((r, k) => (k === i ? { ...r, ...changes } : r)) }
            : m)));
    }

    // Pressing Undo is the coordinator's approval, so it runs straight away
    async function undo(index, i) {
        updateResult(index, i, { undoing: true, undoError: null });
        try {
            const text = await undoAction(messages[index].actions[i]);
            updateResult(index, i, { undoing: false, undone: text });
            onChanged();
        } catch (err) {
            updateResult(index, i, { undoing: false, undoError: `couldn't undo: ${err.message}` });
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            ask(draft);
        }
    }

    if (!open) {
        return (
            <button className="assistant-fab" onClick={() => setOpen(true)} title="Ask about the operation">
                <MessageCircle size={20} /> <span>Ask</span>
            </button>
        );
    }

    return (
        <section className="assistant" role="dialog" aria-label="Assistant" style={panel.style}>
            <header
                className={`assistant-head ${panel.phone ? '' : 'movable'}`}
                onPointerDown={panel.onMoveStart}
                onDoubleClick={(e) => { if (!e.target.closest('button')) panel.reset(); }}
                title={panel.phone ? undefined : 'Drag to move · double-click to put it back'}
            >
                <div>
                    <strong>Ask about the operation</strong>
                    <span className="muted">Answers from live data · asks before changing anything</span>
                </div>
                {messages.length > 0 && (
                    <button className="icon-button" title="Start over" onClick={() => { setMessages([]); setError(''); }}>
                        <RotateCcw size={16} />
                    </button>
                )}
                <button className="icon-button" title="Close" onClick={() => setOpen(false)}>
                    <X size={18} />
                </button>
            </header>

            <div className="assistant-body" ref={bodyRef}>
                {messages.length === 0 && (
                    <div className="assistant-starters">
                        <p className="muted">
                            Ask anything about requests, stock, shipments or drivers, in any language. It can also approve or reject requests,
                            assign drivers, run allocation and clear alerts, but only after you confirm.
                        </p>
                        {STARTERS.map((q) => (
                            <button key={q} className="secondary small" onClick={() => ask(q)}>{q}</button>
                        ))}
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`assistant-msg from-${m.role}`} dir="auto">
                        {m.role === 'assistant' ? <ReplyText text={m.text} /> : m.text}
                        {m.actions && m.actions.length > 0 && (
                            <ActionCard
                                message={m}
                                onConfirm={() => confirm(i)}
                                onCancel={() => update(i, { state: 'cancelled' })}
                                onUndo={(n) => undo(i, n)}
                            />
                        )}
                    </div>
                ))}
                {busy && <Thinking />}
                {error && <p className="errors">{error}</p>}
            </div>

            <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
                <textarea
                    ref={inputRef}
                    rows={1}
                    dir="auto"
                    value={draft}
                    maxLength={1000}
                    placeholder="e.g. Which shelter is shortest of water?"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <button type="submit" disabled={busy || !draft.trim()} title="Send"><Send size={16} /></button>
            </form>
            {!panel.phone && <div className="assistant-resize" onPointerDown={panel.onResizeStart} title="Drag to resize" />}
        </section>
    );
}

export default Assistant;
