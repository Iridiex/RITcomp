import { createContext, useContext, useState } from 'react';

const InspectContext = createContext(null);

export function InspectProvider({ data, children }) {
    const [stack, setStack] = useState([]);

    function open(type, id) {
        setStack((s) => {
            const top = s[s.length - 1];
            if (top && top.type === type && top.id === id) return s;
            return [...s, { type, id }];
        });
    }

    const value = {
        data,
        current: stack[stack.length - 1] || null,
        canGoBack: stack.length > 1,
        open,
        back: () => setStack((s) => s.slice(0, -1)),
        close: () => setStack([]),
    };

    return <InspectContext.Provider value={value}>{children}</InspectContext.Provider>;
}

export function useInspect() {
    return useContext(InspectContext);
}

export function IdLink({ type, id, label, chip }) {
    const inspect = useInspect();
    if (!id) return null;
    if (!inspect) return <span>{label || id}</span>;
    return (
        <button
            type="button"
            className={`id-link ${chip ? 'chip-style' : ''}`}
            title={`Show everything linked to ${id}`}
            onClick={(e) => {
                e.stopPropagation();
                inspect.open(type, id);
            }}
        >
            {label || id}
        </button>
    );
}
