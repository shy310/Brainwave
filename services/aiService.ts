
import { Message, Attachment, GradeLevel, Exercise, QuestionType, Lesson, AnswerEvaluation, UploadAnalysis, Subject, CodeLanguage, GameType, Presentation, PresentationSlide, CodingChallenge, GameQuestion, BuggyCode, DebateTurn, StoryChapter, StoryEvaluation, MysteryCase, ChallengeTestResult, CodeReview, ArgumentScore, BranchChoice, InlineSuggestion, CaseTheme, CaseDifficulty, PresentationAudience, PresStructure, ConceptNode, ConceptEdge, FlashCard, TrueFalseItem } from '../types';
import { INITIAL_SYSTEM_INSTRUCTION } from '../constants';
import { sanitizeQuiz } from './questionValidator';

const HAIKU = 'claude-haiku-4-5-20251001';

// Learner performance snapshot used to adapt question difficulty.
export interface QuizPerformance {
    mastery?: number;        // 0–100 topic mastery (EMA)
    recentCorrect?: number;  // correct answers in the last session on this topic
    recentTotal?: number;    // attempts in the last session on this topic
}

// In dev, Vite's proxy forwards /api → localhost:3001 (leave VITE_API_URL unset).
// In a Capacitor/production build, set VITE_API_URL to your hosted backend URL.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface TutorResponse {
    text: string;
    attachments: Attachment[];
}

const LANG_MAP: Record<string, string> = { 'en': 'English', 'ru': 'Russian', 'he': 'Hebrew', 'ar': 'Arabic' };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function contentBlock(att: Attachment) {
    if (att.mimeType === 'application/pdf') {
        return {
            type: 'document' as const,
            source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: att.data }
        };
    }
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
    // Track last "safe" position (just after a complete value was closed)
    let lastSafe = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') {
            inStr = !inStr;
            if (!inStr) lastSafe = i + 1; // just closed a string
            continue;
        }
        if (!inStr) {
            if (ch === '{' || ch === '[') stack.push(ch);
            else if (ch === '}' || ch === ']') {
                if (stack.length) stack.pop();
                if (stack.length === 0) lastSafe = i + 1;
            } else if ((ch === ',' || ch === ':') && stack.length <= 1) {
                lastSafe = i + 1;
            }
        }
    }

    // If we're mid-string (truncated inside a value), backtrack to lastSafe
    // and close cleanly from there — avoids partial string becoming a corrupt element
    let result = inStr ? text.slice(0, lastSafe) : text;

    // Re-compute open stack on the trimmed result
    const stack2: string[] = [];
    let inStr2 = false;
    let esc2 = false;
    for (const ch of result) {
        if (esc2) { esc2 = false; continue; }
        if (ch === '\\') { esc2 = true; continue; }
        if (ch === '"') { inStr2 = !inStr2; continue; }
        if (!inStr2) {
            if (ch === '{' || ch === '[') stack2.push(ch);
            else if ((ch === '}' || ch === ']') && stack2.length) stack2.pop();
        }
    }

    // Strip any dangling comma before we close
    result = result.replace(/,(\s*)$/, '$1');
    for (let i = stack2.length - 1; i >= 0; i--)
        result += stack2[i] === '{' ? '}' : ']';
    return result;
}

// Extract the outermost JSON object or array from text that may have preamble.
function extractJson(text: string): string {
    // Find first { or [
    const start = Math.min(
        text.indexOf('{') === -1 ? Infinity : text.indexOf('{'),
        text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
    );
    if (start === Infinity) return text;
    const opener = text[start];
    const closer = opener === '{' ? '}' : ']';
    // Walk forward to find the matching closer
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === opener) depth++;
        else if (ch === closer) { depth--; if (depth === 0) { end = i; break; } }
    }
    return end !== -1 ? text.slice(start, end + 1) : text.slice(start);
}

// Pre-clean the AI output: strip BOM, RTL markers, replace smart quotes outside strings,
// fix common Unicode-related JSON breakers from non-English models.
function preCleanJson(text: string): string {
    return text
        // Strip UTF-8 BOM if present
        .replace(/^﻿/, '')
        // Strip RTL/LTR markers and other invisible control chars that break parsers
        .replace(/[​-‏‪-‮⁠⁦-⁩﻿]/g, '')
        // Replace smart double quotes with regular ones (the AI sometimes uses these
        // as JSON delimiters in non-English output, breaking parsing entirely)
        .replace(/[“”„‟″]/g, '"')
        // Replace smart single quotes — only safe replacement is to leave them in
        // string content; we'll only strip if they appear as JSON syntax (rare)
        .replace(/[‘’‚‛]/g, "'")
        // Replace various dashes the model might insert as JSON syntax
        .replace(/[–—―]/g, '-')
        // Strip language markers some models add ("```json" with extra prose)
        .replace(/^[^[{]*?(?=[\[{])/s, '');
}

// Parse JSON from LLM output with multi-pass repair.
function parseJson(text: string): any {
    // Pre-clean for non-English / Unicode quirks
    const cleaned = preCleanJson(text);

    // Strip markdown code fences, then extract the outermost JSON block
    const stripped = extractJson(
        cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    );

    // Fast path — valid JSON
    try { return JSON.parse(stripped); } catch { /* fall through */ }

    // Pass 1: fix escapes + unescaped inner quotes + control chars
    const pass1 = repairEscapes(stripped)
        .replace(/,(\s*[}\]])/g, '$1'); // strip trailing commas
    try { return JSON.parse(pass1); } catch { /* fall through */ }

    // Pass 2: also close any truncated structures
    const pass2 = closeIncomplete(pass1);
    try { return JSON.parse(pass2); } catch { /* fall through */ }

    // Pass 3 (last resort): try to find JUST the array/object portion and parse
    const arrayMatch = stripped.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        try { return JSON.parse(arrayMatch[0]); } catch { /* fall through */ }
        try { return JSON.parse(closeIncomplete(repairEscapes(arrayMatch[0]))); } catch { /* fall through */ }
    }

    throw new Error(`Could not parse JSON from response (${text.length} chars)`);
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
                ? [...msg.attachments.map(contentBlock), { type: 'text' as const, text: msg.text || '.' }]
                : msg.text || '.',
        }));

        // Build current user message
        const currentContent: object[] = [];
        attachments.forEach(att => currentContent.push(contentBlock(att)));
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

    const prompt = `You are a world-class educator who designs addictive, bite-size interactive lessons (think Duolingo, not a textbook). Generate an accurate micro-lesson as a paced sequence of short cards.

Subject: ${subject}
Grade Level: ${grade}
Topic: ${topicTitle}
Description: ${topicDescription}
Language: ${targetLang} — text content must be in ${targetLang}.

CRITICAL OUTPUT FORMAT:
- Respond with ONLY a valid JSON object. No prose, no markdown fences, no explanations outside the JSON.
- The JSON STRUCTURE (braces, brackets, commas, field names like "topicTitle", "sections", "type") is ALWAYS in English ASCII.
- Only the VALUES of text content fields (topicTitle, heading, body, bullets[], question, options[], explanation, keyPoints[]) are in ${targetLang}.
- The "type" field values stay in English: "intro", "concept", "example", "scenario", "check", "challenge", "summary".
- Use ONLY standard ASCII double quotes (") for JSON strings. NEVER use smart/curly quotes (" " „).
- For Hebrew/Arabic content: write text inside string normally; do NOT add RTL/LTR markers or BOM characters.

CRITICAL ACCURACY RULES:
- Every fact, definition, formula, and date MUST be 100% correct. Do not guess or fabricate.
- Verify all arithmetic in examples and check questions before including it.
- The correctIndex MUST point at the genuinely correct option.

LESSON DESIGN RULES (the whole point — keep it snappy):
- 9 to 11 sections total, each ONE small idea.
- "body" is SHORT: 2-4 sentences, maximum ~55 words. NEVER write paragraphs of filler.
- Prefer "bullets" (3-5 items, each under 12 words) over prose whenever listing steps, properties, or comparisons.
- NO repetition between sections. Never restate what a previous card already said.
- Variety: never place two sections of the same type next to each other (checks may follow anything).
- Include EXACTLY 3 "check" sections spread through the lesson (never first, never last). Each has: "question" (one sentence), "options" (exactly 3, plausible, one correct), "correctIndex" (0-2), "explanation" (one sentence why).
- Include EXACTLY 1 "scenario": a tiny concrete real-world story (2-3 sentences) showing the concept in action.
- Include EXACTLY 1 "challenge" near the end: a think-first question in "body"; put the worked answer in "explanation" (2-3 sentences).
- "intro" is a hook: open with a surprising fact or question that makes the student curious (2-3 sentences).
- "summary" is last: 1-2 sentences + 3-4 "bullets" of the key takeaways.
- Headings are punchy: 2-5 words.
- Where natural, start "heading" with one relevant emoji (e.g. "🌋 Why plates move"). At most half the headings.

Return ONLY a JSON object (no markdown, no code blocks):
{
  "topicTitle": "string",
  "sections": [
    { "type": "intro", "heading": "string", "body": "string" },
    { "type": "concept", "heading": "string", "body": "string", "bullets": ["optional", "short", "items"] },
    { "type": "check", "heading": "string", "body": "", "question": "string", "options": ["a","b","c"], "correctIndex": 0, "explanation": "string" },
    { "type": "example", "heading": "string", "body": "string", "bullets": ["step 1", "step 2"] },
    { "type": "scenario", "heading": "string", "body": "string" },
    { "type": "challenge", "heading": "string", "body": "string", "explanation": "string" },
    { "type": "summary", "heading": "string", "body": "string", "bullets": ["takeaway 1", "takeaway 2", "takeaway 3"] }
  ],
  "keyPoints": ["point1", "point2", "point3", "point4"],
  "diagramPrompt": "optional short English description for a diagram"
}

QUALITY REQUIREMENTS:
- Specific facts, numbers, and formulas — never vague generalizations.
- Pitch difficulty and vocabulary exactly at grade ${grade}.
- Address one common misconception somewhere (a check option or the challenge is a great place).
- keyPoints: exactly 4, each under 12 words.

For ALL mathematical expressions use LaTeX: inline $...$ or display $$...$$.
CRITICAL — this is JSON, so double every backslash: \\\\frac not \\frac, \\\\sqrt not \\sqrt.
Example: "$$\\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}$$"`;

    const content: object[] = [];
    if (attachments?.length) attachments.forEach(att => content.push(contentBlock(att)));
    content.push({ type: 'text', text: prompt });

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 8192,
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
    attemptNumber: number,
    options?: {
        /** Deterministic verdict from the math engine — the AI must not contradict it */
        verifiedCorrect?: boolean;
        /** Topic for context so feedback stays relevant */
        topic?: string;
        /** Hints already shown, so the next one is different and more specific */
        previousHints?: string[];
    }
): Promise<AnswerEvaluation> => {
    const targetLang = LANG_MAP[language] || language;
    const verdictBlock = options?.verifiedCorrect !== undefined
        ? `\nVERIFIED VERDICT (from a deterministic math engine — this is FINAL, do not re-judge):
The student's answer is ${options.verifiedCorrect ? 'CORRECT' : 'INCORRECT'}.
Your job is ONLY to write feedback that matches this verdict. Set isCorrect=${options.verifiedCorrect}.`
        : '';
    const prevHints = options?.previousHints?.length
        ? `\nHints already shown (do NOT repeat these; be more specific this time):\n${options.previousHints.map(h => `- ${h}`).join('\n')}`
        : '';

    const prompt = `You are a warm, sharp tutor giving feedback on one answer. Respond in ${targetLang}.

Question: "${question}"
${options?.topic ? `Topic: "${options.topic}"` : ''}
Expected Answer / Key Points: "${sampleAnswer}"
Student's Answer: "${studentAnswer}"
Student's Grade Level: ${grade}
Attempt Number: ${attemptNumber} (max 3 attempts before full solution revealed)
${verdictBlock}${prevHints}

FEEDBACK RULES:
- Talk about the student's ACTUAL answer — quote or reference what they wrote. Never give generic feedback.
- If CORRECT: 1 short sentence of specific praise + at most 1 sentence of insight. No over-explaining.
- If INCORRECT: name the specific mistake in their answer (sign error? wrong step? confused concepts?) in 1-2 sentences.
  Then give a hint that guides toward the method — NEVER reveal the final answer before attempt 3.
- Hint ladder: attempt 1 → nudge at the concept; attempt 2 → point at the exact step to fix; attempt 3 → fullSolution.
- Do not invent facts, formulas or rules. If the expected answer covers it, use it; otherwise stay general.
- Grade level ${grade}: match vocabulary and depth to it.

Return ONLY a JSON object (no markdown, no code blocks):
{
  "isCorrect": boolean,
  "score": number (0-100),
  "feedback": "specific feedback about THIS answer in ${targetLang} (1-2 sentences)",
  "followUp": "Socratic follow-up question to guide further (empty string if score >= 80)",
  "hint": "next-step hint if incorrect and attempt < 3 (empty string otherwise)",
  "fullSolution": "full worked solution if attempt >= 3 (empty string otherwise)"
}`;

    try {
        const text = await callClaude({
            model: HAIKU,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });
        if (!text) return { isCorrect: false, score: 0, feedback: "Could not evaluate. Please try again." };
        const evalResult = parseJson(text) as AnswerEvaluation;
        // The engine's verdict is final — the AI writes feedback, it does not judge.
        if (options?.verifiedCorrect !== undefined) {
            evalResult.isCorrect = options.verifiedCorrect;
            evalResult.score = options.verifiedCorrect
                ? Math.max(evalResult.score ?? 0, 90)
                : Math.min(evalResult.score ?? 0, 50);
        }
        return evalResult;
    } catch (error: any) {
        console.error("Answer evaluation error:", error);
        // Even if the AI is unreachable, a verified verdict still stands.
        if (options?.verifiedCorrect !== undefined) {
            return {
                isCorrect: options.verifiedCorrect,
                score: options.verifiedCorrect ? 100 : 0,
                feedback: '',
            };
        }
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
    attachments.forEach(att => content.push(contentBlock(att)));
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

// ─── QUIZ GENERATION (rebuilt from scratch — multi-stage, validated, retried) ──

// Per-subject coaching: tells the AI what GOOD questions look like for each subject.
const SUBJECT_GUIDANCE: Record<string, string> = {
    MATH: `
- Math questions must have numerical or symbolic answers that you can verify by computation.
- For each multiple-choice math question, internally compute the answer step-by-step BEFORE writing options.
- Distractors should reflect common student errors (off-by-one, sign errors, missed step, wrong order of operations).
- Mix problem types: direct calculation, word problems, identifying patterns, applying formulas to real scenarios.
- Avoid trick questions or ambiguous notation. If the question requires a specific notation, define it.`,
    SCIENCE: `
- Science questions must be factually accurate and use precise terminology.
- Mix conceptual (what causes X?), procedural (which step comes first?), and applied (what would happen if?).
- Avoid outdated science (e.g., do not call Pluto a planet, do not say tongue has flavor zones).
- For biology/chemistry/physics: use correct units, real chemical formulas, real physical constants.
- Distractors should be common misconceptions students actually have.`,
    GEOGRAPHY: `
- Geography questions must use accurate, current data: real country names, real capitals, real landforms.
- Verify every fact: Is that really the longest river? Does that country really border that one?
- Mix physical geography (climate, landforms, biomes), human geography (population, culture, economy),
  and map skills (directions, latitude, scale).
- Distractors should be plausible neighboring countries or similar landforms — not obviously wrong.
- For maps/coordinates: only use questions that work without an actual image (describe the position in words).`,
    HISTORY: `
- Every date, name, and event must be historically accurate. Verify before writing.
- Mix question types: cause-and-effect, chronological order, identifying figures, primary source analysis.
- Avoid Eurocentric bias — include world history, not just Western history.
- Distractors should be plausible (same era, same region) but clearly the wrong answer.
- Do NOT ask questions that depend on perspective or interpretation as if they have one true answer.`,
    CODING: `
- Code snippets must be syntactically valid in the language they show.
- For "what does this code output?" questions: trace the code yourself line-by-line BEFORE writing options.
- Mix conceptual (what is a variable?), debugging (what's wrong with this code?), and predicting output.
- Use real, modern syntax. No deprecated patterns.
- Distractors should reflect real bugs students introduce (wrong loop bound, off-by-one, type error).`,
    ECONOMICS: `
- Use correct economic definitions (supply, demand, elasticity, opportunity cost).
- Mix theoretical (what does X mean?), applied (what would happen if?), and real-world examples.
- For numerical questions, verify your math.
- Distractors should be common confusions (microeconomics vs macroeconomics, real vs nominal).
- Avoid politically charged questions presented as having one correct answer.`,
};

// Question-type schema templates with EXACT examples.
const TYPE_EXAMPLES = `
EXAMPLE — MULTIPLE_CHOICE:
{
  "id": "q1",
  "questionType": "MULTIPLE_CHOICE",
  "difficulty": 3,
  "question": "If $f(x) = 2x + 5$, what is $f(3)$?",
  "options": [
    {"id": "a", "text": "8"},
    {"id": "b", "text": "11"},
    {"id": "c", "text": "13"},
    {"id": "d", "text": "16"}
  ],
  "correctOptionId": "b",
  "sampleAnswer": "",
  "steps": [],
  "skillTag": "function evaluation",
  "xpValue": 30,
  "explanation": "Substitute x = 3: f(3) = 2(3) + 5 = 6 + 5 = 11.",
  "hint": "Replace x with 3 in the formula and compute step by step."
}

EXAMPLE — SHORT_ANSWER:
{
  "id": "q2",
  "questionType": "SHORT_ANSWER",
  "difficulty": 4,
  "question": "Explain why the sky appears blue during the day.",
  "options": [],
  "correctOptionId": "",
  "sampleAnswer": "Sunlight contains all colors. As it enters the atmosphere, shorter wavelengths (blue and violet) scatter more than longer wavelengths because of Rayleigh scattering. We perceive the sky as blue because our eyes are more sensitive to blue than violet.",
  "steps": [],
  "skillTag": "Rayleigh scattering",
  "xpValue": 40,
  "explanation": "Rayleigh scattering: shorter wavelengths scatter more strongly when light hits small particles.",
  "hint": "Think about what happens to different colors of light as they travel through the atmosphere."
}

EXAMPLE — FILL_IN_BLANK:
{
  "id": "q3",
  "questionType": "FILL_IN_BLANK",
  "difficulty": 2,
  "question": "The largest ocean on Earth is the ___ Ocean.",
  "options": [],
  "correctOptionId": "",
  "sampleAnswer": "Pacific",
  "steps": [],
  "skillTag": "world oceans",
  "xpValue": 20,
  "explanation": "The Pacific Ocean covers more than 30% of Earth's surface — larger than all land combined.",
  "hint": "It borders the west coast of the Americas and the east coast of Asia."
}

EXAMPLE — NUMERIC (any question whose answer is a number, measurement, fraction or percentage):
{
  "id": "q4",
  "questionType": "NUMERIC",
  "difficulty": 3,
  "question": "A shirt costs $40 and is discounted by 25%. What is the sale price in dollars?",
  "options": [],
  "correctOptionId": "",
  "sampleAnswer": "30",
  "answerExpression": "40 - 40*0.25",
  "acceptableAnswers": ["$30", "30 dollars"],
  "steps": [],
  "skillTag": "percentage discount",
  "xpValue": 30,
  "explanation": "25% of 40 is 10, so the sale price is 40 - 10 = 30 dollars.",
  "hint": "First find 25% of 40, then subtract it from the original price."
}

EXAMPLE — TRUE_FALSE:
{
  "id": "q5",
  "questionType": "TRUE_FALSE",
  "difficulty": 2,
  "question": "The sum of the interior angles of any triangle is 180 degrees.",
  "options": [{"id": "t", "text": "True"}, {"id": "f", "text": "False"}],
  "correctOptionId": "t",
  "sampleAnswer": "",
  "steps": [],
  "skillTag": "triangle angle sum",
  "xpValue": 20,
  "explanation": "In Euclidean geometry the interior angles of every triangle always add to exactly 180°.",
  "hint": "Think about tearing the three corners off a paper triangle and lining them up."
}

EXAMPLE — MULTI_SELECT (more than one valid answer; say "Select all that apply" in the question):
{
  "id": "q6",
  "questionType": "MULTI_SELECT",
  "difficulty": 3,
  "question": "Select all of the following that are prime numbers.",
  "options": [
    {"id": "a", "text": "2"},
    {"id": "b", "text": "9"},
    {"id": "c", "text": "11"},
    {"id": "d", "text": "15"}
  ],
  "correctOptionIds": ["a", "c"],
  "correctOptionId": "",
  "sampleAnswer": "",
  "steps": [],
  "skillTag": "prime numbers",
  "xpValue": 30,
  "explanation": "2 and 11 have no divisors besides 1 and themselves; 9 = 3×3 and 15 = 3×5.",
  "hint": "Check whether each number can be divided evenly by anything other than 1 and itself."
}`;

// ─── Validation: reject malformed questions before they reach the UI ──────────
function normalizeQuestion(q: any, index: number): Exercise {
    return {
        id: q.id || `q-${Date.now()}-${index}`,
        questionType: q.questionType || QuestionType.MULTIPLE_CHOICE,
        difficulty: typeof q.difficulty === 'number' ? Math.max(1, Math.min(5, q.difficulty)) : 3,
        question: String(q.question ?? '').trim(),
        options: Array.isArray(q.options) ? q.options : [],
        correctOptionId: q.correctOptionId || '',
        correctOptionIds: Array.isArray(q.correctOptionIds) ? q.correctOptionIds.filter((x: any) => typeof x === 'string') : undefined,
        sampleAnswer: q.sampleAnswer || '',
        answerExpression: typeof q.answerExpression === 'string' && q.answerExpression.trim() ? q.answerExpression.trim() : undefined,
        acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers.filter((x: any) => typeof x === 'string') : undefined,
        unitRequired: q.unitRequired === true,
        tolerance: typeof q.tolerance === 'number' && q.tolerance >= 0 ? q.tolerance : undefined,
        roundTo: typeof q.roundTo === 'number' && q.roundTo >= 0 ? q.roundTo : undefined,
        steps: Array.isArray(q.steps) ? q.steps : [],
        skillTag: q.skillTag || 'general',
        xpValue: typeof q.xpValue === 'number' ? q.xpValue : (q.difficulty || 3) * 10,
        explanation: String(q.explanation ?? '').trim(),
        hint: String(q.hint ?? '').trim(),
    } as Exercise;
}

// ─── Single-attempt generation (used by main flow + retry) ────────────────────
async function generateQuizOnce(
    subject: string,
    grade: GradeLevel,
    topic: string,
    language: string,
    count: number,
    questionTypes: QuestionType[],
    context: string | undefined,
    attachments: Attachment[] | undefined,
    seed: number,
    performance?: QuizPerformance
): Promise<Exercise[]> {
    const targetLang = LANG_MAP[language] || language;
    const subjectGuidance = SUBJECT_GUIDANCE[subject] || '';
    const typeList = questionTypes.join(', ');

    // Adapt the difficulty mix to the learner's demonstrated performance.
    const mastery = performance?.mastery;
    const recentRate = performance?.recentTotal
        ? (performance.recentCorrect ?? 0) / performance.recentTotal
        : undefined;
    const signal = recentRate !== undefined ? recentRate * 100 : mastery;
    let easyShare = 0.2, mediumShare = 0.4, hardShare = 0.3, challengeShare = 0.1;
    let adaptNote = '';
    if (signal !== undefined) {
        if (signal < 40) {
            easyShare = 0.5; mediumShare = 0.4; hardShare = 0.1; challengeShare = 0;
            adaptNote = 'The learner is struggling with this topic — favor confidence-building questions and very clear wording.';
        } else if (signal > 75) {
            easyShare = 0.1; mediumShare = 0.3; hardShare = 0.4; challengeShare = 0.2;
            adaptNote = 'The learner is strong on this topic — favor multi-step, applied and synthesis questions. No trivial recall.';
        }
    }
    const performanceBlock = signal !== undefined
        ? `\nLEARNER PERFORMANCE: topic mastery ${mastery ?? 'n/a'}/100${recentRate !== undefined ? `, last session ${(recentRate * 100).toFixed(0)}% correct` : ''}. ${adaptNote}`
        : '';

    const system = `You are an expert educator who writes assessment questions used by millions of students.
Every question you write is checked by other teachers. If a question has a wrong answer, an ambiguous prompt,
or a fact-check failure, it gets pulled and the student loses trust. Your reputation depends on accuracy.

CRITICAL OUTPUT FORMAT:
- Respond with ONLY a valid JSON array. No prose, no markdown fences, no explanations outside the JSON.
- The JSON STRUCTURE (brackets, braces, commas, field names like "question", "options") is ALWAYS in English ASCII.
- Only the VALUES of text content fields (question, explanation, hint, sampleAnswer, options[].text) are in the requested target language.
- Use ONLY standard ASCII double quotes (") to delimit JSON strings. NEVER use smart/curly quotes (" " „ « »).
- Field names "id", "questionType", "skillTag" stay in English (they are identifiers, not display text).
- For Hebrew/Arabic/RTL content: write the text inside the string normally; do NOT add RTL/LTR markers or BOM characters.`;

    const userPrompt = `TASK: Generate exactly ${count} high-quality assessment questions.

SUBJECT: ${subject}
GRADE LEVEL: ${grade}
TOPIC: ${topic}
LANGUAGE: ${targetLang} (every text field must be in ${targetLang}, except code/formulas which stay universal)
QUESTION TYPES ALLOWED: ${typeList}
RANDOMIZATION SEED: ${seed} (use this to ensure questions are different from your default templates)
${performanceBlock}
${subjectGuidance ? `SUBJECT-SPECIFIC GUIDANCE:${subjectGuidance}` : ''}

QUALITY REQUIREMENTS (NON-NEGOTIABLE):
1. ACCURACY: Every fact, formula, date, name must be 100% correct. If you're unsure, choose a different question.
2. SOLVABILITY: The question must contain every value and condition needed to solve it. A reasonable student at grade ${grade} must be able to solve it.
3. UNIQUENESS: Each of the ${count} questions tests a DIFFERENT skill or aspect of "${topic}". No duplicates, no rewordings of the same problem.
4. CLARITY: Questions must be unambiguous — only one defensible correct answer (except MULTI_SELECT, which says "Select all that apply").
5. APPROPRIATE DIFFICULTY: Use this distribution:
   - ${Math.ceil(count * easyShare)} easy (difficulty 1-2): direct recall or one-step
   - ${Math.ceil(count * mediumShare)} medium (difficulty 3): two-step or applied
   - ${Math.floor(count * hardShare)} hard (difficulty 4): multi-step or synthesis
   - ${Math.floor(count * challengeShare)} challenging (difficulty 5): edge case or deeper insight
6. DISTRACTORS (option types): Each wrong option must be plausible — a real mistake a student might make —
   but DEFINITELY incorrect and NOT mathematically equivalent to the correct answer (0.5, 1/2 and 50% are the SAME answer).
   Never use "all of the above" or "none of the above" or absurd options. No two options may be equal or equivalent.
7. EXPLANATIONS: The "explanation" field must TEACH, using the SAME numbers and method as the question — never generic filler.
   1-3 sentences that help a student who got it wrong understand why.
8. MATH ANSWERS ARE MACHINE-VERIFIED: for every question whose answer is a number, measurement, fraction or percentage,
   you MUST provide "answerExpression" — a plain arithmetic expression (digits and + - * / ^ ( ) sqrt() only, NO words, NO LaTeX, NO '=' sign)
   that computes the correct answer. A separate math engine evaluates it and REJECTS your question if the stored answer,
   the marked option, or any distractor disagrees with it. Prefer NUMERIC type over SHORT_ANSWER for numeric answers.

OUTPUT SCHEMA — return EXACTLY this structure as a JSON array:
[
  {
    "id": "q1",
    "questionType": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC" | "MULTI_SELECT" | "SHORT_ANSWER" | "FILL_IN_BLANK",
    "difficulty": 1-5,
    "question": "the question text in ${targetLang}",
    "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
    "correctOptionId": "a"|"b"|"c"|"d",
    "correctOptionIds": ["a","c"],
    "sampleAnswer": "for non-option types",
    "answerExpression": "pure arithmetic expression for numeric answers, e.g. \\"40 - 40*0.25\\"",
    "acceptableAnswers": ["optional alternate valid forms"],
    "unitRequired": false,
    "roundTo": null,
    "steps": [],
    "skillTag": "specific skill being tested in English",
    "xpValue": difficulty * 10,
    "explanation": "1-3 sentence teaching explanation in ${targetLang}",
    "hint": "1 sentence hint in ${targetLang} that guides WITHOUT revealing the answer"
  }
]

FIELD RULES BY TYPE:
- MULTIPLE_CHOICE: REQUIRED options (4 items), REQUIRED correctOptionId. Leave sampleAnswer "" and steps [].
  If the answer is numeric, ALSO provide answerExpression so the engine can verify the marked option.
- TRUE_FALSE: EXACTLY 2 options ({"id":"t","text":"True"},{"id":"f","text":"False"} translated to ${targetLang}), REQUIRED correctOptionId.
  The statement must be verifiably true or false — no opinions.
- NUMERIC: the answer is a number/measurement/fraction/percentage. REQUIRED answerExpression. Leave options [].
  If the answer needs a unit, write the question to say so and set unitRequired true, with sampleAnswer like "5 cm".
  If the question asks to round, set roundTo to the number of decimals.
- MULTI_SELECT: 4-5 options, REQUIRED correctOptionIds (2 or more, but never all). The question MUST say "Select all that apply" in ${targetLang}.
- SHORT_ANSWER: for conceptual/verbal answers only (never pure numbers). REQUIRED sampleAnswer (a complete model answer). Leave options [].
- FILL_IN_BLANK: Use ___ in the question. REQUIRED sampleAnswer (the missing word/phrase). Leave options [].
- MULTI_STEP: REQUIRED steps [] (2-4 expected solution steps) plus sampleAnswer for the final result; add answerExpression when numeric.

LATEX RULES (math expressions only):
- Inline math: $expression$ — example: "Solve $2x + 3 = 11$"
- Display math: $$expression$$
- CRITICAL: This is JSON, so DOUBLE every backslash. Write \\\\frac, \\\\sqrt, \\\\pi — NOT \\frac.

${context ? `\nADDITIONAL CONTEXT TO USE:\n${context}\n` : ''}

VERIFY YOUR WORK BEFORE RETURNING:
- For each multiple-choice question: confirm the marked correct answer is actually correct.
- For each math problem: redo the computation. If the result doesn't match your stated answer, fix it.
- Confirm every "id" in correctOptionId actually exists in the options array.
- Confirm the JSON is valid (balanced brackets, proper escaping).

Now generate the JSON array. NO PROSE before or after — just the JSON.`;

    const content: object[] = [];
    if (attachments?.length) attachments.forEach(att => content.push(contentBlock(att)));
    content.push({ type: 'text', text: userPrompt + '\n\n' + TYPE_EXAMPLES });

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content }],
    });

    if (!text) return [];

    let raw: any[];
    try {
        const parsed = parseJson(text);
        raw = Array.isArray(parsed) ? parsed : (parsed?.questions || parsed?.exercises || []);
    } catch (err) {
        console.error('Quiz JSON parse failed:', err);
        return [];
    }

    // Deterministic validation gate: the math engine re-verifies stored
    // answers, duplicate/equivalent options are rejected, and anything that
    // fails is discarded here — a broken question never reaches the learner.
    const { valid, discarded } = sanitizeQuiz(raw.map(normalizeQuestion));
    if (discarded.length) {
        console.warn(`Quiz validation discarded ${discarded.length} question(s):`,
            discarded.map(d => `"${d.question}" → ${d.reasons.join('; ')}`));
    }
    return valid;
}

// ─── Public API: tries up to 2 attempts, fills with simpler retry if needed ──
export const generateQuiz = async (
    subject: string,
    grade: GradeLevel,
    topic: string,
    language: string,
    context?: string,
    attachments?: Attachment[],
    questionTypes?: QuestionType[],
    count: number = 10,
    performance?: QuizPerformance
): Promise<Exercise[]> => {
    const types = questionTypes && questionTypes.length > 0
        ? questionTypes
        : [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.NUMERIC, QuestionType.MULTI_SELECT];

    // Attempt 1: full quality
    const seed1 = Date.now() % 100000;
    let questions: Exercise[] = [];
    try {
        questions = await generateQuizOnce(subject, grade, topic, language, count, types, context, attachments, seed1, performance);
    } catch (e: any) {
        console.error('Quiz attempt 1 failed:', e?.message || e);
    }

    // If we got at least 60% of the requested questions, that's good enough
    if (questions.length >= Math.ceil(count * 0.6)) {
        return questions.slice(0, count);
    }

    // Attempt 2: simpler — multiple choice only, fewer questions, fresh seed
    console.warn(`Quiz attempt 1 produced only ${questions.length}/${count} valid questions — retrying with simpler config.`);
    const seed2 = (Date.now() + 7919) % 100000;
    try {
        const retry = await generateQuizOnce(
            subject, grade, topic, language,
            count, [QuestionType.MULTIPLE_CHOICE],
            context, attachments, seed2, performance
        );
        // Merge: keep originals first, fill with retry
        const seenQs = new Set(questions.map(q => q.question.toLowerCase().trim()));
        for (const q of retry) {
            if (questions.length >= count) break;
            const key = q.question.toLowerCase().trim();
            if (!seenQs.has(key)) {
                seenQs.add(key);
                questions.push(q);
            }
        }
    } catch (e: any) {
        console.error('Quiz attempt 2 failed:', e?.message || e);
    }

    return questions.slice(0, count);
};

// ─── PRESENTATION GENERATION ──────────────────────────────────────────────────

export const generatePresentation = async (
    topic: string,
    subject: string,
    grade: GradeLevel,
    language: string,
    context?: string
): Promise<Presentation> => {
    const targetLang = LANG_MAP[language] || language;

    const prompt = `You are an expert educator. Create a detailed slide deck presentation in ${targetLang}.

Topic: ${topic}
Subject: ${subject}
Grade Level: ${grade}
${context ? `Additional Context: ${context}` : ''}

Generate 8-10 slides. Return ONLY a JSON object (no markdown, no code blocks):
{
  "title": "Presentation title",
  "subject": "${subject}",
  "totalSlides": 9,
  "slides": [
    {
      "slideNumber": 1,
      "title": "slide title",
      "layout": "title",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"],
      "body": "2-3 sentence paragraph that elaborates on the slide topic with key details, context, or explanation",
      "imageKeyword": "short English keyword for finding a relevant photo (e.g. 'photosynthesis', 'ancient rome map', 'algebra equations')",
      "speakerNotes": "2-3 sentence paragraph for the presenter with teaching tips and extra context"
    }
  ]
}

Rules:
- layout is "title" for the first/last slides, "content" for regular slides, "split" for slides with a key visual concept
- Slide 1: title/intro slide — 2-3 bullets summarizing what will be covered; body gives overview; layout = "title"
- Final slide: summary/conclusion — key takeaways; layout = "title"
- Each middle slide: one focused concept; 3-5 bullets (concise, max 10 words each); body = 2-3 full sentences expanding on the concept
- body must be informative full sentences, NOT a restatement of bullets
- imageKeyword: 2-4 English words that describe a relevant image (always in English regardless of output language)
- speakerNotes: full sentences with teaching context and presentation guidance
- ALL text fields except imageKeyword must be in ${targetLang}`;

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
    });

    if (!text) throw new Error('generatePresentation: empty response');
    return parseJson(text) as Presentation;
};

// ─── CODING CHALLENGE GENERATION ─────────────────────────────────────────────

export const generateCodingChallenge = async (
    codeLanguage: CodeLanguage,
    grade: GradeLevel,
    topic: string,
    uiLanguage: string
): Promise<CodingChallenge> => {
    const targetLang = LANG_MAP[uiLanguage] || uiLanguage;

    const difficultyMap: Partial<Record<GradeLevel, string>> = {
        [GradeLevel.KINDER]: 'very simple (print statements only)',
        [GradeLevel.ELEMENTARY_1_3]: 'beginner (variables, simple loops)',
        [GradeLevel.ELEMENTARY_4_6]: 'beginner-intermediate (loops, conditionals)',
        [GradeLevel.MIDDLE_7_8]: 'intermediate (functions, arrays)',
        [GradeLevel.HIGH_9_10]: 'intermediate-advanced (OOP basics)',
        [GradeLevel.HIGH_11_12]: 'advanced (algorithms, data structures)',
        [GradeLevel.COLLEGE_FRESHMAN]: 'advanced (algorithms, complexity)',
        [GradeLevel.COLLEGE_ADVANCED]: 'expert (design patterns, optimization)',
    };
    const difficulty = difficultyMap[grade] ?? 'intermediate';

    const langNames: Record<CodeLanguage, string> = {
        python: 'Python 3',
        javascript: 'JavaScript (Node.js)',
        java: 'Java',
        cpp: 'C++',
        sql: 'SQL (SQLite)',
    };

    const isSql = codeLanguage === 'sql';
    const prompt = isSql
        ? `Create a SQL challenge for a ${grade} student. Difficulty: ${difficulty}.
UI Language: ${targetLang} — write description and hints in ${targetLang}, SQL keywords in English.

Return ONLY a JSON object (no markdown):
{
  "id": "ch-1",
  "title": "challenge title in ${targetLang}",
  "description": "2-3 sentence problem description in ${targetLang}. Describe the table schema and what query to write.",
  "starterCode": "-- Write your SQL query here\\nSELECT ",
  "expectedBehavior": "what columns/rows the query should return, in ${targetLang}",
  "hints": ["hint 1 in ${targetLang}", "hint 2 in ${targetLang}"],
  "xpValue": 75
}
Rules: challenge must involve 1-2 tables with clear column names; solvable in 1-3 SQL clauses; xpValue 50-150.`
        : `Create a coding challenge in ${langNames[codeLanguage]} for a ${grade} student. Difficulty: ${difficulty}.
Topic context: ${topic}
UI Language: ${targetLang} — write description and hints in ${targetLang} but code in ${codeLanguage}.

Return ONLY a JSON object (no markdown, no code blocks):
{
  "id": "ch-1",
  "title": "challenge title in ${targetLang}",
  "description": "2-3 sentence problem description in ${targetLang}. Include sample input/output.",
  "starterCode": "starter code with function signature and a TODO comment",
  "expectedBehavior": "what the program should print/return, in ${targetLang}",
  "hints": ["hint 1 in ${targetLang}", "hint 2 in ${targetLang}"],
  "xpValue": 75
}

Rules:
- starterCode must be valid ${langNames[codeLanguage]} syntax with a clear TODO comment
- The challenge must be completable in 10-20 lines of code
- No external libraries required
- xpValue between 50 and 150 based on difficulty`;

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
    });

    if (!text) throw new Error('generateCodingChallenge: empty response');
    return parseJson(text) as CodingChallenge;
};

// ─── GAME QUESTION GENERATION ─────────────────────────────────────────────────

export const generateGameQuestions = async (
    gameType: GameType,
    subject: Subject,
    grade: GradeLevel,
    language: string,
    count: number = 15
): Promise<GameQuestion[]> => {
    const targetLang = LANG_MAP[language] || language;

    const typeInstructions: Record<GameType, string> = {
        'cave-runner': `Generate ${count} rapid arithmetic questions suitable for ${grade}.
Each answer must be a single number (integer or simple decimal).
Questions must be answerable in under 5 seconds.
Example: { "id": "1", "question": "14 × 3", "answer": "42", "distractors": [] }`,

        'balloon-pop': `Generate ${count} vocabulary matching pairs for ${subject} at ${grade} level.
Question is a term or concept. Answer is its short definition (3-8 words).
Also provide exactly 3 distractor answers (wrong definitions, plausible but incorrect).
Example: { "id": "1", "question": "Photosynthesis", "answer": "Plants converting light to food", "distractors": ["Process of cellular respiration", "Movement of water through roots", "Breaking down glucose for energy"] }`,

        'memory-match': `Generate ${Math.floor(count / 2)} concept-definition pairs for ${subject} at ${grade} level.
Return ${count} objects total — pairs of concept+definition. Each pair shares the same pairId in the answer field.
Example pair:
{ "id": "1", "question": "Mitosis", "answer": "pair-1", "distractors": [] }
{ "id": "2", "question": "Cell division producing identical daughter cells", "answer": "pair-1", "distractors": [] }`,

        'bug-fix': `Generate ${count} rapid arithmetic questions suitable for ${grade}.
Each answer must be a single number (integer or simple decimal).
Example: { "id": "1", "question": "8 + 9", "answer": "17", "distractors": [] }`,

        'picture-tap': `Generate ${count} visual picture-matching questions for young learners (K-2 level).
Each question is a short clue. The answer is a single emoji that correctly answers the clue. Distractors are 3 other emojis that are plausible but wrong.
Use simple, concrete concepts: animals, fruits, shapes, colors, vehicles, foods, weather, basic objects.
Example: { "id": "1", "question": "Which animal says moo?", "answer": "🐄", "distractors": ["🐶", "🐱", "🐔"] }
All question text in ${targetLang}. Emojis are universal — keep them as emoji characters in the answer and distractors fields.`,

        'word-scramble': `Generate ${count} vocabulary words for a word-scramble game for ${subject} at ${grade} level.
Question is a short definition or clue (5-10 words). Answer is the UPPERCASE vocabulary word (4-8 letters, single word, no spaces, no hyphens).
Distractors are empty.
Example: { "id": "1", "question": "The opposite of hot", "answer": "COLD", "distractors": [] }
Choose concrete, grade-appropriate words. All question/clue text in ${targetLang}. Answer word always in UPPERCASE English letters.`,
    };

    const prompt = `Generate game questions in ${targetLang}.
Subject: ${subject}, Grade: ${grade}
Game type: ${gameType}
${typeInstructions[gameType]}

Return ONLY a JSON array (no markdown, no code blocks):
[{ "id": "string", "question": "string", "answer": "string", "distractors": ["string"] }]
ALL text in ${targetLang}.`;

    try {
        const text = await callClaude({
            model: HAIKU,
            max_tokens: 3000,
            messages: [{ role: 'user', content: prompt }],
        });

        if (!text) return [];
        const raw = parseJson(text);
        return Array.isArray(raw) ? raw as GameQuestion[] : [];
    } catch (error: any) {
        console.error('generateGameQuestions error:', error);
        return [];
    }
};

// ─── BUGGY CODE GENERATION ────────────────────────────────────────────────────

export const generateBuggyCode = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<BuggyCode> => {
    const targetLang = LANG_MAP[language] || language;

    const prompt = `You are creating a coding bug-fix game for a ${grade} student studying ${subject}.
Generate a short Python code snippet (10-18 lines) that has EXACTLY 3 deliberate bugs.
The bugs should be beginner-level mistakes: off-by-one errors, wrong operators, wrong variable names, missing colons, wrong indentation levels, incorrect comparisons, etc.
The code should look like a real program — something a student might write.
UI language: ${targetLang} — write title, narrative, and hints in ${targetLang}. Code stays in Python.

Return ONLY a JSON object (no markdown, no code blocks):
{
  "title": "short game title in ${targetLang}",
  "narrative": "1-2 sentence dramatic story about why the user must fix this code, in ${targetLang}",
  "language": "python",
  "code": ["line 1 of code", "line 2 of code", "..."],
  "bugs": [
    {
      "lineIndex": 3,
      "buggyLine": "exact buggy line as it appears in code array",
      "fixedLine": "the correct version of that line",
      "hint": "short hint in ${targetLang}"
    }
  ]
}

Rules:
- code array has each line as a separate string (preserve indentation with spaces)
- bugs array has EXACTLY 3 entries
- lineIndex is 0-based index into the code array
- buggyLine must EXACTLY match code[lineIndex]
- The fixed code should be syntactically correct Python that runs successfully
- Bugs must be on different lines`;

    const text = await callClaude({
        model: HAIKU,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
    });

    if (!text) throw new Error('generateBuggyCode: empty response');
    return parseJson(text) as BuggyCode;
};

// ─── DEBATE ARENA ─────────────────────────────────────────────────────────────

export const generateDebateTopic = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<{ topic: string; aiSide: 'FOR' | 'AGAINST'; openingStatement: string }> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Generate a debate topic for a ${grade} student studying ${subject}.
Return ONLY a JSON object (no markdown):
{
  "topic": "A clear, debatable statement under 15 words",
  "aiSide": "FOR",
  "openingStatement": "A compelling 2-3 sentence opening argument FOR this topic, in ${targetLang}"
}
Rules:
- topic must have valid arguments on both sides, age-appropriate for ${grade}
- aiSide is always "FOR"
- ALL text in ${targetLang}`;

    const text = await callClaude({ model: HAIKU, max_tokens: 512,
        messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generateDebateTopic: empty response');
    return parseJson(text) as any;
};

export const evaluateDebateArgument = async (params: {
    topic: string;
    aiSide: string;
    userSide: string;
    history: DebateTurn[];
    userArgument: string;
    round: number;
    language: string;
}): Promise<{ score: number; feedback: string; counterArgument: string; isLastRound: boolean; totalScore?: number; overallFeedback?: string }> => {
    const targetLang = LANG_MAP[params.language] || params.language;
    const historyText = params.history
        .map(t => `${t.role === 'ai' ? 'AI (' + params.aiSide + ')' : 'Student (' + params.userSide + ')'}: ${t.text}`)
        .join('\n');

    const prompt = `You are a debate judge evaluating a student's argument.
Topic: "${params.topic}"
AI argues: ${params.aiSide} | Student argues: ${params.userSide}
Round: ${params.round}/4

Previous turns:
${historyText}

Student's latest argument: "${params.userArgument}"

Return ONLY a JSON object (no markdown):
{
  "score": 7,
  "feedback": "1-2 sentence encouraging assessment of the student's argument in ${targetLang}",
  "counterArgument": "Your 2-3 sentence counter-argument as the ${params.aiSide} side, in ${targetLang}",
  "isLastRound": ${params.round >= 4},
  "totalScore": ${params.round >= 4 ? 'calculate average score 0-10 for all rounds' : 'null'},
  "overallFeedback": ${params.round >= 4 ? '"2 sentence overall assessment of debating skills in ' + targetLang + '"' : 'null'}
}
Score 0-10 based on: relevance, logical strength, evidence quality, persuasiveness.
ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 800,
        messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('evaluateDebateArgument: empty response');
    return parseJson(text) as any;
};

// ─── STORY ENGINE ─────────────────────────────────────────────────────────────

export const generateStoryOpening = async (
    subject: Subject,
    genre: string,
    grade: GradeLevel,
    language: string
): Promise<{ title: string; opening: string; prompt: string }> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Write an engaging story opening for a ${grade} student. Subject context: ${subject}. Genre: ${genre}.
Return ONLY a JSON object (no markdown):
{
  "title": "Story title in ${targetLang}",
  "opening": "A gripping 120-160 word opening paragraph that ends on a cliffhanger, in ${targetLang}",
  "prompt": "A short direct question asking what the protagonist does next, in ${targetLang} (e.g. 'What does Maya do?')"
}
The opening must end at a moment of tension or decision. Keep vocabulary appropriate for ${grade}.
ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 800,
        messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generateStoryOpening: empty response');
    return parseJson(text) as any;
};

export const continueStory = async (params: {
    storyHistory: StoryChapter[];
    userContribution: string;
    chapter: number;
    language: string;
    isLastChapter: boolean;
}): Promise<{ continuation: string; nextPrompt?: string; evaluation?: StoryEvaluation }> => {
    const targetLang = LANG_MAP[params.language] || params.language;
    const historyText = params.storyHistory
        .map(c => `[${c.role === 'ai' ? 'Story' : 'Student'}]: ${c.text}`)
        .join('\n\n');

    const prompt = `You are a collaborative story writer. Continue this story based on the student's contribution.

Story so far:
${historyText}

Student wrote: "${params.userContribution}"
Chapter: ${params.chapter}/4

${params.isLastChapter ? `This is the FINAL chapter. Write a satisfying conclusion (100-140 words) and evaluate the student's writing.
Return ONLY a JSON object:
{
  "continuation": "The story conclusion in ${targetLang}",
  "evaluation": {
    "creativity": 75,
    "vocabulary": 80,
    "narrative": 70,
    "overall": 75,
    "feedback": "2-3 sentence encouraging assessment in ${targetLang}"
  }
}` : `Write the next story section (100-130 words) that incorporates the student's contribution and ends on a new cliffhanger.
Return ONLY a JSON object:
{
  "continuation": "Next story section in ${targetLang}",
  "nextPrompt": "Short question asking what happens next, in ${targetLang}"
}`}
ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('continueStory: empty response');
    return parseJson(text) as any;
};

// ─── SQL DETECTIVE ────────────────────────────────────────────────────────────

export const generateMystery = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<MysteryCase> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Create a fun mystery case for a ${grade} student studying ${subject}.
The mystery must be solvable using SQL queries against a simple SQLite database.
Return ONLY a JSON object (no markdown):
{
  "title": "Murder/theft/mystery case title in ${targetLang}",
  "description": "2-3 sentence case description: what happened, what the detective needs to find, in ${targetLang}",
  "schemaDescription": "Human-readable schema: list the tables, their columns and what they mean, in ${targetLang}",
  "pythonSetup": "Python 3 code using sqlite3 to CREATE and INSERT all data (no imports needed, just CREATE TABLE + INSERT statements using conn and c variables)",
  "suspects": ["Name1", "Name2", "Name3", "Name4", "Name5"],
  "culprit": "Name1",
  "clues": ["Clue 1: hint about what SQL query to write in ${targetLang}", "Clue 2 in ${targetLang}", "Clue 3 in ${targetLang}"]
}
Rules:
- pythonSetup must only contain SQL CREATE TABLE and INSERT statements via c.execute() — no imports, no conn.commit(), no variable declarations, just c.execute() calls
- Create 2-3 simple related tables (e.g. suspects, alibis, evidence)
- The culprit must be determinable from the data using 2-3 JOIN or WHERE queries
- suspects list must include the culprit
- ALL descriptive text in ${targetLang}, table/column names always in English`;

    const text = await callClaude({ model: HAIKU, max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generateMystery: empty response');
    return parseJson(text) as MysteryCase;
};

// ─── STREAMING ────────────────────────────────────────────────────────────────

export async function streamAI(
    system: string,
    userMessage: string,
    onChunk: (text: string) => void,
    onDone: (full: string) => void
): Promise<void> {
    const res = await fetch(`${API_BASE}/api/claude-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system,
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 4096,
        }),
    });
    if (!res.ok || !res.body) throw new Error(`Stream failed: HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
                const obj = JSON.parse(data);
                if (obj.text) { full += obj.text; onChunk(obj.text); }
            } catch { /* ignore parse errors */ }
        }
    }
    onDone(full);
}

// ─── CODE LAB v2 ──────────────────────────────────────────────────────────────

export const getSocraticHint = async (
    code: string,
    challengeDescription: string,
    codeLanguage: string,
    hintNumber: number,
    grade: GradeLevel,
    language: string
): Promise<string> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `A ${grade} student is working on this coding challenge:
"${challengeDescription}"

Their current code:
\`\`\`${codeLanguage}
${code}
\`\`\`

This is hint #${hintNumber} of 3. Give a Socratic hint — ask a guiding question or give a very small nudge, NOT the full solution. Be encouraging. 1-2 sentences max. ALL text in ${targetLang}.`;
    return await callClaude({ model: HAIKU, max_tokens: 256, messages: [{ role: 'user', content: prompt }] });
};

export const explainCodeError = async (
    code: string,
    stderr: string,
    codeLanguage: string,
    grade: GradeLevel,
    language: string
): Promise<string> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `A ${grade} student wrote this ${codeLanguage} code:
\`\`\`
${code}
\`\`\`
It produced this error:
${stderr}

Explain the error in plain language appropriate for a ${grade} student. Be encouraging and specific about what caused it and how to fix it. 3-4 sentences max. ALL text in ${targetLang}.`;
    return await callClaude({ model: HAIKU, max_tokens: 512, messages: [{ role: 'user', content: prompt }] });
};

export const evaluateCodeSolution = async (
    code: string,
    codeLanguage: string,
    expectedBehavior: string,
    stdout: string
): Promise<ChallengeTestResult[]> => {
    const prompt = `A student wrote this ${codeLanguage} code to solve the following challenge:
Expected behavior: "${expectedBehavior}"

Student code:
\`\`\`
${code}
\`\`\`

Actual output:
${stdout || '(no output)'}

Evaluate against exactly 5 test cases relevant to this challenge. For each test case, determine if the student's code would likely pass based on the code logic and output.
Return ONLY a JSON array (no markdown):
[
  { "passed": true, "testLabel": "Basic case", "actual": "Output matches" },
  { "passed": false, "testLabel": "Edge case: empty input", "actual": "Would fail with empty list" },
  { "passed": true, "testLabel": "Large numbers", "actual": "Handles correctly" },
  { "passed": false, "testLabel": "Negative numbers", "actual": "No handling for negatives" },
  { "passed": true, "testLabel": "Multiple values", "actual": "Works correctly" }
]`;
    const text = await callClaude({ model: HAIKU, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
    if (!text) return [];
    try { return parseJson(text) as ChallengeTestResult[]; } catch { return []; }
};

export const reviewCode = async (
    code: string,
    codeLanguage: string,
    grade: GradeLevel,
    language: string
): Promise<CodeReview> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Review this ${codeLanguage} code written by a ${grade} student and provide constructive feedback.
\`\`\`
${code}
\`\`\`
Return ONLY a JSON object (no markdown):
{
  "suggestions": [
    "Specific improvement suggestion 1 in ${targetLang} — reference actual line or variable names",
    "Specific improvement suggestion 2 in ${targetLang}",
    "Specific improvement suggestion 3 in ${targetLang}"
  ],
  "conceptTags": ["loops", "variables", "functions"]
}
Suggestions must be constructive, specific (reference exact code), and grade-appropriate. Concept tags are English keywords. ALL suggestion text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
    if (!text) return { suggestions: [], conceptTags: [] };
    try { return parseJson(text) as CodeReview; } catch { return { suggestions: [], conceptTags: [] }; }
};

// ─── DEBATE ARENA v2 ──────────────────────────────────────────────────────────

export const generateDebateTopicV2 = async (
    subject: Subject,
    format: string,
    userSide: string,
    difficulty: string,
    grade: GradeLevel,
    language: string
): Promise<{ topic: string; aiSide: string; userSide: string; openingStatement: string }> => {
    const targetLang = LANG_MAP[language] || language;
    const aiSide = userSide === 'FOR' ? 'AGAINST' : 'FOR';
    const formatDesc = {
        'classic': `Classic debate: AI argues ${aiSide}, user argues ${userSide}`,
        'devils-advocate': `Devil's Advocate: AI argues a position it might not actually support`,
        'steel-man': `Steel Man: AI presents the absolute strongest possible argument for ${aiSide}`,
        'socratic': `Socratic: AI only asks probing questions, never makes direct claims`,
    }[format] || 'Classic debate';

    const prompt = `Generate a ${difficulty} ${subject} debate topic for a ${grade} student.
Format: ${formatDesc}
Return ONLY a JSON object (no markdown):
{
  "topic": "A clear debatable statement under 15 words, topic text in ${targetLang}",
  "aiSide": "${aiSide}",
  "userSide": "${userSide}",
  "openingStatement": "A compelling 2-3 sentence opening from the AI's perspective, in ${targetLang}"
}
Topic must be age-appropriate for ${grade}, with valid arguments on both sides. ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generateDebateTopicV2: empty response');
    return parseJson(text) as any;
};

export const evaluateDebateArgumentV2 = async (params: {
    topic: string;
    format: string;
    difficulty: string;
    aiSide: string;
    userSide: string;
    history: { role: string; text: string }[];
    userArgument: string;
    round: number;
    totalRounds: number;
    language: string;
}): Promise<{ scores: ArgumentScore; counterArgument: string; overallFeedback?: string }> => {
    const targetLang = LANG_MAP[params.language] || params.language;
    const historyText = params.history.map(t => `${t.role}: ${t.text}`).join('\n');
    const isLast = params.round >= params.totalRounds;

    const prompt = `You are a ${params.difficulty} debate judge.
Topic: "${params.topic}"
Format: ${params.format} | AI argues: ${params.aiSide} | Student argues: ${params.userSide}
Round: ${params.round}/${params.totalRounds}
History:\n${historyText}
Student's argument: "${params.userArgument}"

Return ONLY a JSON object (no markdown):
{
  "scores": {
    "logic": 7,
    "evidence": 6,
    "persuasiveness": 8,
    "relevance": 7,
    "explanation": "One sentence explaining the scores overall, in ${targetLang}"
  },
  "counterArgument": "Your 2-3 sentence response as the ${params.aiSide} side (${params.format === 'socratic' ? 'Ask 2 probing questions only, no claims' : 'Make a strong counter-argument'}), in ${targetLang}"${isLast ? `,
  "overallFeedback": "2 sentence overall assessment of the student's debate performance, in ${targetLang}"` : ''}
}
Score 0-10 each: logic (reasoning quality), evidence (use of facts), persuasiveness (impact), relevance (stays on topic). ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 900, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('evaluateDebateArgumentV2: empty response');
    return parseJson(text) as any;
};

export const suggestDebateEvidence = async (
    topic: string,
    side: string,
    language: string
): Promise<string[]> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `For the debate topic: "${topic}", suggest 3 real-world facts, studies, or examples that someone arguing ${side} could cite.
Return ONLY a JSON array of 3 strings. Each string is one fact/evidence point, 1-2 sentences. Be specific and factual. ALL text in ${targetLang}.
Example: ["Studies show X...", "In 2019, researchers found...", "A famous example is..."]`;
    const text = await callClaude({ model: HAIKU, max_tokens: 500, messages: [{ role: 'user', content: prompt }] });
    if (!text) return [];
    try { return parseJson(text) as string[]; } catch { return []; }
};

export const identifyWeakPoint = async (
    aiArgument: string,
    language: string
): Promise<string> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Identify the single weakest point in this argument WITHOUT writing a rebuttal for the student:
"${aiArgument}"
Return one sentence in ${targetLang} that identifies the vulnerability (e.g. "This argument assumes X without evidence" or "This overlooks the fact that..."). Do NOT write the rebuttal itself — just identify the weak point.`;
    return await callClaude({ model: HAIKU, max_tokens: 200, messages: [{ role: 'user', content: prompt }] });
};

export const generateDebateSummary = async (
    topic: string,
    turns: { role: string; text: string; scores?: ArgumentScore }[],
    language: string
): Promise<{ strongestArg: string; weakestArg: string; whatOpponentCouldSay: string }> => {
    const targetLang = LANG_MAP[language] || language;
    const studentTurns = turns.filter(t => t.role === 'user').map(t => t.text).join('\n---\n');
    const prompt = `Debate topic: "${topic}". Student's arguments: ${studentTurns}
Return ONLY a JSON object (no markdown):
{
  "strongestArg": "Quote the student's best argument and explain in 1 sentence why it was effective, in ${targetLang}",
  "weakestArg": "Quote the student's weakest argument and explain in 1 sentence what was missing, in ${targetLang}",
  "whatOpponentCouldSay": "2-3 sentences showing what a strong opponent would have argued to counter the student, in ${targetLang}"
}
ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
    if (!text) return { strongestArg: '', weakestArg: '', whatOpponentCouldSay: '' };
    try { return parseJson(text) as any; } catch { return { strongestArg: '', weakestArg: '', whatOpponentCouldSay: '' }; }
};

// ─── STORY ENGINE v2 ──────────────────────────────────────────────────────────

export const generateStoryOpeningV2 = async (
    subject: Subject,
    genre: string,
    mode: string,
    writingFocus: string,
    grade: GradeLevel,
    language: string
): Promise<{ title: string; opening: string; prompt: string; choices?: BranchChoice[] }> => {
    const targetLang = LANG_MAP[language] || language;
    const focusNote = writingFocus ? `Writing focus: emphasize ${writingFocus} throughout.` : '';
    const guidedNote = mode === 'guided' ? 'Include 3 branching choices for the student to pick from.' : '';

    const prompt = `Write a story opening for a ${grade} student. Subject: ${subject}. Genre: ${genre}. ${focusNote} ${guidedNote}
Return ONLY a JSON object (no markdown):
{
  "title": "Story title in ${targetLang}",
  "opening": "Gripping 120-160 word opening in ${targetLang} ending on a decision moment",
  "prompt": "Short question asking what happens next, in ${targetLang}"${mode === 'guided' ? `,
  "choices": [
    { "id": "a", "text": "Choice A description (10-15 words) in ${targetLang}", "consequence": "This path leads to... (8 words) in ${targetLang}" },
    { "id": "b", "text": "Choice B description in ${targetLang}", "consequence": "Consequence in ${targetLang}" },
    { "id": "c", "text": "Choice C description in ${targetLang}", "consequence": "Consequence in ${targetLang}" }
  ]` : ''}
}
ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 900, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generateStoryOpeningV2: empty response');
    return parseJson(text) as any;
};

export const continueStoryV2 = async (params: {
    storyHistory: { role: string; text: string }[];
    userContribution: string;
    chapter: number;
    totalChapters: number;
    mode: string;
    writingFocus: string;
    acceptedSuggestions: string[];
    language: string;
}): Promise<{ continuation: string; nextPrompt?: string; suggestions?: InlineSuggestion[]; choices?: BranchChoice[]; evaluation?: StoryEvaluation }> => {
    const targetLang = LANG_MAP[params.language] || params.language;
    const isLast = params.chapter >= params.totalChapters;
    const historyText = params.storyHistory.map(c => `[${c.role === 'ai' ? 'Story' : 'Student'}]: ${c.text}`).join('\n\n');
    const focusNote = params.writingFocus ? `Coach for ${params.writingFocus}.` : '';
    const branchEvery2 = params.chapter % 2 === 0 && !isLast && params.mode === 'collaborative';

    const prompt = `You are a collaborative story writer. ${focusNote}
Story so far:\n${historyText}
Student wrote: "${params.userContribution}"
Chapter: ${params.chapter}/${params.totalChapters}
${params.acceptedSuggestions.length > 0 ? `Student accepted suggestions: ${params.acceptedSuggestions.join('; ')}` : ''}

${isLast ? `Final chapter — write satisfying conclusion (100-140 words) and evaluate.
Return ONLY JSON:
{
  "continuation": "Story conclusion in ${targetLang}",
  "evaluation": {
    "creativity": 75, "vocabulary": 80, "narrative": 70, "overall": 75,
    "feedback": "2-3 sentence encouraging assessment in ${targetLang}"
  }
}` : `Continue story (100-130 words), incorporate student's contribution, end on cliffhanger.
Return ONLY JSON:
{
  "continuation": "Next section in ${targetLang}",
  "nextPrompt": "Short question in ${targetLang}",
  "suggestions": [
    { "text": "Coaching suggestion 1 (1 sentence) in ${targetLang}", "type": "sensory" },
    { "text": "Coaching suggestion 2 in ${targetLang}", "type": "motivation" }
  ]${branchEvery2 ? `,
  "choices": [
    { "id": "a", "text": "Branch choice A in ${targetLang}", "consequence": "Leads to... in ${targetLang}" },
    { "id": "b", "text": "Branch choice B in ${targetLang}", "consequence": "Leads to... in ${targetLang}" },
    { "id": "c", "text": "Branch choice C in ${targetLang}", "consequence": "Leads to... in ${targetLang}" }
  ]` : ''}
}`}
ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('continueStoryV2: empty response');
    return parseJson(text) as any;
};

export const generateStorySummary = async (
    userChapters: string[],
    language: string
): Promise<{ bestSentence: string; synopsis: string; vocabularyElevations: { word: string; suggestion: string }[] }> => {
    const targetLang = LANG_MAP[language] || language;
    const combined = userChapters.join('\n\n');
    const prompt = `Analyze this student's story writing:
${combined}

Return ONLY a JSON object (no markdown):
{
  "bestSentence": "Quote the single best sentence the student wrote, then explain in 1 sentence why it works, in ${targetLang}",
  "synopsis": "3-sentence story synopsis in ${targetLang}",
  "vocabularyElevations": [
    { "word": "big", "suggestion": "Consider 'enormous' or 'colossal'" },
    { "word": "said", "suggestion": "Consider 'whispered' or 'exclaimed'" },
    { "word": "good", "suggestion": "Consider 'exceptional' or 'remarkable'" }
  ]
}
Vocabulary elevations: find 3 simple words in the student's writing that could be upgraded. ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
    if (!text) return { bestSentence: '', synopsis: '', vocabularyElevations: [] };
    try { return parseJson(text) as any; } catch { return { bestSentence: '', synopsis: '', vocabularyElevations: [] }; }
};

// ─── SQL DETECTIVE v2 ─────────────────────────────────────────────────────────

export const generateMysteryV2 = async (
    subject: Subject,
    grade: GradeLevel,
    difficulty: CaseDifficulty,
    theme: CaseTheme,
    language: string
): Promise<MysteryCase & { hints: [string, string, string]; conceptTags: string[] }> => {
    const targetLang = LANG_MAP[language] || language;
    const diffMap: Record<CaseDifficulty, string> = {
        rookie: 'Use only SELECT, WHERE, and ORDER BY. 2 tables.',
        detective: 'Use JOIN between 2-3 tables. Include GROUP BY.',
        inspector: 'Use subqueries and complex WHERE conditions. 3-4 tables.',
        chief: 'Use window functions (ROW_NUMBER, RANK), CTEs, or complex aggregations. 4-5 tables.',
    };
    const themeMap: Record<CaseTheme, string> = {
        crime: 'crime/murder mystery with suspects, alibis, evidence',
        corporate: 'corporate espionage with employees, projects, transactions',
        archaeological: 'archaeological discovery with artifacts, excavation sites, researchers',
        medical: 'medical mystery with patients, symptoms, treatments, doctors',
    };

    const prompt = `Create a ${theme} mystery case for a ${grade} student. ${diffMap[difficulty]}
Theme: ${themeMap[theme]}
Return ONLY a JSON object (no markdown):
{
  "title": "Mystery case title in ${targetLang}",
  "description": "2-3 sentence case description in ${targetLang}",
  "schemaDescription": "Human-readable schema description in ${targetLang} listing all tables and their purpose",
  "pythonSetup": "Python 3 sqlite3 code: only c.execute() calls for CREATE TABLE and INSERT. No imports. Variables conn and c already exist.",
  "suspects": ["Name1", "Name2", "Name3", "Name4", "Name5"],
  "culprit": "Name1",
  "clues": ["Clue 1 in ${targetLang}", "Clue 2 in ${targetLang}", "Clue 3 in ${targetLang}"],
  "hints": [
    "Tier 1 hint: which tables are relevant in ${targetLang}",
    "Tier 2 hint: what JOIN or condition to use in ${targetLang}",
    "Tier 3 hint: partial query structure like 'SELECT ... FROM table1 JOIN table2 ON ... WHERE ...'"
  ],
  "conceptTags": ["SELECT", "JOIN", "WHERE"]
}
ALL descriptive text in ${targetLang}. SQL code always in English.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generateMysteryV2: empty response');
    return parseJson(text) as any;
};

export const explainSqlQuery = async (
    query: string,
    schemaDescription: string,
    grade: GradeLevel,
    language: string
): Promise<string> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Explain this SQL query clause-by-clause for a ${grade} student. Schema: ${schemaDescription}
Query: ${query}
Write a plain English explanation (3-6 sentences) covering what each major clause does and what the result would look like. Be encouraging. ALL in ${targetLang}.`;
    return await callClaude({ model: HAIKU, max_tokens: 500, messages: [{ role: 'user', content: prompt }] });
};

export const evaluateSqlEfficiency = async (
    userQuery: string,
    schemaDescription: string,
    language: string
): Promise<{ score: number; optimalQuery: string; explanation: string }> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Evaluate the efficiency of this SQL query against the schema: ${schemaDescription}
User query: ${userQuery}
Return ONLY a JSON object (no markdown):
{
  "score": 75,
  "optimalQuery": "The most efficient SQL query for this task",
  "explanation": "2-3 sentences comparing user's query to optimal, in ${targetLang}. Be encouraging."
}
Score 0-100: penalize SELECT *, unnecessary subqueries, missing indexes, redundant conditions. ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
    if (!text) return { score: 70, optimalQuery: userQuery, explanation: '' };
    try { return parseJson(text) as any; } catch { return { score: 70, optimalQuery: userQuery, explanation: '' }; }
};

// ─── GAMES v2 ─────────────────────────────────────────────────────────────────

export const generateWordScrambleItems = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<{ word: string; definition: string; etymology: string; mode: 'unscramble' | 'fill-blank' | 'anagram' }[]> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Generate 10 vocabulary word quiz items for a ${grade} student studying ${subject}.
Each item has a word, definition, etymology note, and a rotation through 3 modes.
Return ONLY a JSON array (no markdown):
[
  { "word": "photosynthesis", "definition": "Process plants use to make food from sunlight", "etymology": "Greek: photo=light, synthesis=putting together", "mode": "unscramble" },
  { "word": "mitosis", "definition": "Cell division producing identical cells", "etymology": "Greek: mitos=thread", "mode": "fill-blank" },
  { "word": "ecosystem", "definition": "All living and non-living things in an area", "etymology": "Greek: oikos=house, systema=system", "mode": "anagram" }
]
Rotate modes evenly. ALL text (except the word itself) in ${targetLang}. Pick grade-appropriate vocabulary.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });
    if (!text) return [];
    try { return parseJson(text); } catch { return []; }
};

export const generateFlashcards = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<FlashCard[]> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Generate 15 flashcards for ${subject} at ${grade} level.
Return ONLY a JSON array (no markdown):
[{ "front": "Term or concept in ${targetLang}", "back": "Clear definition in ${targetLang}" }]
Use grade-appropriate vocabulary. ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });
    if (!text) return [];
    try { return parseJson(text) as FlashCard[]; } catch { return []; }
};

export const generateTrueFalseItems = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<TrueFalseItem[]> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Generate 20 true/false statements about ${subject} for a ${grade} student. Mix of true and false (roughly half each).
Return ONLY a JSON array (no markdown):
[{ "statement": "Statement in ${targetLang}", "isTrue": true, "explanation": "Brief explanation in ${targetLang} (1 sentence)" }]
ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] });
    if (!text) return [];
    try { return parseJson(text) as TrueFalseItem[]; } catch { return []; }
};

export const generateConceptMap = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<{ nodes: ConceptNode[]; idealEdges: ConceptEdge[] }> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Generate a concept map for ${subject} at ${grade} level with exactly 8 concepts and their relationships.
Return ONLY a JSON object (no markdown):
{
  "nodes": [
    { "id": "1", "label": "Concept name in ${targetLang}" },
    ... (8 nodes total)
  ],
  "idealEdges": [
    { "fromId": "1", "toId": "2", "relationship": "causes" },
    ... (at least 6 edges, using: causes/requires/opposes/is-type-of/contributes)
  ]
}
ALL node labels in ${targetLang}. Relationships always in English (causes/requires/opposes/is-type-of/contributes).`;
    const text = await callClaude({ model: HAIKU, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
    if (!text) return { nodes: [], idealEdges: [] };
    try { return parseJson(text) as any; } catch { return { nodes: [], idealEdges: [] }; }
};

export const evaluateConceptConnections = async (
    nodes: ConceptNode[],
    userEdges: (ConceptEdge & { justification: string })[],
    idealEdges: ConceptEdge[],
    language: string
): Promise<{ edgeScores: { fromId: string; toId: string; score: number; feedback: string }[]; totalScore: number }> => {
    const targetLang = LANG_MAP[language] || language;
    const nodesDesc = nodes.map(n => `${n.id}: ${n.label}`).join(', ');
    const userDesc = userEdges.map(e => `${e.fromId}→${e.toId} [${e.relationship}]: "${e.justification}"`).join('\n');
    const idealDesc = idealEdges.map(e => `${e.fromId}→${e.toId} [${e.relationship}]`).join(', ');

    const prompt = `Evaluate student's concept connections for ${nodesDesc}.
Ideal connections: ${idealDesc}
Student's connections:\n${userDesc}

Return ONLY a JSON object (no markdown):
{
  "edgeScores": [
    { "fromId": "1", "toId": "2", "score": 8, "feedback": "Correct connection. ${targetLang}" }
  ],
  "totalScore": 75
}
Score each edge 0-10: is relationship correct? Is justification valid? totalScore is 0-100. ALL feedback in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
    if (!text) return { edgeScores: [], totalScore: 0 };
    try { return parseJson(text) as any; } catch { return { edgeScores: [], totalScore: 0 }; }
};

export const generatePictureThisQuestions = async (
    subject: Subject,
    grade: GradeLevel,
    language: string
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }[]> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Generate 15 "Picture This" quiz questions for ${subject} at ${grade} level.
Each question describes a concept visually and has 4 text-based option descriptions.
Return ONLY a JSON array (no markdown):
[{
  "question": "Which of these best describes photosynthesis?",
  "options": ["A process that breaks down food", "A process that uses sunlight to make food", "A process that pumps water", "A process that makes seeds"],
  "correctIndex": 1,
  "explanation": "Brief explanation in ${targetLang}"
}]
Use descriptive, visual language. Make wrong options plausible. ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] });
    if (!text) return [];
    try { return parseJson(text) as any[]; } catch { return []; }
};

// ─── PRESENTATION GENERATOR v2 ────────────────────────────────────────────────

export const generatePresentationV2 = async (
    topic: string,
    subject: Subject,
    grade: GradeLevel,
    slideCount: number,
    audience: PresentationAudience,
    structure: PresStructure,
    includes: { toc: boolean; summary: boolean; qa: boolean; references: boolean },
    language: string
): Promise<Presentation> => {
    const targetLang = LANG_MAP[language] || language;
    const audienceDesc = { class: 'classmates', teacher: 'a teacher', parents: 'parents', competition: 'a competition panel' }[audience];
    const structureDesc = { informative: 'informative/educational', persuasive: 'persuasive/argumentative', 'how-to': 'step-by-step how-to guide', 'compare-contrast': 'compare and contrast', timeline: 'chronological timeline' }[structure];
    const extras: string[] = [];
    if (includes.toc) extras.push('table of contents slide');
    if (includes.summary) extras.push('summary slide');
    if (includes.qa) extras.push('Q&A slide');
    if (includes.references) extras.push('references slide');

    const totalSlides = slideCount + (extras.length > 0 ? extras.length : 0);

    const prompt = `You are a professional presentation designer and educator. Generate a complete presentation as JSON.

CRITICAL: You MUST generate EXACTLY ${slideCount} slides. The slides array must contain exactly ${slideCount} items. Count before responding. Wrong slide count breaks the app.

Return ONLY valid JSON in this exact structure:
{
  "title": "presentation title",
  "slides": [...],
  "theme": {
    "bgHex": "E0F2FE",
    "textHex": "0C4A6E",
    "accentHex": "0284C7",
    "darkHex": "075985"
  }
}

THEME RULES:
- Pick colors that visually match the mood and subject of this specific topic
- bgHex: light soft pastel background — NOT white, NOT dark, must be readable with dark text
- textHex: dark version of same color family for headings and body text
- accentHex: vivid saturated version for decorations and highlights
- darkHex: deeper version of accentHex
- All 4 colors must belong to the same color family
- No # prefix, all exactly 6 hex characters

Theme examples by topic:
- Rosa Parks / civil rights / history → FDE8E8 / 7F1D1D / EF4444 / B91C1C
- Ocean / marine / water → E0F2FE / 0C4A6E / 0284C7 / 075985
- Space / astronomy / universe → EEF2FF / 1E1B4B / 4F46E5 / 3730A3
- Ancient Egypt / archaeology → FEF3C7 / 78350F / D97706 / B45309
- Nature / ecology / plants → D1FAE5 / 064E3B / 059669 / 047857
- Music / jazz / art → FAE8FF / 500724 / A21CAF / 86198F
- Technology / coding / AI → F0F9FF / 0C4A6E / 0369A1 / 075985
- Math / equations → DBEAFE / 1E3A5F / 1D4ED8 / 1E40AF
- Health / medicine / biology → CCFBF1 / 042F2E / 0D9488 / 0F766E
- Business / economy / finance → D1FAE5 / 022C22 / 065F46 / 047857

CONTENT RULES — this is the most important part:

Every slide must feel like a mini-lesson, not a bullet list summary.
Write like an expert who knows this topic deeply and wants to teach it properly.

BULLETS:
- Every bullet must be 15-25 words — a full, informative sentence with real substance
- Never write a fragment like "Important impact on society" — always explain the what, why, or how
- Each bullet must contain a specific fact, date, number, name, or concrete detail
- Bad: "Rosa Parks refused to give up her seat"
- Good: "On December 1, 1955, Rosa Parks refused to give her bus seat to a white passenger, triggering a 381-day boycott that crippled Montgomery's transit system financially."
- Aim for 5-6 bullets per content slide, each one teaching something new and specific

BODY FIELD:
- For content slides: write 2-3 sentences of context or background that sets up the bullets
- For title slides: write a compelling hook sentence that makes the audience want to keep watching
- For quote slides: the full quote, not truncated

SPEAKER NOTES:
- Write 5-6 sentences of actual talking points an educator would say out loud
- Include anecdotes, surprising facts, questions to ask the audience, or transitions to the next slide
- These should feel like a real teacher's script, not a summary of the bullets

SLIDE STRUCTURE for ${slideCount} slides:
- Slide 1: title layout — bold hook subtitle, first bullet is a surprising or counterintuitive fact
- Slides 2 to ${slideCount - 2}: content or split layouts — go deep on each subtopic, one idea per slide
- Slide ${slideCount - 1}: real-world case study with specific names, dates, and outcomes
- Slide ${slideCount}: 3 specific actionable takeaways written as full sentences with concrete next steps

DEPTH REQUIREMENT:
Each slide should contain enough information that someone could learn something genuinely new from it.
Do not write generic overview content. Write specific, detailed, educational content.
If the topic is "Rosa Parks", don't just say she was brave — explain the NAACP strategy, the specific laws, the economic impact, the names of other people involved.
If the topic is "Photosynthesis", don't just say plants use sunlight — explain the light-dependent reactions, the Calvin cycle, the specific molecules involved.

LAYOUT RULES:
- layout "title": only slide 1
- layout "quote": any slide built around a single powerful statement or famous quote
- layout "split": any slide with a visual example, comparison, or case study
- layout "content": everything else

- imageKeyword: for split slides, write a specific 2-4 word search term that would find a great editorial or documentary photo. Be specific: not "history" → use "civil rights march 1960s", not "science" → use "DNA double helix microscope", not "person" → use "Rosa Parks portrait", not "nature" → use "Amazon rainforest aerial". The imageKeyword directly determines photo quality — make it count.

${includes.toc ? `Include a Table of Contents slide (counted within the ${slideCount} total).` : ''}
${includes.summary ? `Include a Summary slide (counted within the ${slideCount} total).` : ''}
${includes.qa ? `Include a Q&A slide (counted within the ${slideCount} total).` : ''}
${includes.references ? `Include a References slide with 3–5 real citations (counted within the ${slideCount} total).` : ''}

Presentation topic: "${topic}"
Audience: ${audienceDesc}
Grade level: ${grade}
Language: ${targetLang}
Structure: ${structureDesc}

Each slide object:
{
  "slideNumber": 1,
  "layout": "title" | "content" | "quote" | "split",
  "title": "slide title",
  "bullets": ["complete sentence..."],
  "body": "subtitle or quote text",
  "speakerNotes": "talking points...",
  "imageKeyword": "specific search term"
}

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 12000, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generatePresentationV2: empty response');
    const result = parseJson(text) as Presentation & { theme?: any };
    // Enforce slide count
    result.slides = result.slides.slice(0, slideCount);
    result.totalSlides = result.slides.length;
    result.slides = result.slides.map((s, i) => ({ ...s, slideNumber: i + 1 }));
    return result;
};

export const regenerateSlide = async (
    slide: PresentationSlide,
    topic: string,
    subject: Subject,
    audience: string,
    structure: string,
    grade: GradeLevel,
    language: string
): Promise<PresentationSlide> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Rewrite this presentation slide about "${topic}" (${subject}, ${structure} structure, for ${audience}, ${grade} level).
Current slide: ${JSON.stringify(slide)}
Return ONLY a JSON object with the same structure as the input slide but with fresh content. ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
    if (!text) return slide;
    try { return parseJson(text) as PresentationSlide; } catch { return slide; }
};

export const adjustSlideComplexity = async (
    slide: PresentationSlide,
    direction: 'simpler' | 'detailed',
    grade: GradeLevel,
    language: string
): Promise<PresentationSlide> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Make this presentation slide ${direction === 'simpler' ? 'simpler and more accessible' : 'more detailed and comprehensive'} for a ${grade} student.
Current slide: ${JSON.stringify(slide)}
Return ONLY a JSON object with the same structure but ${direction === 'simpler' ? 'shorter bullets, simpler vocabulary' : 'more bullets, deeper explanations, more detail'}. ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
    if (!text) return slide;
    try { return parseJson(text) as PresentationSlide; } catch { return slide; }
};

export const addSlideBetween = async (
    prevSlide: PresentationSlide,
    nextSlide: PresentationSlide,
    topic: string,
    grade: GradeLevel,
    language: string
): Promise<PresentationSlide> => {
    const targetLang = LANG_MAP[language] || language;
    const prompt = `Create a new presentation slide that logically fits between these two slides about "${topic}" for a ${grade} student.
Previous slide: "${prevSlide.title}" — ${prevSlide.bullets.join(', ')}
Next slide: "${nextSlide.title}" — ${nextSlide.bullets.join(', ')}
Return ONLY a JSON object:
{
  "slideNumber": ${prevSlide.slideNumber + 1},
  "title": "Bridge slide title in ${targetLang}",
  "layout": "content",
  "bullets": ["3-4 bullet points in ${targetLang}"],
  "body": "",
  "imageKeyword": "keyword",
  "speakerNotes": "Speaker notes in ${targetLang}"
}
ALL text in ${targetLang}.`;
    const text = await callClaude({ model: HAIKU, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('addSlideBetween: empty response');
    return parseJson(text) as PresentationSlide;
};
