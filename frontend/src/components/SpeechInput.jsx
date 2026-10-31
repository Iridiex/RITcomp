import { useEffect, useRef, useState } from 'react';
import { Mic, Square, LoaderCircle } from 'lucide-react';
import { API } from '../session';
import { useAiEnabled } from '../aiStatus';
import { canRecord, toWav } from '../audio';

const MAX_SECONDS = 60;

// A text box with a mic: speak in any language and the box fills with what was said
function SpeechInput({ value, onChange, placeholder }) {
    const enabled = useAiEnabled() && canRecord();
    const [phase, setPhase] = useState('idle');
    const [seconds, setSeconds] = useState(0);
    const [heard, setHeard] = useState('');
    const [error, setError] = useState('');
    const recorder = useRef(null);
    const startedAt = useRef(0);

    useEffect(() => () => {
        const rec = recorder.current;
        if (rec && rec.state !== 'inactive') {
            rec.onstop = null;
            rec.stop();
            rec.stream.getTracks().forEach((t) => t.stop());
        }
    }, []);

    useEffect(() => {
        if (phase !== 'recording') return undefined;
        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
            setSeconds(elapsed);
            if (elapsed >= MAX_SECONDS && recorder.current?.state === 'recording') recorder.current.stop();
        }, 250);
        return () => clearInterval(timer);
    }, [phase]);

    async function send(recording) {
        setPhase('working');
        try {
            const wav = await toWav(recording);
            const res = await fetch(`${API}/speech`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors || [data.error]).join(', '));
            } else {
                onChange(data.text);
                setHeard(data.language || '');
            }
        } catch {
            setError('Could not send the recording. Try again or type it');
        }
        setPhase('idle');
    }

    async function start() {
        setError('');
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError('Allow microphone access to speak your note');
            return;
        }
        const chunks = [];
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        rec.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            recorder.current = null;
            send(new Blob(chunks, { type: rec.mimeType }));
        };
        recorder.current = rec;
        rec.start();
        startedAt.current = Date.now();
        setSeconds(0);
        setHeard('');
        setPhase('recording');
    }

    function stop() {
        if (recorder.current?.state === 'recording') recorder.current.stop();
    }

    const time = `0:${String(seconds).padStart(2, '0')}`;

    return (
        <div className="speech-input">
            <div className="speech-row">
                <textarea
                    dir="auto"
                    rows={2}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={phase !== 'idle'}
                />
                {enabled && (
                    phase === 'recording' ? (
                        <button type="button" className="mic-button recording" onClick={stop} aria-label="Stop recording">
                            <Square size={16} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="mic-button"
                            onClick={start}
                            disabled={phase === 'working'}
                            aria-label="Speak instead of typing"
                            title="Speak in any language"
                        >
                            {phase === 'working' ? <LoaderCircle size={18} className="spin" /> : <Mic size={18} />}
                        </button>
                    )
                )}
            </div>
            {phase === 'recording' && <span className="speech-status live">Listening {time} · tap ■ when done</span>}
            {phase === 'working' && <span className="speech-status">Writing down what you said…</span>}
            {phase === 'idle' && heard && <span className="speech-status">Heard: {heard}. Check it, then confirm</span>}
            {error && <span className="speech-status error">{error}</span>}
        </div>
    );
}

export default SpeechInput;
