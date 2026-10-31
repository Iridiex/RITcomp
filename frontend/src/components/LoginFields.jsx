import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import PasswordInput from './PasswordInput';

// Leaves out look-alike characters (0/o, 1/l/i) so the password is easy to read out to someone
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

function makePassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('');
}

function LoginFields({ current, value, onChange }) {
    const [shown, setShown] = useState(false);
    const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
    const passwordLabel = current ? 'New password' : 'Password';

    function generate() {
        onChange({ ...value, password: makePassword() });
        setShown(true);
    }

    return (
        <fieldset className="full login-fields">
            <legend className="icon-text"><KeyRound size={16} /> Login</legend>
            <p className="muted small-note">
                {current
                    ? <>Logs in as <strong>{current}</strong>. Type a new password only if you want to reset it.</>
                    : 'Optional. Give them a username and password so they can log in. You can also add this later.'}
            </p>
            <div className="login-grid">
                {!current && (
                    <label>
                        Username
                        <input value={value.username} onChange={set('username')} autoComplete="off" placeholder="e.g. karama-hall" />
                    </label>
                )}
                <div className="password-row">
                    <label>
                        {passwordLabel}
                        <PasswordInput
                            label={passwordLabel}
                            value={value.password}
                            onChange={set('password')}
                            shown={shown}
                            onToggle={() => setShown((s) => !s)}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                        />
                    </label>
                    <button type="button" className="secondary small" onClick={generate}>
                        Generate
                    </button>
                </div>
            </div>
        </fieldset>
    );
}

export default LoginFields;
