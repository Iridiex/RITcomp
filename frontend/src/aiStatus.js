import { useEffect, useState } from 'react';
import { API } from './session';

let status = null;

function loadStatus() {
    if (!status) {
        status = fetch(`${API}/ai/status`)
            .then((res) => (res.ok ? res.json() : { enabled: false }))
            .then((data) => Boolean(data.enabled))
            .catch(() => {
                status = null;
                return false;
            });
    }
    return status;
}

export function useAiEnabled() {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
        let cancelled = false;
        loadStatus().then((value) => { if (!cancelled) setEnabled(value); });
        return () => { cancelled = true; };
    }, []);
    return enabled;
}
