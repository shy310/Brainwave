// ─── PERSONAL ERROR QUESTS ────────────────────────────────────────────────────
// Detects recurring mistake patterns from the mastery engine and turns them
// into short, encouraging repair missions. Deterministic: detection, metadata,
// validation and follow-up scheduling live here; only the stage CONTENT is
// AI-written (and validated before display).

import {
  SkillMap, SkillRecord, MistakeKind, ErrorQuest, CompletedQuest, QuestStage,
  Language, SkillStatus,
} from '../types';
import { dominantMistake, computeStatus, REVIEW_INTERVALS } from './masteryEngine';

// A mistake pattern must appear at least this often before it earns a quest —
// one slip is noise, a repeat is a pattern worth repairing.
export const MIN_MISTAKES_FOR_QUEST = 2;
// Days before the same skill+mistake can spawn another quest.
export const QUEST_COOLDOWN_DAYS = 5;
// Days until the repaired skill returns for a spaced follow-up check.
export const FOLLOW_UP_DAYS = 3;
export const MAX_ACTIVE_QUESTS = 3;

const DAY_MS = 86_400_000;

// ─── LOCALIZED, ENCOURAGING COPY ─────────────────────────────────────────────
// Titles are adventurous; reasons follow the "you're nearly there — let's
// repair one pattern" framing. Never "you keep failing".

type QLang = 'en' | 'ru' | 'he' | 'ar';

const TITLES: Record<QLang, Record<MistakeKind, string>> = {
  en: {
    sign: 'The Sign Detective', magnitude: 'The Decimal Point Expedition', arithmetic: 'The Precision Workshop',
    units: 'The Unit Inspector', concept: 'The Idea Untangler', incomplete: 'The Completionist Run',
    recall: 'The Memory Rebuilder', other: 'The Pattern Repair Shop',
  },
  ru: {
    sign: 'Детектив знаков', magnitude: 'Экспедиция к запятой', arithmetic: 'Мастерская точности',
    units: 'Инспектор единиц', concept: 'Распутыватель идей', incomplete: 'Миссия «Всё до конца»',
    recall: 'Восстановитель памяти', other: 'Мастерская шаблонов',
  },
  he: {
    sign: 'בלש הסימנים', magnitude: 'משלחת הנקודה העשרונית', arithmetic: 'סדנת הדיוק',
    units: 'פקח היחידות', concept: 'מתיר הרעיונות', incomplete: 'מסע ההשלמה',
    recall: 'משקם הזיכרון', other: 'סדנת התיקונים',
  },
  ar: {
    sign: 'محقق الإشارات', magnitude: 'بعثة الفاصلة العشرية', arithmetic: 'ورشة الدقة',
    units: 'مفتش الوحدات', concept: 'مفكك الأفكار', incomplete: 'مهمة الإكمال',
    recall: 'مرمم الذاكرة', other: 'ورشة إصلاح الأنماط',
  },
};

const MISTAKE_LABEL: Record<QLang, Record<MistakeKind, string>> = {
  en: {
    sign: 'a sign slips now and then', magnitude: 'the decimal point wanders', arithmetic: 'small calculation slips sneak in',
    units: 'units sometimes go missing', concept: 'two ideas keep swapping places', incomplete: 'answers stop one step early',
    recall: 'a fact keeps hiding', other: 'one small pattern keeps appearing',
  },
  ru: {
    sign: 'иногда теряется знак', magnitude: 'запятая гуляет не там', arithmetic: 'вкрадываются мелкие ошибки счёта',
    units: 'теряются единицы измерения', concept: 'две идеи меняются местами', incomplete: 'ответ останавливается на шаг раньше',
    recall: 'один факт всё время прячется', other: 'повторяется одна маленькая ошибка',
  },
  he: {
    sign: 'סימן מתחלף מדי פעם', magnitude: 'הנקודה העשרונית נודדת', arithmetic: 'טעויות חישוב קטנות מתגנבות',
    units: 'היחידות הולכות לאיבוד', concept: 'שני רעיונות מתחלפים', incomplete: 'התשובה נעצרת צעד אחד מוקדם',
    recall: 'עובדה אחת ממשיכה להתחבא', other: 'דפוס קטן אחד חוזר',
  },
  ar: {
    sign: 'تنقلب الإشارة أحياناً', magnitude: 'الفاصلة العشرية تتجول', arithmetic: 'تتسلل أخطاء حسابية صغيرة',
    units: 'تضيع الوحدات أحياناً', concept: 'فكرتان تتبادلان المكان', incomplete: 'الإجابة تتوقف قبل خطوة',
    recall: 'معلومة تظل مختبئة', other: 'نمط صغير واحد يتكرر',
  },
};

const REASON_TEMPLATE: Record<QLang, (skill: string, mistake: string) => string> = {
  en: (skill, mistake) => `You've nearly mastered ${skill} — let's repair one pattern that keeps appearing: ${mistake}. A few minutes now makes it stick for good.`,
  ru: (skill, mistake) => `Ты почти освоил ${skill} — давай починим один повторяющийся момент: ${mistake}. Несколько минут сейчас закрепят навык надолго.`,
  he: (skill, mistake) => `כמעט שלטת ב-${skill} — בוא נתקן דפוס אחד שחוזר: ${mistake}. כמה דקות עכשיו יקבעו את זה לתמיד.`,
  ar: (skill, mistake) => `أوشكت على إتقان ${skill} — لنُصلح نمطاً واحداً يتكرر: ${mistake}. دقائق قليلة الآن تثبّته للأبد.`,
};

const BADGES: Record<MistakeKind, string> = {
  sign: '🧭', magnitude: '🔬', arithmetic: '⚙️', units: '📏',
  concept: '🧩', incomplete: '🗝️', recall: '🌱', other: '🔧',
};

export const questLang = (l: string): QLang => (['en', 'ru', 'he', 'ar'].includes(l) ? l as QLang : 'en');

// ─── DETECTION ────────────────────────────────────────────────────────────────

export interface QuestCandidate {
  skillTag: string;
  record: SkillRecord;
  mistakeKind: MistakeKind;
  mistakeCount: number;
}

/**
 * Find skills whose recurring mistake pattern deserves a repair quest.
 * Skips skills already covered by an active quest and skill+mistake pairs
 * completed within the cooldown window. Strongest patterns first.
 */
export const findQuestCandidates = (
  map: SkillMap,
  activeQuests: ErrorQuest[] = [],
  completed: CompletedQuest[] = [],
  now: Date = new Date()
): QuestCandidate[] => {
  const activeKeys = new Set(activeQuests.filter(q => !q.completedAt).map(q => `${q.skillTag}::${q.mistakeKind}`));
  const cooled = new Set(
    completed
      .filter(c => now.getTime() - new Date(c.completedAt).getTime() < QUEST_COOLDOWN_DAYS * DAY_MS)
      .map(c => `${c.skillTag}::${c.mistakeKind}`)
  );

  const out: QuestCandidate[] = [];
  for (const r of Object.values(map)) {
    const kind = dominantMistake(r);
    if (!kind) continue;
    const count = r.mistakeCounts[kind] ?? 0;
    if (count < MIN_MISTAKES_FOR_QUEST) continue;
    const key = `${r.skillTag}::${kind}`;
    if (activeKeys.has(key) || cooled.has(key)) continue;
    // Fully mastered skills with old mistakes don't need repair missions.
    const status: SkillStatus = computeStatus(r, now);
    if (status === 'mastered') continue;
    out.push({ skillTag: r.skillTag, record: r, mistakeKind: kind, mistakeCount: count });
  }
  return out.sort((a, b) => (b.mistakeCount - a.mistakeCount) ||
    (new Date(b.record.lastPracticed).getTime() - new Date(a.record.lastPracticed).getTime()));
};

// ─── QUEST CREATION (metadata; stages are AI-generated later) ────────────────

export const buildQuest = (cand: QuestCandidate, language: Language): ErrorQuest => {
  const lang = questLang(language);
  const skillName = cand.skillTag;
  // Struggling students get a gentler quest; stronger ones a firmer one.
  const difficulty = cand.record.masteryScore >= 60 ? 3 : 2;
  return {
    id: `quest-${cand.skillTag.replace(/\W+/g, '-')}-${cand.mistakeKind}-${Date.now()}`,
    skillTag: cand.skillTag,
    subject: cand.record.subject,
    topicId: cand.record.topicId,
    mistakeKind: cand.mistakeKind,
    title: TITLES[lang][cand.mistakeKind],
    reason: REASON_TEMPLATE[lang](skillName, MISTAKE_LABEL[lang][cand.mistakeKind]),
    estimatedMinutes: 5,
    difficulty,
    xpReward: 40 + difficulty * 10,
    badgeReward: BADGES[cand.mistakeKind],
    stages: [],
    createdAt: new Date().toISOString(),
    language,
    stageIndex: 0,
    correctInQuest: 0,
  };
};

// ─── STAGE VALIDATION (AI output gate — like questionValidator for quests) ───

const INTERACTIVE: Set<string> = new Set(['spot-mistake', 'guided-fix', 'independent', 'challenge', 'reflection']);
const BANNED_PHRASES = /you keep failing|you failed|you always get this wrong|stop making|你总是/i;

export const validateQuestStages = (stages: QuestStage[]): { ok: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  if (!Array.isArray(stages) || stages.length < 3 || stages.length > 7) {
    reasons.push(`quest needs 3-7 stages (got ${Array.isArray(stages) ? stages.length : 0})`);
    return { ok: false, reasons };
  }
  stages.forEach((st, i) => {
    if (!st.heading?.trim()) reasons.push(`stage ${i + 1} missing heading`);
    if (!st.body?.trim() && !st.question?.trim()) reasons.push(`stage ${i + 1} has no content`);
    if (BANNED_PHRASES.test(`${st.heading} ${st.body}`)) reasons.push(`stage ${i + 1} uses punitive wording`);
    if (INTERACTIVE.has(st.type)) {
      if (!st.question?.trim()) reasons.push(`stage ${i + 1} (${st.type}) missing question`);
      const opts = st.options ?? [];
      if (opts.length < 2) reasons.push(`stage ${i + 1} needs at least 2 options`);
      if (new Set(opts.map(o => o.trim().toLowerCase())).size !== opts.length) reasons.push(`stage ${i + 1} has duplicate options`);
      if (st.correctIndex === undefined || st.correctIndex < 0 || st.correctIndex >= opts.length) {
        reasons.push(`stage ${i + 1} correctIndex out of range`);
      }
      if (!st.explanation?.trim()) reasons.push(`stage ${i + 1} missing explanation`);
    }
  });
  // The quest must actually practice something
  if (!stages.some(st => INTERACTIVE.has(st.type))) reasons.push('quest has no interactive stages');
  return { ok: reasons.length === 0, reasons };
};

// ─── COMPLETION + SPACED FOLLOW-UP ───────────────────────────────────────────

/**
 * After a quest, the skill must come back later to prove the repair lasted:
 * pin its next spaced review a few days out (never longer), regardless of the
 * review credit earned by in-quest correct answers.
 */
export const scheduleQuestFollowUp = (map: SkillMap, skillTag: string, now: Date = new Date()): SkillMap => {
  const tag = skillTag.trim().toLowerCase();
  const r = map[tag];
  if (!r) return map;
  const due = new Date(now.getTime() + FOLLOW_UP_DAYS * DAY_MS).toISOString();
  const current = r.reviewDue ? new Date(r.reviewDue).getTime() : Infinity;
  if (current <= new Date(due).getTime()) return map; // already sooner
  return {
    ...map,
    [tag]: { ...r, reviewDue: due, reviewIntervalDays: Math.min(r.reviewIntervalDays || FOLLOW_UP_DAYS, FOLLOW_UP_DAYS) },
  };
};

/** Bookkeeping after finishing a quest (cap the history we keep). */
export const recordQuestCompletion = (
  completed: CompletedQuest[],
  quest: ErrorQuest,
  now: Date = new Date()
): CompletedQuest[] =>
  [...completed, { id: quest.id, skillTag: quest.skillTag, mistakeKind: quest.mistakeKind, completedAt: now.toISOString() }]
    .slice(-20);
