import { useState } from 'react';

const API = 'http://localhost:3000/api';

function NewRequestForm({ shelters, onCreated }) {
    const [shelterId, setShelterId] = useState('');
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
                body: JSON.stringify({ shelter_id: shelterId, item, quantity, urgency, reason }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            setSuccess(`Request ${data.request_id} added`);
            setItem('');
            setQuantity('');
            setReason('');
            onCreated();
        } catch (err) {
            setErrors(['Could not reach the server. Is the backend running?']);
        }
    }

    return (
        <section className="card">
            <h2>New request</h2>
            <form className="form" onSubmit={handleSubmit}>
                <label>
                    Shelter
                    <select value={shelterId} onChange={(e) => setShelterId(e.target.value)}>
                        <option value="">Choose a shelter</option>
                        {shelters.map((s) => (
                            <option key={s.shelter_id} value={s.shelter_id}>{s.name}</option>
                        ))}
                    </select>
                </label>

                <label>
                    Item
                    <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="water" />
                </label>

                <label>
                    Quantity
                    <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                </label>

                <label>
                    Urgency
                    <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                        <option value="Critical">Critical: people at risk within 24 hours</option>
                        <option value="High">High: needed within 2 to 3 days</option>
                        <option value="Moderate">Moderate: comfort or planning</option>
                    </select>
                </label>

                {urgency === 'Critical' && (
                    <label className="full">
                        Reason (required for Critical)
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No drinking water since this morning, 120 people" />
                    </label>
                )}

                <button type="submit">Add request</button>
            </form>

            {errors.length > 0 && (
                <ul className="errors">
                    {errors.map((msg) => <li key={msg}>{msg}</li>)}
                </ul>
            )}
            {success && <p className="success">{success}</p>}
        </section>
    );
}

export default NewRequestForm;
