import { useState } from 'react';
import { setNoteLanguage, useNoteLanguage, originalsOf, stageLabel } from '../noteLanguage';

export function NoteLanguageToggle() {
    const lang = useNoteLanguage();
    return (
        <div className="lang-toggle" role="group" aria-label="Language of driver notes">
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setNoteLanguage('en')}>English</button>
            <button type="button" className={lang === 'ar' ? 'active' : ''} onClick={() => setNoteLanguage('ar')} lang="ar">العربية</button>
        </div>
    );
}

// Text from a driver in the chosen language, with the driver's own words one tap away
export function NoteText({ shipment, kinds, block = false, children }) {
    const lang = useNoteLanguage();
    const [open, setOpen] = useState(false);
    const originals = originalsOf(shipment, kinds, lang);
    const languages = [...new Set(originals.map((n) => n.language))].join(', ');
    const Box = block ? 'div' : 'span';

    return (
        <Box className="note-text">
            <Box dir="auto" lang={lang === 'ar' ? 'ar' : undefined}>{children}</Box>
            {originals.length > 0 && (
                <button type="button" className="note-original-toggle" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
                    {open ? 'Hide original' : `Original (${languages})`}
                </button>
            )}
            {open && (
                <span className="note-originals">
                    {originals.map((n) => (
                        <span key={n.kind + n.stage + n.original} dir="auto">
                            {n.kind === 'damage' ? `${stageLabel(n.stage, 'en')}: ` : ''}{n.original}
                        </span>
                    ))}
                </span>
            )}
        </Box>
    );
}
