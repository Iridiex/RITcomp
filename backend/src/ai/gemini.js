const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const SPEECH_MODEL = process.env.GEMINI_SPEECH_MODEL || 'gemini-3.5-flash';
const ASSISTANT_MODEL = process.env.GEMINI_ASSISTANT_MODEL || 'gemini-3.5-flash';

function aiEnabled() {
    return Boolean(process.env.GEMINI_API_KEY);
}

// Sends one prompt (text, `parts` such as audio, or a whole conversation as `contents`) and returns the parsed JSON reply; throws on any failure
async function askGemini({ instructions, prompt, parts, contents, schema, model = MODEL, timeoutMs = 8000 }) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: instructions }] },
            contents: contents || [{ role: 'user', parts: parts || [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
        }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts || [];
    return JSON.parse(reply.filter((p) => !p.thought).map((p) => p.text || '').join(''));
}

module.exports = { askGemini, aiEnabled, SPEECH_MODEL, ASSISTANT_MODEL };
