import { useState } from 'react';
import { Send } from 'lucide-react';
import { API } from '../session';

const URGENCIES = [
    { value: 'Critical', help: 'people at risk within 24 hours' },
    { value: 'High', help: 'needed within 2 to 3 days' },
    { value: 'Moderate', help: 'comfort or planning' },
];

function NewRequestForm({ shelter, onCreated }) {
    const [item, setItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [urgency, setUrgency] = useState('High');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState([]);
    const [success, setSuccess] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSuccess('');
        try {
            const res = await fetch(`${API}/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item, quantity, urgency, reason }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            setSuccess(`${data.request_id} sent to the coordinator for review`);
            setItem('');
            setQuantity('');
            setReason('');
            setUrgency('High');
            onCreated();
        } catch (err) {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <section className="card">
            <h2>New request</h2>
            <p className="muted small-note">
                For {shelter ? shelter.name : 'your shelter'}. The coordinator reviews every request before it is dispatched.
            </p>
            <form className="form request-form" onSubmit={handleSubmit}>
                <label>
                    Item
                    <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="water" />
                </label>
                <label>
                    Quantity
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                </label>
                <label>
                    Urgency
                    <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                        {URGENCIES.map((u) => (
                            <option key={u.value} value={u.value}>{u.value}: {u.help}</option>
                        ))}
                    </select>
                </label>
                {urgency === 'Critical' && (
                    <label className="full">
                        Why is this critical?
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 40 elderly residents, no clean water since this morning" />
                    </label>
                )}
                <div className="actions full">
                    <button type="submit" className="icon-text"><Send size={16} /> Send request</button>
                </div>
                {errors.length > 0 && (
                    <ul className="errors full">
                        {errors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                )}
                {success && <p className="success full">{success}</p>}
            </form>
        </section>
    );
}

export default NewRequestForm;
