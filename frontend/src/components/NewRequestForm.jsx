import { useState } from 'react';
import { Hospital, Package, Send } from 'lucide-react';
import ItemPicker from './ItemPicker';
import UrgencyHint from './UrgencyHint';
import SpecialtyHint from './SpecialtyHint';
import { API } from '../session';
import { SPECIALTIES } from '../specialties';

const URGENCIES = [
    { value: 'Critical', help: 'people at risk within 24 hours', ask: 'Why is this critical?', example: 'e.g. 40 elderly residents, no clean water since this morning' },
    { value: 'High', help: 'needed within 2 to 3 days', ask: 'Why do you need this soon?', example: 'e.g. Supplies run out on Thursday' },
    { value: 'Moderate', help: 'comfort or planning', ask: 'What is this for?', example: 'e.g. Restocking for next week' },
];

// One card for supplies or a doctor. Shelters send for themselves; coordinators pick a shelter.
function NewRequestForm({ shelter, shelters, items = [], onCreated, asCoordinator, startKind = 'supplies' }) {
    const [kind, setKind] = useState(startKind);
    const [shelterId, setShelterId] = useState('');
    const [item, setItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [urgency, setUrgency] = useState('High');
    const [reason, setReason] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [errors, setErrors] = useState([]);
    const [success, setSuccess] = useState('');

    const doctor = kind === 'doctor';
    const chosen = items.find((i) => i.item === item.trim().toLowerCase());
    const level = URGENCIES.find((u) => u.value === urgency);
    const forShelter = asCoordinator
        ? (shelters || []).find((s) => s.shelter_id === shelterId)
        : shelter;

    function switchKind(next) {
        setKind(next);
        setErrors([]);
        setSuccess('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSuccess('');
        const problems = [];
        if (asCoordinator && !forShelter) problems.push('Choose a shelter');
        if (doctor) {
            if (!SPECIALTIES.includes(specialty)) problems.push('Choose a medical specialty');
            if (!reason.trim()) problems.push('Say why you need a doctor');
        } else {
            if (!chosen) problems.push(item.trim() ? `Choose an item from the list. Warehouses do not stock ${item.trim()}` : 'Choose an item');
            if (!reason.trim()) problems.push('Say why you need this');
        }
        if (problems.length > 0) {
            setErrors(problems);
            return;
        }
        try {
            const res = await fetch(`${API}/${doctor ? 'medical' : 'requests'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(doctor
                    ? { specialty, reason, ...(asCoordinator ? { shelter_id: forShelter.shelter_id } : {}) }
                    : { item: chosen.item, quantity, urgency, reason, ...(asCoordinator ? { shelter_id: forShelter.shelter_id } : {}) }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            if (doctor) {
                if (data.status === 'Awaiting review') {
                    setSuccess(`${data.medical_id} sent to the coordinator for review`);
                } else if (data.status === 'Dispatched') {
                    setSuccess(`${data.medical_id}: ${data.specialty} assigned to ${data.doctor_name || data.doctor_id} at ${data.hospital_name || data.hospital_id}.`);
                } else {
                    setSuccess(`${data.medical_id}: no matching doctor is free. Marked ${data.status}.`);
                }
                setSpecialty('');
                setReason('');
            } else {
                setSuccess(asCoordinator
                    ? `${data.request_id} logged for ${forShelter.name}. Ready for the next allocation run.`
                    : `${data.request_id} sent to the coordinator for review`);
                setItem('');
                setQuantity('');
                setReason('');
                setUrgency('High');
            }
            if (asCoordinator) setShelterId('');
            onCreated();
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    const note = asCoordinator
        ? (doctor
            ? 'Logging this assigns the nearest hospital with a free doctor of that specialty.'
            : 'Use this when a shelter called in, or you are logging a need yourself. It is approved straight away and goes out in the next allocation run.')
        : (doctor
            ? `For ${shelter ? shelter.name : 'your shelter'}. The coordinator reviews the request, then the nearest matching doctor is assigned.`
            : `For ${shelter ? shelter.name : 'your shelter'}. The coordinator reviews supply requests before they go out.`);

    return (
        <section className="card">
            <div className="panel-header">
                <div>
                    <h2>New request</h2>
                    <p className="muted small-note">{note}</p>
                </div>
                <div className="toggle request-kind">
                    <button type="button" className={!doctor ? 'active' : ''} onClick={() => switchKind('supplies')}>
                        <Package size={15} /> Supplies
                    </button>
                    <button type="button" className={doctor ? 'active' : ''} onClick={() => switchKind('doctor')}>
                        <Hospital size={15} /> Doctor
                    </button>
                </div>
            </div>
            <form className="form request-form" onSubmit={handleSubmit}>
                {asCoordinator && (
                    <label className={doctor ? 'full' : ''}>
                        Shelter
                        <select value={shelterId} onChange={(e) => setShelterId(e.target.value)}>
                            <option value="">Choose a shelter</option>
                            {(shelters || []).map((s) => (
                                <option key={s.shelter_id} value={s.shelter_id}>{s.name}</option>
                            ))}
                        </select>
                    </label>
                )}
                {doctor ? (
                    <>
                        <label className={asCoordinator ? '' : 'full'}>
                            Specialty needed
                            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                                <option value="">Choose a specialty</option>
                                {SPECIALTIES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </label>
                        <label className="full">
                            Why do you need this doctor?
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Two children with high fever since last night, no medicine left" />
                        </label>
                        <SpecialtyHint specialty={specialty} reason={reason} onSwitch={setSpecialty} />
                    </>
                ) : (
                    <>
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
                    </>
                )}
                <div className="actions full">
                    <button type="submit" className="icon-text">
                        {doctor ? <Hospital size={16} /> : <Send size={16} />}
                        {doctor ? 'Request doctor' : asCoordinator ? 'Log request' : 'Send request'}
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
