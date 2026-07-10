import { parseAnswer, answersEquivalent, checkAnswer, looksNumeric, evaluateExpression } from '../services/mathEngine';
import { validateExercise, sanitizeQuiz } from '../services/questionValidator';
import { QuestionType } from '../types';

let pass = 0, fail = 0;
const t = (label: string, got: any, want: any = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) console.log(`FAIL: ${label} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  else console.log(`PASS: ${label}`);
  ok ? pass++ : fail++;
};
const eq = (e: string, g: string, opts?: any) => answersEquivalent(e, g, opts).equivalent;

// ── Correct answers: equivalences ─────────────────────────────────────────────
t('0.5 == 1/2', eq('0.5', '1/2'));
t('0.5 == 50%', eq('0.5', '50%'));
t('1/2 == 50%', eq('1/2', '50%'));
t('2/4 == 1/2 (fraction simplification)', eq('1/2', '2/4'));
t('mixed number 1 1/2 == 1.5', eq('1.5', '1 1/2'));
t('ratio 3:4 == 0.75', eq('0.75', '3:4'));
t('expression 40-40*0.25 == 30', eq('40 - 40*0.25', '30'));
t('sqrt(16) == 4', eq('4', 'sqrt(16)'));
t('2^3 == 8', eq('8', '2^3'));
t('unicode ² : 3² == 9', eq('9', '3²'));
t('x = 4 == 4 (equation prefix)', eq('4', 'x = 4'));
t('latex \\frac{1}{2} == 0.5', eq('0.5', '\\frac{1}{2}'));
t('$0.5$ latex wrapper', eq('1/2', '$0.5$'));
t('comma decimal 0,5 == 0.5', eq('0.5', '0,5'));
t('thousands 1,234 == 1234', eq('1234', '1,234'));

// ── Incorrect answers ─────────────────────────────────────────────────────────
t('0.5 != 0.6', eq('0.5', '0.6'), false);
t('1/2 != 1/3', eq('1/2', '1/3'), false);
t('50% != 5%', eq('50%', '5%'), false);
t('30 != 25 (discount mistake)', eq('40 - 40*0.25', '25'), false);

// ── Negative values ───────────────────────────────────────────────────────────
t('-3 == -3.0', eq('-3', '-3.0'));
t('-1/2 == -0.5', eq('-0.5', '-1/2'));
t('-3 != 3 (sign matters)', eq('-3', '3'), false);
t('unary minus expr: -(2+3) == -5', eq('-5', '-(2+3)'));

// ── Floating-point tolerance ─────────────────────────────────────────────────
t('0.1+0.2 == 0.3 (float noise absorbed)', eq('0.3', '0.1 + 0.2'));
t('pi approx 3.14 within tolerance 0.01', eq('pi', '3.14', { tolerance: 0.01 }));
t('pi vs 3.14 fails without tolerance', eq('pi', '3.14'), false);
t('explicit tolerance 0.05: 2.03 == 2', eq('2', '2.03', { tolerance: 0.05 }));
t('explicit tolerance 0.05: 2.06 != 2', eq('2', '2.06', { tolerance: 0.05 }), false);

// ── Units ─────────────────────────────────────────────────────────────────────
t('5 cm == 0.05 m (unit conversion)', eq('5 cm', '0.05 m'));
t('5 cm == 50 mm', eq('5 cm', '50 mm'));
t('5 cm != 5 m', eq('5 cm', '5 m'), false);
t('unit required: bare 5 rejected', answersEquivalent('5 cm', '5', { unitRequired: true }).equivalent, false);
t('unit required: reason says missing unit', answersEquivalent('5 cm', '5', { unitRequired: true }).reason, 'Missing unit');
t('unit optional: bare 5 accepted for 5 cm', eq('5 cm', '5'));
t('wrong dimension: 5 cm vs 5 kg', eq('5 cm', '5 kg'), false);

// ── Rounding (only when explicitly requested) ────────────────────────────────
t('roundTo 2: 3.14159 as 3.14', eq('3.14', '3.14159', { roundTo: 2 }));
t('roundTo 0: 7.4 == 7', eq('7', '7.4', { roundTo: 0 }));
t('no rounding: 3.14159 != 3.14', eq('3.14', '3.14159'), false);

// ── Invalid / incomplete / unrelated input ───────────────────────────────────
t('empty answer rejected', parseAnswer('').ok, false);
t('word salad rejected', parseAnswer('banana smoothie').ok, false);
t('incomplete expression 2+ rejected', parseAnswer('2 +').ok, false);
t('division symbol only rejected', parseAnswer('/').ok, false);
t('clear error message present', typeof parseAnswer('2 +').error === 'string' && parseAnswer('2 +').error!.length > 0);
t('code injection blocked: import rejected', parseAnswer('import("fs")').ok, false);
t('assignment blocked', parseAnswer('a = 5; a').ok, false);
t('unknown symbol blocked', parseAnswer('x + 1').ok, false);
t('looksNumeric("1/2")', looksNumeric('1/2'));
t('looksNumeric("hello") false', looksNumeric('hello'), false);
t('evaluateExpression 12*12', evaluateExpression('12*12').value, 144);

// ── checkAnswer wrapper ──────────────────────────────────────────────────────
t('checkAnswer math verdict correct', checkAnswer('30', '40-40*0.25').correct);
t('checkAnswer math verdict incorrect is definitive', checkAnswer('29', '40-40*0.25'), { correct: false, method: 'math', reason: undefined });
t('checkAnswer acceptable alternates', checkAnswer('$30', '30', ['$30', '30 dollars']).correct);
t('checkAnswer text fallback case-insensitive', checkAnswer('  PACIFIC ', 'Pacific').correct);
t('checkAnswer text fallback wrong', checkAnswer('Atlantic', 'Pacific').correct, false);

// ── Validator: multiple-choice option validation ─────────────────────────────
const baseMC = {
  id: 'q1', questionType: QuestionType.MULTIPLE_CHOICE, difficulty: 3,
  question: 'What is 6 × 7?', explanation: 'Six sevens are 42.', hint: 'Skip-count by 7.',
  options: [
    { id: 'a', text: '42' }, { id: 'b', text: '36' }, { id: 'c', text: '48' }, { id: 'd', text: '54' },
  ],
  correctOptionId: 'a', answerExpression: '6*7',
} as any;

t('valid MC passes', validateExercise(baseMC).ok);
t('duplicate options rejected', validateExercise({ ...baseMC, options: [...baseMC.options.slice(0, 3), { id: 'd', text: '42' }] }).ok, false);
t('equivalent duplicate (42.0) rejected', validateExercise({ ...baseMC, options: [...baseMC.options.slice(0, 3), { id: 'd', text: '42.0' }] }).ok, false);
t('accidental 2nd correct (84/2) rejected', validateExercise({ ...baseMC, options: [...baseMC.options.slice(0, 3), { id: 'd', text: '84/2' }] }).ok, false);
t('correctOptionId missing from options rejected', validateExercise({ ...baseMC, correctOptionId: 'z' }).ok, false);
t('AI stored wrong answer caught: marked option 36 but expression says 42',
  validateExercise({ ...baseMC, correctOptionId: 'b' }).ok, false);
t('only 1 option rejected', validateExercise({ ...baseMC, options: [{ id: 'a', text: '42' }] }).ok, false);
t('broken formatting rejected', validateExercise({ ...baseMC, question: 'What is undefined + 7?' }).ok, false);

// ── Validator: true/false ────────────────────────────────────────────────────
const tf = { ...baseMC, questionType: QuestionType.TRUE_FALSE, question: 'Is 7 prime?', answerExpression: undefined,
  options: [{ id: 't', text: 'True' }, { id: 'f', text: 'False' }], correctOptionId: 't' };
t('valid TRUE_FALSE passes', validateExercise(tf).ok);
t('TRUE_FALSE with 3 options rejected', validateExercise({ ...tf, options: [...tf.options, { id: 'x', text: 'Maybe' }] }).ok, false);

// ── Validator: multi-select ──────────────────────────────────────────────────
const ms = { ...baseMC, questionType: QuestionType.MULTI_SELECT, question: 'Select all primes.', answerExpression: undefined,
  correctOptionId: '', correctOptionIds: ['a', 'c'],
  options: [{ id: 'a', text: '2' }, { id: 'b', text: '9' }, { id: 'c', text: '11' }, { id: 'd', text: '15' }] };
t('valid MULTI_SELECT passes', validateExercise(ms).ok);
t('MULTI_SELECT no correct ids rejected', validateExercise({ ...ms, correctOptionIds: [] }).ok, false);
t('MULTI_SELECT all-correct rejected', validateExercise({ ...ms, correctOptionIds: ['a', 'b', 'c', 'd'] }).ok, false);
t('MULTI_SELECT unknown id rejected', validateExercise({ ...ms, correctOptionIds: ['a', 'z'] }).ok, false);

// ── Validator: numeric with wrong stored answer gets FIXED from engine ───────
const num = { id: 'n1', questionType: QuestionType.NUMERIC, difficulty: 2,
  question: 'A shirt costs $40 with 25% off. Sale price?', explanation: '25% of 40 is 10; 40-10=30.',
  hint: 'Find 25% first.', options: [], sampleAnswer: '35', answerExpression: '40 - 40*0.25' } as any;
const numRes = validateExercise(num);
t('numeric wrong stored answer: still ok (repaired)', numRes.ok);
t('numeric stored answer replaced with verified 30', numRes.exercise.sampleAnswer, '30');
t('numeric missing any answer rejected', validateExercise({ ...num, sampleAnswer: '', answerExpression: undefined }).ok, false);
t('numeric bad expression rejected', validateExercise({ ...num, answerExpression: 'forty minus ten' }).ok, false);

// ── Validator: missing answers / open types ──────────────────────────────────
t('short answer without sampleAnswer rejected', validateExercise({
  id: 's1', questionType: QuestionType.SHORT_ANSWER, difficulty: 3, question: 'Explain photosynthesis.',
  explanation: 'Plants convert light to sugar.', hint: 'Think chloroplasts.', options: [], sampleAnswer: '' } as any).ok, false);
t('fill-in-blank without ___ rejected', validateExercise({
  id: 'f1', questionType: QuestionType.FILL_IN_BLANK, difficulty: 2, question: 'The largest ocean is the Pacific.',
  explanation: 'The Pacific is largest.', hint: 'West of the Americas.', options: [], sampleAnswer: 'Pacific' } as any).ok, false);

// ── sanitizeQuiz: discards invalid + duplicates ──────────────────────────────
const quiz = sanitizeQuiz([
  baseMC,
  { ...baseMC, id: 'q2' },                                   // exact duplicate question
  { ...baseMC, id: 'q3', correctOptionId: 'z' },             // invalid
  { ...tf, id: 'q4' },
]);
t('sanitizeQuiz keeps only unique valid questions', quiz.valid.length, 2);
t('sanitizeQuiz reports discards with reasons', quiz.discarded.length, 2);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
