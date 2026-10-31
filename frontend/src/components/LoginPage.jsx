import { useState } from 'react';
import { LogIn, ClipboardList, Building2, Warehouse, Truck } from 'lucide-react';
import { API } from '../session';

const DEMO = [
    { role: 'Coordinator', username: 'coordinator', password: 'relief2026', icon: ClipboardList },
    { role: 'Shelter', username: 'sh01', password: 'shelter2026', icon: Building2 },
    { role: 'Warehouse', username: 'wh1', password: 'warehouse2026', icon: Warehouse },
    { role: 'Driver', username: 'ahmed', password: 'driver2026', icon: Truck },
];

function LoginPage({ onLogin, notice }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
                setBusy(false);
                return;
            }
            onLogin({ token: data.token, user: data.user });
        } catch (err) {
            setError('Could not reach the server. Is the backend running?');
            setBusy(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-brand">
                <div className="brand-mark">RD</div>
                <h1>Relief dispatch</h1>
                <p>
                    Shelters request supplies, coordinators approve and dispatch, warehouses manage stock
                    and drivers deliver, with every item tracked from request to arrival.
                </p>
            </div>

            <div className="login-panel">
                <div className="login-card">
                    <h2>Log in</h2>
                    <p className="muted">Use the account for your role.</p>
                    {notice && <p className="message">{notice}</p>}

                    <form onSubmit={submit}>
                        <label>
                            Username
                            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
                        </label>
                        <label>
                            Password
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                        </label>
                        {error && <p className="errors">{error}</p>}
                        <button type="submit" className="icon-text login-submit" disabled={busy}>
                            <LogIn size={18} /> {busy ? 'Logging in...' : 'Log in'}
                        </button>
                    </form>

                    <div className="demo-title">Demo accounts</div>
                    <div className="demo-grid">
                        {DEMO.map((d) => {
                            const Icon = d.icon;
                            return (
                                <button
                                    key={d.username}
                                    type="button"
                                    className="demo-account"
                                    onClick={() => {
                                        setUsername(d.username);
                                        setPassword(d.password);
                                        setError('');
                                    }}
                                >
                                    <Icon size={18} />
                                    <span>{d.role}<small>{d.username}</small></span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
