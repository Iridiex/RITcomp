import { useState } from 'react';
import { Send } from 'lucide-react';
import ItemPicker from './ItemPicker';
import UrgencyHint from './UrgencyHint';
import { API } from '../session';

const URGENCIES = [
    { value: 'Critical', help: 'people at risk within 24 hours', ask: 'Why is this critical?', example: 'e.g. 40 elderly residents, no clean water since this morning' },
    { value: 'High', help: 'needed within 2 to 3 days', ask: 'Why do you need this soon?', example: 'e.g. Supplies run out on Thursday' },
    { value: 'Moderate', help: 'comfort or planning', ask: 'What is this for?', example: 'e.g. Restocking for next week' },
];

// Shelters send for themselves (goes to review). Coordinators pick a shelter and it is approved at once.
function NewRequestForm({ shelter, shelters, items, onCreated, asCoordinator }) {
    const [shelterId, setShelterId] = useState('');
    const [item, setItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [urgency, setUrgency] = useState('High');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState([]);
    const [success, setSuccess] = useState('');

    const chosen = items.find((i) => i.item === item.trim().toLowerCase());
    const level = URGENCIES.find((u) => u.value === urgency);
    const forShelter = asCoordinator
        ? (shelters || []).find((s) => s.shelter_id === shelterId)
        : shelter;

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSuccess('');
        const problems = [];
        if (asCoordinator && !forShelter) problems.push('Choose a shelter');
        if (!chosen) problems.push(item.trim() ? `Choose an item from the list. Warehouses do not stock ${item.trim()}` : 'Choose an item');
        if (!reason.trim()) problems.push('Say why you need this');
        if (problems.length > 0) {
            setErrors(problems);
            return;
        }
        try {
            const body = { item: chosen.item, quantity, urgency, reason };
            if (asCoordinator) body.shelter_id = forShelter.shelter_id;
            const res = await fetch(`${API}/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            setSuccess(asCoordinator
                ? `${data.request_id} logged for ${forShelter.name}. Ready for the next allocation run.`
                : `${data.request_id} sent to the coordinator for review`);
            setItem('');
            setQuantity('');
            setReason('');
            setUrgency('High');
            if (asCoordinator) setShelterId('');
            onCreated();
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <section className="card">
            <h2>{asCoordinator ? 'Log a request for a shelter' : 'New request'}</h2>
            <p className="muted small-note">
                {asCoordinator
                    ? 'Use this when a shelter called in, or you are logging a need yourself. It is approved straight away and goes out in the next allocation run.'
                    : `For ${shelter ? shelter.name : 'your shelter'}. The coordinator reviews every request before it is dispatched.`}
            </p>
            <form className="form request-form" onSubmit={handleSubmit}>
                {asCoordinator && (
                    <label>
                        Shelter
                        <select value={shelterId} onChange={(e) => setShelterId(e.target.value)}>
                            <option value="">Choose a shelter</option>
                            {(shelters || []).map((s) => (
                                <option key={s.shelter_id} value={s.shelter_id}>{s.name}</option>
                            ))}
                        </select>
                    </label>
                )}
                <label>
                    Item
                    <ItemPicker items={items} value={item} onChange={setItem} invalid={item.trim() !== '' && !chosen} />
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
                <label className="full">
                    {level.ask}
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={level.example} />
                </label>
                <UrgencyHint item={chosen ? chosen.item : ''} quantity={quantity} reason={reason} urgency={urgency} onSwitch={setUrgency} />
                <div className="actions full">
                    <button type="submit" className="icon-text">
                        <Send size={16} /> {asCoordinator ? 'Log request' : 'Send request'}
                    </button>
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
