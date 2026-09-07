import React, { useEffect, useState } from "react";
import type { Language, UserProfile } from "../types";
import type { StudyLibrary } from "../services/studyTypes";
import { studyCopy } from "../services/studyCopy";
import { loadLibrary } from "../services/studyStore";
import { dueForReview, computeStatus } from "../services/masteryEngine";
import { ArrowRight, Sprout } from "lucide-react";

export default function StudyProgress({
  user,
  language,
  onPractice,
}: {
  user: UserProfile;
  language: Language;
  onPractice: () => void;
}) {
  const c = studyCopy(language);
  const [library, setLibrary] = useState<StudyLibrary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadLibrary(user.id)
      .then((value) => {
        if (alive) setLibrary(value);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [user.id]);
  const records = Object.values(user.skillMap ?? {}).sort((a, b) =>
    b.lastPracticed.localeCompare(a.lastPracticed),
  );
  const due = dueForReview(user.skillMap ?? {});
  const independent = library?.sprints
    .flatMap((s) => s.results)
    .filter(
      (r) => r.kind === "question" && r.correct && !r.hintsUsed && !r.revealed,
    ).length;
  return (
    <section className="bw-hub bw-study-progress">
      <p className="bw-eyebrow">{c.progress}</p>
      <h1>{c.evidence}</h1>
      <p className="bw-muted">{c.evidenceHelp}</p>
      {error && (
        <p role="alert" className="bw-error">
          {c.storageError}
        </p>
      )}
      <div className="bw-progress-metrics">
        {[
          [c.completed, library?.sprints.filter((s) => s.completedAt).length],
          [c.independent, independent],
          [c.due, due.length],
        ].map(([label, value]) => (
          <div className="bw-panel" key={label}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      <section className="bw-panel">
        <div className="bw-section-heading">
          <h2>{c.skills}</h2>
          <Sprout size={22} />
        </div>
        {records.length ? (
          records.slice(0, 8).map((r) => (
            <div className="bw-skill-row" key={r.skillTag}>
              <div>
                <strong>{r.skillTag}</strong>
                <small>
                  {r.successDays.length} · {c.independentDays}
                </small>
              </div>
              <span className="bw-tag">
                {computeStatus(r) === "needs_review"
                  ? c.due
                  : computeStatus(r) === "mastered" ||
                      computeStatus(r) === "secure"
                    ? c.improved
                    : c.practice}
              </span>
              {r.reviewDue && (
                <time dateTime={r.reviewDue}>
                  {new Date(r.reviewDue).toLocaleDateString(language)}
                </time>
              )}
            </div>
          ))
        ) : (
          <p className="bw-muted">{c.keepGoing}</p>
        )}
        <button className="bw-text-button" onClick={onPractice}>
          {c.practice}
          <ArrowRight size={17} />
        </button>
      </section>
    </section>
  );
}
