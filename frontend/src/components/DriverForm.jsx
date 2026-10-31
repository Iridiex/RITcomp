import { useState } from 'react';
import LoginFields from './LoginFields';
import { API } from '../session';
import { NO_LOGIN, loginNote } from '../accounts';

function DriverForm({ driver, currentLogin, onSaved, onCancel }) {
    const editing = driver !== null;
    const [name, setName] = useState(editing ? driver.name : '');
    const [phone, setPhone] = useState(editing && driver.phone ? driver.phone : '');
    const [login, setLogin] = useState(NO_LOGIN);
    const [errors, setErrors] = useState([]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        try {
            const res = await fetch(editing ? `${API}/drivers/${driver.driver_id}` : `${API}/drivers`, {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, login }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            onSaved(`${data.driver_id} ${data.name} ${editing ? 'updated' : 'added'}.${loginNote(login, data.username)}`);
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>

            <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Ali" />
            </label>
            <label>
                Phone (optional)
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 050-123-4567" />
            </label>

            <LoginFields current={currentLogin} value={login} onChange={setLogin} />

            {errors.length > 0 && (
                <ul className="errors full">
                    {errors.map((err) => <li key={err}>{err}</li>)}
                </ul>
            )}

            <div className="actions full">
                <button type="submit">{editing ? 'Save changes' : 'Add driver'}</button>
                <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

export default DriverForm;
