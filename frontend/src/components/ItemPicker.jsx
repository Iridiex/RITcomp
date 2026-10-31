import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

function ItemPicker({ items, value, onChange, invalid }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const listId = useId();
    const box = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onPointer = (e) => {
            if (box.current && !box.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', onPointer);
        return () => document.removeEventListener('pointerdown', onPointer);
    }, [open]);

    const term = value.trim().toLowerCase();
    const exact = items.some((i) => i.item === term);
    const shown = exact ? items : items.filter((i) => i.item.includes(term));

    function choose(item) {
        onChange(item.item);
        setOpen(false);
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === 'Enter' && open && shown[active]) {
            e.preventDefault();
            choose(shown[active]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    }

    return (
        <div ref={box} className={`item-picker ${invalid ? 'invalid' : ''}`}>
            <input
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                value={value}
                placeholder="Start typing, e.g. water"
                onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
            />
            <ChevronDown size={16} className="item-picker-caret" />
            {open && (
                <ul className="item-picker-list" id={listId} role="listbox">
                    {shown.length === 0 ? (
                        <li className="item-picker-empty">No warehouse stocks “{value.trim()}”</li>
                    ) : (
                        shown.map((i, index) => (
                            <li
                                key={i.item}
                                role="option"
                                aria-selected={index === active}
                                className={index === active ? 'active' : ''}
                                onMouseDown={(e) => { e.preventDefault(); choose(i); }}
                                onMouseEnter={() => setActive(index)}
                            >
                                <span className="item-picker-name">{i.item}</span>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

export default ItemPicker;
