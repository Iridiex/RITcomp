import { useState } from 'react';
import { API } from '../session';
import PasswordInput from './PasswordInput';

const ROLE_LABELS = { coordinator: 'Coordinator', shelter: 'Shelter', warehouse: 'Warehouse', driver: 'Driver' };

function AccountPanel({ user, onSessionChange }) {
    const [username, setUsername] = useState(user.username);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [errors, setErrors] = useState([]);
    const [success, setSuccess] = useState('');

    const linkedTo = user.shelter_id || user.warehouse_id || user.driver_id;
    const details = [
        ['Name', user.name],
        ['Role', ROLE_LABELS[user.role]],
        linkedTo ? [`${ROLE_LABELS[user.role]} ID`, linkedTo] : null,
        ['Current username', user.username],
    ].filter(Boolean);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrors([]);
        setSuccess('');
        if (newPassword !== confirmPassword) {
            setErrors(['The two new passwords do not match']);
            return;
        }
        try {
            const res = await fetch(`${API}/auth/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, username, new_password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrors(data.errors || [data.error]);
                return;
            }
            const changed = [
                data.user.username !== user.username ? `username is now ${data.user.username}` : null,
                newPassword ? 'password is changed' : null,
            ].filter(Boolean);
            setSuccess(`Saved. Your ${changed.join(' and your ')}. Use it next time you log in.`);
            setNewPassword('');
            setConfirmPassword('');
            setCurrentPassword('');
            onSessionChange({ token: data.token, user: data.user });
        } catch {
            setErrors(['Could not reach the server']);
        }
    }

    return (
        <section className="card">
            <h2>Your account</h2>
            <dl className="account-details">
                {details.map(([label, value]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>

            <h2>Change login details</h2>
            <form className="form account-form" onSubmit={handleSubmit}>
                <label className="full">
                    New username
                    <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                </label>
                <label>
                    New password
                    <PasswordInput label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password" placeholder="Leave blank to keep it" />
                </label>
                <label>
                    Repeat new password
                    <PasswordInput label="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password" />
                </label>
                <label className="full">
                    Current password
                    <PasswordInput label="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password" placeholder="Needed to confirm any change" />
                </label>

                {errors.length > 0 && (
                    <ul className="errors full">
                        {errors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                )}
                {success && <p className="success full">{success}</p>}

                <div className="actions full">
                    <button type="submit">Save changes</button>
                </div>
            </form>
        </section>
    );
}

export default AccountPanel;
