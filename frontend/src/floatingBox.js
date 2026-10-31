import { useEffect, useState } from 'react';

const MIN_W = 320;
const MIN_H = 360;
const MARGIN = 8;
const PHONE = '(max-width: 640px)';

function defaultBox() {
    const w = Math.min(400, window.innerWidth - 48);
    const h = Math.min(600, window.innerHeight - 48);
    return { x: window.innerWidth - w - 24, y: window.innerHeight - h - 24, w, h };
}

// Keeps the panel fully on screen and no smaller than usable
function fit(box) {
    const w = Math.max(MIN_W, Math.min(box.w, window.innerWidth - 2 * MARGIN));
    const h = Math.max(MIN_H, Math.min(box.h, window.innerHeight - 2 * MARGIN));
    return {
        w,
        h,
        x: Math.max(MARGIN, Math.min(box.x, window.innerWidth - w - MARGIN)),
        y: Math.max(MARGIN, Math.min(box.y, window.innerHeight - h - MARGIN)),
    };
}

function savedBox(key) {
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(saved[k]))) return fit(saved);
    } catch {
        // fall through to the default position
    }
    return fit(defaultBox());
}

// A panel the user can drag by its header and resize from its corner; on phones it stays a bottom sheet
export function useFloatingBox(key) {
    const [box, setBox] = useState(() => savedBox(key));
    const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);

    useEffect(() => {
        const query = window.matchMedia(PHONE);
        const onChange = () => setPhone(query.matches);
        const onResize = () => setBox((b) => fit(b));
        query.addEventListener('change', onChange);
        window.addEventListener('resize', onResize);
        return () => {
            query.removeEventListener('change', onChange);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(box));
    }, [key, box]);

    function start(e, mode) {
        if (phone || e.button !== 0) return;
        if (mode === 'move' && e.target.closest('button')) return;
        e.preventDefault();
        const from = { px: e.clientX, py: e.clientY, ...box };
        const move = (ev) => {
            const dx = ev.clientX - from.px;
            const dy = ev.clientY - from.py;
            setBox(fit(mode === 'move'
                ? { ...from, x: from.x + dx, y: from.y + dy }
                : {
                    ...from,
                    w: Math.min(from.w + dx, window.innerWidth - from.x - MARGIN),
                    h: Math.min(from.h + dy, window.innerHeight - from.y - MARGIN),
                }));
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            document.body.classList.remove('box-dragging', `box-${mode}`);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        document.body.classList.add('box-dragging', `box-${mode}`);
    }

    return {
        phone,
        style: phone ? undefined : { left: box.x, top: box.y, width: box.w, height: box.h, right: 'auto', bottom: 'auto' },
        onMoveStart: (e) => start(e, 'move'),
        onResizeStart: (e) => start(e, 'resize'),
        reset: () => setBox(fit(defaultBox())),
    };
}
