
import { Message, Attachment, GradeLevel, Exercise, QuestionType, Lesson, AnswerEvaluation, UploadAnalysis, Subject } from '../types';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';

const HAIKU = 'claude-haiku-4-5-20251001';

// In dev, Vite's proxy forwards /api → localhost:3001 (leave VITE_API_URL unset).
// In a Capacitor/production build, set VITE_API_URL to your hosted backend URL.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface TutorResponse {
    text: string;
    attachments: Attachment[];
}

const LANG_MAP: Record<string, string> = { 'en': 'English', 'ru': 'Russian', 'he': 'Hebrew', 'ar': 'Arabic' };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function imgBlock(att: Attachment) {
    return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: att.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: att.data }
    };
}

async function callClaude(body: {
    messages: object[];
    system?: string;
    max_tokens?: number;
    model?: string;
}): Promise<string> {
    const res = await fetch(`${API_BASE}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    const block = (data.content ?? []).find((b: any) => b.type === 'text');
    return block?.text ?? '';
}

// Valid characters after a JSON backslash escape
const JSON_ESCAPE_CHARS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

// Pass 1 — fix invalid escape sequences (e.g. LaTeX \frac → \\frac)
// and unescaped control characters inside strings.
function repairEscapes(text: string): string {
    let out = '';
    let inString = false;
    let pendingSlash = false;
    const chars = [...text]; // iterate codepoints so surrogate pairs stay intact
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (pendingSlash) {
            pendingSlash = false;
            if (!inString || JSON_ESCAPE_CHARS.has(ch)) {
                out += '\\' + ch;
            } else {
                // Invalid escape (e.g. \s, \p, \f used as LaTeX) — double the backslash
                out += '\\\\' + ch;
            }
            continue;
        }
        if (ch === '\\') { pendingSlash = true; continue; }
        if (ch === '"') {
            if (!inString) {
                inString = true;
                out += ch;
            } else {
                // Decide: closing quote, or an unescaped inner quote?
                // Peek ahead past whitespace to find the next meaningful char.
                let j = i + 1;
                while (j < chars.length && (chars[j] === ' ' || chars[j] === '\t')) j++;
                const next = chars[j];
                const isStructural = next === undefined || next === ',' || next === '}' ||
                                     next === ']' || next === ':' || next === '\n' || next === '\r';
                if (isStructural) {
                    inString = false;
                    out += ch;
                } else {
                    // Looks like an unescaped inner quote — escape it
                    out += '\\"';
                }
            }
            continue;
        }
        if (inString && ch === '\n') { out += '\\n'; continue; }
        if (inString && ch === '\r') { out += '\\r'; continue; }
        if (inString && ch === '\t') { out += '\\t'; continue; }
        out += ch;
    }
    if (pendingSlash) out += '\\\\';
    return out;
}

// Pass 2 — close any structures left open by truncated LLM output.
function closeIncomplete(text: string): string {
    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (const ch of text) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (!inStr) {
            if (ch === '{' || ch === '[') stack.push(ch);
            else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
        }
    }
    let result = text;
    if (inStr) result += '"'; // close an open string
    for (let i = stack.length - 1; i >= 0; i--)
        result += stack[i] === '{' ? '}' : ']';
    return result;
}

// Parse JSON from LLM output with multi-pass repair.
function parseJson(text: string): any {
    const stripped = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Fast path — valid JSON
    try { return JSON.parse(stripped); } catch { /* fall through */ }

    // Pass 1: fix escapes + unescaped inner quotes + control chars
    const pass1 = repairEscapes(stripped)
        .replace(/,(\s*[}\]])/g, '$1'); // strip trailing commas
    try { return JSON.parse(pass1); } catch { /* fall through */ }

    // Pass 2: also close any truncated structures
    const pass2 = closeIncomplete(pass1);
    return JSON.parse(pass2);
}

// ─── TUTOR CHAT ───────────────────────────────────────────────────────────────

export const generateTutorResponse = async (
    history: Message[],
    currentInput: string,
    attachments: Attachment[] = [],
    userContext: { contextStr: string; grade: GradeLevel; language: string }
): Promise<TutorResponse> => {
    const targetLang = LANG_MAP[userContext.language] || userContext.language;

    const system = `${INITIAL_SYSTEM_INSTRUCTION}
CURRENT APP CONTEXT: """ ${userContext.contextStr} """
STUDENT PROFILE: Grade: ${userContext.grade} | Language: ${targetLang}
INSTRUCTIONS:
1. CRITICAL — You MUST respond ONLY in ${targetLang}. This overrides all previous messages in the conversation history. Even if earlier messages were in a different language, your response must be in ${targetLang}.
2. Use the context to help the student with whatever they are currently studying.
3. For mathematical expressions use LaTeX notation: inline $...$ or display $$...$$.`;

    try {
        // Build history messages (map legacy 'model' role → 'assistant')
        const historyMessages = history.slice(-14).map(msg => ({
            role: (msg.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: msg.attachments && msg.attachments.length > 0
                ? [...msg.attachments.map(imgBlock), { type: 'text' as const, text: msg.text || '.' }]
                : msg.text || '.',
        }));

        // Build current user message
        const currentContent: object[] = [];
        attachments.forEach(att => currentContent.push(imgBlock(att)));
        if (currentInput?.trim()) currentContent.push({ type: 'text', text: currentInput });
        else if (currentContent.length === 0) currentContent.push({ type: 'text', text: '.' });

        const text = await callClaude({
            model: HAIKU,
            max_tokens: 2048,
            system,
            messages: [...historyMessages, { role: 'user', content: currentContent }],
        });

        return { text: text || "I'm having trouble responding. Try again.", attachments: [] };
    } catch (error) {
        console.error("Tutor response error:", error);
        return { text: "Connection error. Please try again.", attachments: [] };
    }
};

// ─── LESSON GENERATION ────────────────────────────────────────────────────────

export const generateLesson = async (
    subject: string,
    grade: GradeLevel,
    topicTitle: string,
    topicDescription: string,
    language: string,
    attachments?: Attachment[]
): Promise<Lesson | null> => {
    const targetLang = LANG_MAP[language] || language;

    const prompt = `You are an expert educator. Generate a comprehensive lesson in valid JSON format.

Subject: ${subject}
Grade Level: ${grade}
Topic: ${topicTitle}
Description: ${topicDescription}
Language: ${targetLang} — ALL text values in the JSON must be written in ${targetLang}.

Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "topicTitle": "string",
  "sections": [
    { "type": "intro", "heading": "string", "body": "string" },
    { "type": "concept", "heading": "string", "body": "string" },
    { "type": "example", "heading": "string", "body": "string" },
    { "type": "summary", "heading": "string", "body": "string" }
  ],
  "keyPoints": ["string", "string", "string", "string"],
  "diagramPrompt": "optional short English description for a diagram, or empty string"
}

Make the lesson age-appropriate, clear, and pedagogically sound. Use numbered steps or bullet points within body text where helpful.
For ALL mathematical expressions use LaTeX: inline $...$ or display $$...$$.
CRITICAL — this output is JSON, so every LaTeX backslash must be doubled: write \\\\frac not \\frac, \\\\sqrt not \\sqrt, \\\\alpha not \\alpha, etc.
Example of correct display math in a JSON string: "$$\\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}$$"
Example of correct inline math in a JSON string: "the slope is $m = \\\\frac{\\\\Delta y}{\\\\Delta x}$"`;

    const content: object[] = [];
    if (attachments?.length) attachments.forEach(att => content.push(imgBlock(att)));
    content.push({ type: 'text', text: prompt });

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
    });

    if (!text) throw new Error("generateLesson: empty response from model");
    return parseJson(text) as Lesson;
};

// ─── ANSWER EVALUATION ────────────────────────────────────────────────────────

export const evaluateAnswer = async (
    question: string,
    studentAnswer: string,
    sampleAnswer: string,
    grade: GradeLevel,
    language: string,
    attemptNumber: number
): Promise<AnswerEvaluation> => {
    const targetLang = LANG_MAP[language] || language;

    const prompt = `You are an expert teacher evaluating a student's answer. Respond in ${targetLang}.

Question: "${question}"
Expected Answer / Key Points: "${sampleAnswer}"
Student's Answer: "${studentAnswer}"
Student's Grade Level: ${grade}
Attempt Number: ${attemptNumber} (max 3 attempts before full solution revealed)

Return ONLY a JSON object (no markdown, no code blocks):
{
  "isCorrect": boolean,
  "score": number (0-100),
  "feedback": "encouraging explanation of what was right/wrong in ${targetLang}",
  "followUp": "Socratic follow-up question to guide further (empty string if score >= 80)",
  "hint": "helpful hint if score < 50 and attempt < 3 (empty string otherwise)",
  "fullSolution": "full worked solution if attempt >= 3 (empty string otherwise)"
}`;

    try {
        const text = await callClaude({
            model: HAIKU,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });
        if (!text) return { isCorrect: false, score: 0, feedback: "Could not evaluate. Please try again." };
        return parseJson(text) as AnswerEvaluation;
    } catch (error: any) {
        console.error("Answer evaluation error:", error);
        return { isCorrect: false, score: 0, feedback: `Evaluation error: ${error?.message || error}` };
    }
};

// ─── UPLOAD ANALYSIS ─────────────────────────────────────────────────────────

export const analyzeUpload = async (
    attachments: Attachment[],
    grade: GradeLevel,
    language: string
): Promise<UploadAnalysis | null> => {
    if (!attachments || attachments.length === 0) return null;
    const targetLang = LANG_MAP[language] || language;

    const prompt = `Analyze the uploaded educational materials. Respond in ${targetLang}.
Student's grade level: ${grade}

Return ONLY a JSON object (no markdown, no code blocks):
{
  "summary": "2-3 sentence summary in ${targetLang}",
  "topics": ["topic1", "topic2", "topic3"],
  "suggestedExercises": ["exercise1", "exercise2", "exercise3"],
  "detectedSubject": "one of: MATH, SCIENCE, LANGUAGE, HISTORY, CODING, ECONOMICS — or empty string if unclear",
  "detectedGrade": "one of: KINDER, ELEMENTARY_1_3, ELEMENTARY_4_6, MIDDLE_7_8, HIGH_9_10, HIGH_11_12, COLLEGE_FRESHMAN, COLLEGE_ADVANCED — or empty string if unclear"
}`;

    const content: object[] = [];
    attachments.forEach(att => content.push(imgBlock(att)));
    content.push({ type: 'text', text: prompt });

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 1024,
        messages: [{ role: 'user', content }],
    });

    if (!text) throw new Error("analyzeUpload: empty response from model");
    const raw = parseJson(text);

    const validSubjects = Object.values(Subject) as string[];
    const validGrades = Object.values(GradeLevel) as string[];
    return {
        summary: raw.summary || '',
        topics: raw.topics || [],
        suggestedExercises: raw.suggestedExercises || [],
        detectedSubject: validSubjects.includes(raw.detectedSubject) ? raw.detectedSubject as Subject : null,
        detectedGrade: validGrades.includes(raw.detectedGrade) ? raw.detectedGrade as GradeLevel : null
    };
};

// ─── QUIZ GENERATION ──────────────────────────────────────────────────────────

export const generateQuiz = async (
    subject: string,
    grade: GradeLevel,
    topic: string,
    language: string,
    context?: string,
    attachments?: Attachment[],
    questionTypes?: QuestionType[],
    count: number = 10
): Promise<Exercise[]> => {
    const targetLang = LANG_MAP[language] || language;
    const types = questionTypes || [QuestionType.MULTIPLE_CHOICE];
    const typeList = types.join(', ');

    let prompt = `Generate ${count} diverse exercises as a JSON array. Language: ${targetLang} — ALL text must be in ${targetLang}.

Subject: ${subject}, Grade: ${grade}, Topic: "${topic}"
Question types to use: ${typeList}

Return ONLY a JSON array (no markdown, no code blocks):
[
  {
    "id": "q1",
    "questionType": "MULTIPLE_CHOICE",
    "difficulty": 2,
    "question": "question text",
    "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
    "correctOptionId": "a",
    "sampleAnswer": "",
    "steps": [],
    "skillTag": "skill name",
    "xpValue": 20,
    "explanation": "why the answer is correct",
    "hint": "helpful hint"
  }
]

Rules:
- For MULTIPLE_CHOICE: fill options and correctOptionId; leave sampleAnswer and steps empty
- For SHORT_ANSWER: fill sampleAnswer; leave options and correctOptionId empty
- For FILL_IN_BLANK: use ___ in the question for the blank; fill sampleAnswer
- For MULTI_STEP: fill steps array with expected steps; fill sampleAnswer with final answer
- Vary difficulty 1-5 across questions
- xpValue = difficulty * 10
- For math use LaTeX: inline $...$ or display $$...$$. CRITICAL: this is JSON — double every backslash. Write \\\\frac, \\\\sqrt, \\\\alpha, etc. Example: "Solve $$\\\\frac{x}{2} = 5$$"`;

    if (context) prompt += `\nAdditional Context: ${context}`;

    try {
        const content: object[] = [];
        if (attachments?.length) attachments.forEach(att => content.push(imgBlock(att)));
        content.push({ type: 'text', text: prompt });

        const text = await callClaude({
            model: HAIKU,
            max_tokens: 8192,
            messages: [{ role: 'user', content }],
        });

        if (!text) return [];
        const raw = parseJson(text) as any[];
        return raw
            .filter((q: any) => typeof q?.question === 'string' && q.question.trim()) // drop truncated/empty entries
            .map((q: any, i: number) => ({
                ...q,
                id: q.id || `q-${i}`,
                options: q.options || [],
                questionType: q.questionType || QuestionType.MULTIPLE_CHOICE,
                xpValue: q.xpValue || (q.difficulty || 1) * 10
            })) as Exercise[];
    } catch (error: any) {
        console.error("Quiz Generation Error:", error);
        return [];
    }
};
