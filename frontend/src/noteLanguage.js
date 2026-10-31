import { useSyncExternalStore } from 'react';

const KEY = 'relief-note-language';
const listeners = new Set();

const STAGE_AR = {
    'At pickup': 'عند الاستلام',
    'On arrival': 'عند الوصول',
    'When delivery failed': 'عند تعذر التسليم',
    'Back at warehouse': 'عند العودة إلى المستودع',
};

function read() {
    try {
        return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en';
    } catch {
        return 'en';
    }
}

let current = read();

export function setNoteLanguage(lang) {
    current = lang;
    try {
        localStorage.setItem(KEY, lang);
    } catch {
        // private mode: keep it for this visit only
    }
    listeners.forEach((fn) => fn());
}

export function useNoteLanguage() {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => current,
    );
}

// lang: 'en', 'ar', or 'original' (what the driver actually said or typed)
function pick(note, lang) {
    if (lang === 'ar') return note.arabic || note.original;
    if (lang === 'original') return note.original;
    return note.english || note.original;
}

const notesOf = (s, kind) => (s.notes || []).filter((n) => n.kind === kind);

export function stageLabel(stage, lang) {
    return lang === 'ar' ? STAGE_AR[stage] || stage : stage;
}

// One line per damage report, e.g. "On arrival: 5 bottles broke"
export function damageLines(s, lang) {
    const notes = notesOf(s, 'damage');
    if (notes.length === 0) return s.damage_note ? s.damage_note.split('; ') : [];
    return notes.map((n) => `${stageLabel(n.stage, lang)}: ${pick(n, lang)}`);
}

export function failureText(s, lang) {
    const notes = notesOf(s, 'failure');
    return notes.length > 0 ? pick(notes[notes.length - 1], lang) : s.failure_reason;
}

// Notes not written in the language being shown, so readers can check what the driver actually said
export function originalsOf(s, kinds, lang) {
    const shown = lang === 'ar' ? 'arabic' : 'english';
    return (s.notes || []).filter((n) => kinds.includes(n.kind) && n.language && n.language.toLowerCase() !== shown);
}

export function hasDriverNotes(shipments) {
    return shipments.some((s) => s.damage_note || s.failure_reason);
}
