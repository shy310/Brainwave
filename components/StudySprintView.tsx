import React, { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Lightbulb,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Language, Message, QuestionType, UserProfile } from "../types";
import type {
  ActivityResult,
  StudySet,
  StudySprint,
} from "../services/studyTypes";
import { studyCopy } from "../services/studyCopy";
import { addResult, isYoung, sprintSummary } from "../services/studyEngine";
import { coachAnswer, sourceText } from "../services/studyAI";
import { checkAnswer } from "../services/mathEngine";
import MathText from "./MathText";
import StudyTutor from "./StudyTutor";

export default function StudySprintView({
  set,
  sprint,
  user,
  language,
  onChange,
  onLeave,
}: {
  set: StudySet;
  sprint: StudySprint;
  user: UserProfile;
  language: Language;
  onChange: (sprint: StudySprint) => void;
  onLeave: () => void;
}) {
  const c = studyCopy(language);
  const [showSource, setShowSource] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [tutor, showTutor] = useState(false);
  // The first check is followed by a short explanation, then varied practice.
  const sequence = [
    sprint.questionIds[0],
    "learn",
    ...sprint.questionIds.slice(1),
    "teach",
  ];
  const activity = sequence[sprint.step];
  const q = set.questions.find((q) => q.id === activity);
  const done = !!sprint.completedAt;
  const result = sprint.results.find((r) => r.activityId === activity);
  const value = sprint.drafts[activity] ?? "";
  const hints = sprint.hints[activity] ?? 0;
  const revealed = !!sprint.reveals[activity];
  const summary = sprintSummary(sprint);
  const label =
    activity === "learn"
      ? c.learn
      : activity === "teach"
        ? c.teach
        : sprint.step === 0
          ? c.warmup
          : sprint.step === sequence.length - 2
            ? c.challenge
            : c.practice;
  function draft(text: string) {
    onChange({ ...sprint, drafts: { ...sprint.drafts, [activity]: text } });
  }
  function help(reveal = false) {
    onChange({
      ...sprint,
      hints: { ...sprint.hints, [activity]: hints + 1 },
      reveals: { ...sprint.reveals, [activity]: revealed || reveal },
    });
  }
  function next() {
    if (sprint.step >= sequence.length - 1)
      onChange({ ...sprint, completedAt: new Date().toISOString() });
    else onChange({ ...sprint, step: sprint.step + 1 });
    setError(false);
  }
  async function submit() {
    if (busy || result || !value.trim()) return;
    setBusy(true);
    setError(false);
    try {
      let correct = false,
        feedback = "";
      if (q?.questionType === QuestionType.MULTIPLE_CHOICE) {
        correct = value === q.correctOptionId;
        feedback = q.explanation;
      } else if (q?.questionType === QuestionType.NUMERIC) {
        correct = checkAnswer(
          value,
          q.answerExpression || q.sampleAnswer || "",
          q.acceptableAnswers,
          { tolerance: q.tolerance, unitRequired: q.unitRequired },
        ).correct;
        feedback = q.explanation;
      } else {
        const response = await coachAnswer(
          q?.question ?? c.teachPrompt,
          value,
          q?.sampleAnswer ?? set.notes,
          sourceText(set.source),
          user.gradeLevel,
          language,
          activity === "teach",
        );
        correct = response.correct;
        feedback = response.feedback;
      }
      const outcome: ActivityResult = {
        id: `${sprint.id}:${activity}`,
        activityId: activity,
        kind: activity === "teach" ? "teach" : "question",
        answer: value,
        correct,
        feedback,
        skillTag: q?.skillTag ?? set.title,
        subject: set.subject,
        questionType: q?.questionType ?? QuestionType.SHORT_ANSWER,
        difficulty: q?.difficulty ?? 1,
        hintsUsed: hints,
        revealed,
        ts: new Date().toISOString(),
      };
      let updated = addResult(sprint, outcome);
      // Insert one distinct same-skill recovery question, without extending indefinitely.
      if (q && !correct && sprint.questionIds.length < 10) {
        const spare = set.questions.find(
          (candidate) =>
            candidate.skillTag === q.skillTag &&
            !sprint.questionIds.includes(candidate.id),
        );
        if (spare) {
          const ids = [...updated.questionIds];
          ids.splice(Math.min(ids.indexOf(q.id) + 1, ids.length), 0, spare.id);
          updated = { ...updated, questionIds: ids };
        }
      }
      onChange(updated);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const context = `${sourceText(set.source)}\nNotes: ${set.notes}\nActivity: ${q?.question ?? label}\nLearner answer: ${value}\nExpected: ${q?.sampleAnswer ?? q?.options.find((o) => o.id === q.correctOptionId)?.text ?? ""}`;
  return (
    <div className={`bw-sprint ${isYoung(user.gradeLevel) ? "bw-young" : ""}`}>
      <div className="bw-section-heading">
        <div>
          <p className="bw-eyebrow">
            {c.sprint} · {sprint.minutes} {c.minutes}
          </p>
          <h1>{set.title}</h1>
        </div>
        <button
          className="bw-button bw-secondary"
          onClick={onLeave}
          disabled={busy}
        >
          {c.pause}
        </button>
      </div>
      {!done && (
        <>
          <div
            className="bw-progress-track"
            role="progressbar"
            aria-label={c.progress}
            aria-valuemin={0}
            aria-valuemax={sequence.length}
            aria-valuenow={sprint.step}
          >
            <span
              style={{ width: `${(100 * sprint.step) / sequence.length}%` }}
            />
          </div>
          <div className="bw-step-strip">
            {sequence.map((id, i) => (
              <button
                key={id}
                disabled={busy}
                aria-current={i === sprint.step ? "step" : undefined}
                aria-label={`${c.activity} ${i + 1}`}
                onClick={() => {
                  onChange({ ...sprint, step: i });
                  setError(false);
                }}
              >
                {i < sprint.step ? <Check size={13} /> : i + 1}
              </button>
            ))}
          </div>
        </>
      )}
      {!done && <button className="bw-text-button bw-mobile-source-toggle" aria-expanded={showSource} onClick={() => setShowSource(!showSource)}><BookOpen size={17}/>{c.source}</button>}
      {done ? (
        <section className="bw-recap bw-panel">
          <span className="bw-recap-icon">
            <Trophy size={34} />
          </span>
          <p className="bw-eyebrow">{c.sprint}</p>
          <h2>{c.recap}</h2>
          <div className="bw-recap-grid">
            <div>
              <h3>{c.improved}</h3>
              <strong>{summary.independent.length}</strong>
              <p>{c.independent}</p>
              {summary.skills.map((s) => (
                <span className="bw-tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
            <div>
              <h3>{c.retry}</h3>
              {summary.retry.length ? (
                [...new Set(summary.retry.map((r) => r.skillTag))].map((s) => (
                  <p key={s}>{s}</p>
                ))
              ) : (
                <p>{c.keepGoing}</p>
              )}
            </div>
          </div>
          <div className="bw-soft">
            <h3>{c.review}</h3>
            <p>{c.reviewHelp}</p>
          </div>
          <button className="bw-button" onClick={onLeave}>
            {c.today}
            <ArrowRight size={18} />
          </button>
        </section>
      ) : (
        <div className={`bw-study-layout ${tutor ? "bw-with-tutor" : ""}`}>
          <aside className={`bw-source-panel bw-panel ${showSource ? 'bw-source-visible' : ''}`}>
            <p className="bw-eyebrow">
              <BookOpen size={16} />
              {c.source}
            </p>
            <h2>{set.source.name}</h2>
            <p className="bw-muted">
              {set.source.kind === "topic" ? c.generated : c.grounded}
            </p>
            {set.source.pages.map((p) => (
              <details key={p.number} open={set.source.pages.length === 1}>
                <summary>
                  {c.page} {p.number}
                </summary>
                <MathText>{p.text}</MathText>
              </details>
            ))}
          </aside>
          <section className="bw-activity bw-panel" aria-busy={busy}>
            <div className="bw-row">
              <span className="bw-tag">{label}</span>
              <span className="bw-muted">
                {sprint.step + 1} / {sequence.length}
              </span>
            </div>
            {activity === "learn" ? (
              <>
                <h2>{c.learn}</h2>
                <MathText>{set.notes}</MathText>
                <p className="bw-muted">{c.readFirst}</p>
              </>
            ) : (
              <>
                <h2>
                  <MathText>{q?.question ?? c.teachPrompt}</MathText>
                </h2>
                {q?.sourcePages.length ? (
                  <p className="bw-muted">
                    {c.page} {q.sourcePages.join(", ")}
                  </p>
                ) : null}
                {q?.questionType === QuestionType.MULTIPLE_CHOICE ? (
                  <div className="bw-answers">
                    {q.options.map((option, i) => (
                      <button
                        key={option.id}
                        disabled={!!result || busy}
                        aria-pressed={value === option.id}
                        onClick={() => draft(option.id)}
                      >
                        <span>{String.fromCharCode(65 + i)}</span>
                        <MathText>{option.text}</MathText>
                      </button>
                    ))}
                  </div>
                ) : (
                  <label className="bw-field">
                    {c.answer}
                    <textarea
                      value={value}
                      disabled={!!result || busy}
                      onChange={(e) => draft(e.target.value)}
                      maxLength={4000}
                    />
                  </label>
                )}
                {hints > 0 && q && !result && (
                  <div className="bw-soft">
                    <Lightbulb size={20} />
                    <MathText>{revealed ? q.explanation : q.hint}</MathText>
                  </div>
                )}
                {result && (
                  <div
                    className={`bw-feedback ${result.correct ? "bw-correct" : ""}`}
                    role="status"
                  >
                    <h3>
                      {result.kind === "teach"
                        ? c.feedbackNote
                        : result.correct
                          ? c.correct
                          : c.notYet}
                    </h3>
                    <MathText>{result.feedback}</MathText>
                    {!result.correct && q && (
                      <p>
                        <MathText>{q.explanation}</MathText>
                      </p>
                    )}
                    {result.kind === "question" &&
                      q?.questionType === QuestionType.SHORT_ANSWER && (
                        <small>{c.feedbackNote}</small>
                      )}
                  </div>
                )}
                {activity === "teach" && (
                  <p className="bw-muted">{c.feedbackNote}</p>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="bw-error">
                {c.error}
              </p>
            )}
            <div className="bw-activity-actions">
              {activity !== "learn" && !result && (
                <button
                  className="bw-button"
                  disabled={busy || !value.trim()}
                  onClick={() => void submit()}
                >
                  {busy ? c.working : c.check}
                  <Check size={18} />
                </button>
              )}
              {(result || activity === "learn") && (
                <button className="bw-button" onClick={next} disabled={busy}>
                  {sprint.step === sequence.length - 1 ? c.finish : c.next}
                  <ArrowRight size={18} />
                </button>
              )}
              {q && !result && (
                <>
                  <button
                    className="bw-button bw-secondary"
                    onClick={() => help()}
                    disabled={busy}
                  >
                    <Lightbulb size={16} />
                    {c.hint}
                  </button>
                  <button
                    className="bw-text-button"
                    onClick={() => help(true)}
                    disabled={busy}
                  >
                    {c.explain}
                  </button>
                </>
              )}
            </div>
            <div className="bw-section-heading">
              <button
                className="bw-text-button"
                onClick={() => {
                  help();
                  showTutor(!tutor);
                }}
              >
                <Sparkles size={16} />
                {c.tutor}
              </button>
              <button className="bw-text-button" disabled={busy} onClick={next}>
                {c.skip}
              </button>
            </div>
          </section>
          {tutor && (
            <StudyTutor
              user={user}
              language={language}
              context={context}
              messages={sprint.messages}
              onMessages={(messages) =>
                onChange({
                  ...sprint,
                  messages,
                  hints: { ...sprint.hints, [activity]: Math.max(1, hints) },
                })
              }
              onBusy={setBusy}
              onClose={() => showTutor(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
