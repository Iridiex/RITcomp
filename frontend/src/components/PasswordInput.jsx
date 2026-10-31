import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// `shown`/`onToggle` are optional: pass them to control visibility from outside, otherwise it manages itself.
// `label` names the input directly, so the toggle button inside the <label> is not read out as part of its name.
function PasswordInput({ label, shown: shownProp, onToggle, ...inputProps }) {
    const [ownShown, setOwnShown] = useState(false);
    const shown = shownProp ?? ownShown;
    const toggle = onToggle ?? (() => setOwnShown((s) => !s));

    return (
        <span className="password-input">
            <input {...inputProps} aria-label={label} type={shown ? 'text' : 'password'} />
            <button
                type="button"
                className="password-toggle"
                onClick={toggle}
                aria-label={shown ? 'Hide password' : 'Show password'}
                aria-pressed={shown}
                title={shown ? 'Hide password' : 'Show password'}
            >
                {shown ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </span>
    );
}

export default PasswordInput;
