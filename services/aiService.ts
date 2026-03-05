
import { Message, Attachment, GradeLevel, Exercise, QuestionType, Lesson, AnswerEvaluation, UploadAnalysis, Subject, CodeLanguage, GameType, Presentation, PresentationSlide, CodingChallenge, GameQuestion, BuggyCode, DebateTurn, StoryChapter, StoryEvaluation, MysteryCase, ChallengeTestResult, CodeReview, ArgumentScore, BranchChoice, InlineSuggestion, CaseTheme, CaseDifficulty, PresentationAudience, PresStructure, ConceptNode, ConceptEdge, FlashCard, TrueFalseItem } from '../types';
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

    const prompt = `Create a ${slideCount}-slide ${structureDesc} presentation about "${topic}" for a ${grade} student presenting to ${audienceDesc}.
${extras.length > 0 ? `Also include: ${extras.join(', ')}.` : ''}
Total slides: ${totalSlides}
Return ONLY a JSON object (no markdown):
{
  "title": "Presentation title in ${targetLang}",
  "subject": "${subject}",
  "totalSlides": ${totalSlides},
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title in ${targetLang}",
      "layout": "title",
      "bullets": ["Point 1 in ${targetLang}", "Point 2 in ${targetLang}"],
      "body": "Optional body text in ${targetLang}",
      "imageKeyword": "keyword for image search",
      "speakerNotes": "Speaker notes in ${targetLang}"
    }
  ]
}
Layouts: "title" for first slide, "content" for most slides, "split" when an image would help.
Make it ${audience}-appropriate in tone and complexity. ALL text in ${targetLang}.`;

    const text = await callClaude({ model: HAIKU, max_tokens: 6000, messages: [{ role: 'user', content: prompt }] });
    if (!text) throw new Error('generatePresentationV2: empty response');
    return parseJson(text) as Presentation;
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
