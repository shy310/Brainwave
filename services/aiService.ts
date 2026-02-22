
import { Message, Attachment, GradeLevel, Exercise, QuestionType, Lesson, AnswerEvaluation, UploadAnalysis, Subject, CodeLanguage, GameType, Presentation, CodingChallenge, GameQuestion, BuggyCode, DebateTurn, StoryChapter, StoryEvaluation, MysteryCase } from '../types';
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
    if (attachments?.length) attachments.forEach(att => content.push(contentBlock(att)));
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
        if (attachments?.length) attachments.forEach(att => content.push(contentBlock(att)));
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
    };

    const prompt = `Create a coding challenge in ${langNames[codeLanguage]} for a ${grade} student. Difficulty: ${difficulty}.
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
