import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  FileText,
  Flame,
  Gamepad2,
  Plus,
  Search,
  Sparkles,
  Sprout,
  Upload,
  X,
} from "lucide-react";
import { Course, Language, Subject, Translations, UserProfile } from "../types";
import type {
  ActivityResult,
  StudyLibrary,
  StudySet,
  StudySource,
  StudySprint,
} from "../services/studyTypes";
import { studyCopy } from "../services/studyCopy";
import {
  createSprint,
  isYoung,
  recommendedSkill,
} from "../services/studyEngine";
import { extractSource, generateStudySet } from "../services/studyAI";
import { legacyNotes, loadLibrary, saveLibrary } from "../services/studyStore";
import StudySprintView from "./StudySprintView";
import MathText from "./MathText";
import StudyTutor from "./StudyTutor";

const Games = lazy(() => import("./EducationalGames"));
const Code = lazy(() => import("./CodeLab"));
const Debate = lazy(() => import("./DebateArena"));
const Story = lazy(() => import("./StoryEngine"));
const Slides = lazy(() => import("./PresentationView"));
const Sql = lazy(() => import("./SqlDetective"));

export function BrainBuddy() {
  return (
    <div className="bw-buddy" aria-hidden="true">
      <span className="bw-orbit bw-orbit-one">✦</span>
      <span className="bw-orbit bw-orbit-two">+</span>
      <div className="bw-buddy-book">
        <div className="bw-buddy-face">
          <i />
          <i />
          <b />
        </div>
        <div className="bw-book-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
      <span className="bw-buddy-shadow" />
      <span className="bw-orbit bw-orbit-three">✧</span>
    </div>
  );
}

function MaterialForm({
  user,
  language,
  initialTopic,
  onDone,
  onClose,
}: {
  user: UserProfile;
  language: Language;
  initialTopic?: string;
  onDone: (set: StudySet) => void;
  onClose: () => void;
}) {
  const c = studyCopy(language);
  const [kind, setKind] = useState<"topic" | "text" | "transcript" | "file">(
    "topic",
  );
  const [title, setTitle] = useState(initialTopic ?? ""),
    [body, setBody] = useState("");
  const [source, setSource] = useState<StudySource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => before?.focus();
  }, []);
  async function extract() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setSource(await extractSource(file));
      setReviewed(false);
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (busy) return;
    if (
      kind !== "file" &&
      (!title.trim() ||
        (kind !== "topic" &&
          (body.trim().length < 30 || /^https?:\/\/\S+$/i.test(body.trim()))))
    ) {
      setError(c.invalidSource);
      return;
    }
    if (
      kind === "file" &&
      (!source || !reviewed || source.pages.some((p) => !p.text.trim()))
    ) {
      setError(c.invalidSource);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const input: StudySource =
        kind === "file"
          ? { ...source!, reviewed }
          : {
              id: crypto.randomUUID(),
              kind,
              name: title.trim(),
              pages: [
                {
                  number: 1,
                  text: kind === "topic" ? title.trim() : body.trim(),
                },
              ],
              reviewed: true,
            };
      onDone(await generateStudySet(input, user, language));
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bw-modal-backdrop">
      <div
        className="bw-modal bw-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-title"
        ref={dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const nodes = [
              ...(dialog.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)",
              ) ?? []),
            ];
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
              e.preventDefault();
              nodes[0]?.focus();
            }
          }
        }}
      >
        <div className="bw-section-heading">
          <h2 id="material-title">{c.add}</h2>
          <button
            disabled={busy}
            className="bw-icon-button"
            aria-label={c.cancel}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="bw-tabs">
          {(["topic", "text", "transcript", "file"] as const).map((k) => (
            <button
              key={k}
              disabled={busy}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setError("");
              }}
            >
              {c[k]}
            </button>
          ))}
        </div>
        {kind === "file" ? (
          <>
            <label className="bw-upload">
              <Upload size={26} />
              <strong>{c.file}</strong>
              <span>PDF ≤ 20 {c.page} · 12 MB · PNG / JPEG / WebP</span>
              <input
                type="file"
                disabled={busy}
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSource(null);
                  setReviewed(false);
                }}
              />
            </label>
            {file && !source && (
              <button
                className="bw-button"
                disabled={busy}
                onClick={() => void extract()}
              >
                {c.extract}
              </button>
            )}
            {source && (
              <>
                <h3>{c.reviewSource}</h3>
                <p>{c.extractionHelp}</p>
                {source.pages.map((p) => (
                  <label className="bw-field" key={p.number}>
                    {c.page} {p.number}
                    <textarea
                      disabled={busy}
                      value={p.text}
                      onChange={(e) => {
                        setSource({
                          ...source,
                          pages: source.pages.map((item) =>
                            item.number === p.number
                              ? { ...item, text: e.target.value }
                              : item,
                          ),
                        });
                        setReviewed(false);
                      }}
                    />
                  </label>
                ))}
                <label className="bw-row">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  {c.reviewSource} ✓
                </label>
              </>
            )}
          </>
        ) : (
          <>
            <label className="bw-field">
              {kind === "topic" ? c.input : c.title}
              <input
                autoComplete="off"
                disabled={busy}
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {kind !== "topic" && (
              <label className="bw-field">
                {c.sourceHelp}
                <textarea
                  disabled={busy}
                  value={body}
                  maxLength={60000}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        {error && (
          <p className="bw-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p className="bw-working" role="status">
            <Sparkles size={18} />
            {c.working}
          </p>
        )}
        <button
          className="bw-button"
          disabled={busy || (kind === "file" && !reviewed)}
          onClick={() => void create()}
        >
          {c.create}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default function StudyHub({
  view,
  user,
  language,
  theme,
  courses,
  translations,
  onNavigate,
  onResults,
  onToolXp,
  onContext,
}: {
  view: "dashboard" | "courses" | "practice";
  user: UserProfile;
  language: Language;
  theme: "light" | "dark";
  courses: Course[];
  translations: Translations;
  onNavigate: (
    view:
      "dashboard" | "courses" | "practice" | "progress" | "mastery" | "dungeon",
  ) => void;
  onResults: (results: ActivityResult[]) => void;
  onToolXp: (xp: number) => void;
  onContext: (context: string) => void;
}) {
  const c = studyCopy(language);
  const [data, setData] = useState<StudyLibrary>({
    version: 1,
    sets: [],
    sprints: [],
    importedLegacyIds: [],
  });
  const [loaded, setLoaded] = useState(false),
    [saveError, setSaveError] = useState(false),
    [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [sprintId, setSprintId] = useState<string | null>(null);
  const [form, setForm] = useState(false),
    [topic, setTopic] = useState(""),
    [tool, setTool] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<5 | 10 | 15>(
    isYoung(user.gradeLevel) ? 5 : 10,
  );
  const [filter, setFilter] = useState(""),
    [tab, setTab] = useState<"notes" | "cards" | "questions">("notes");
  const [materialTutor, setMaterialTutor] = useState(false);
  const [noteDraft, setNoteDraft] = useState(""),
    [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [saving, setSaving] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const current = useRef(data);
  current.current = data;
  const resultCallback = useRef(onResults);
  resultCallback.current = onResults;
  const [legacy] = useState(legacyNotes);
  const [legacyChoice, setLegacyChoice] = useState("");
  useEffect(() => {
    let alive = true;
    loadLibrary(user.id)
      .then((value) => {
        if (alive) {
          current.current = value;
          setData(value);
          setLoaded(true);
          resultCallback.current(value.sprints.flatMap((s) => s.results));
        }
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [user.id]);
  useEffect(() => {
    setSelected(null);
    setSprintId(null);
    setTool(null);
    setForm(false);
  }, [view]);
  function persist(value: StudyLibrary) {
    current.current = value;
    setData(value);
    setSaving(true);
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveLibrary(user.id, value))
      .then(() => {
        resultCallback.current(value.sprints.flatMap((s) => s.results));
        if (current.current === value) {
          setSaveError(false);
          setSaving(false);
        }
      })
      .catch(() => {
        setSaveError(true);
        setSaving(false);
      });
  }
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (saving || saveError) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [saving, saveError]);
  const activeSet = data.sets.find((s) => s.id === selected);
  const activeSprint = data.sprints.find((s) => s.id === sprintId);
  const sprintSet = data.sets.find((s) => s.id === activeSprint?.setId);
  const resumable = data.sprints.find((s) => !s.completedAt);
  const skill = recommendedSkill(user);
  const recommended =
    data.sets.find((s) =>
      s.questions.some((q) => q.skillTag === skill?.skillTag),
    ) ?? (skill ? undefined : data.sets[0]);
  function openSet(set: StudySet) {
    setSelected(set.id);
    setNoteDraft(set.notes);
    setTab("notes");
    setFlipped({});
    onContext(set.notes);
  }
  function start(set: StudySet) {
    if (!set.questions.length) return;
    const session = createSprint(set, minutes, user, current.current.sprints);
    persist({
      ...current.current,
      sprints: [session, ...current.current.sprints],
    });
    setSprintId(session.id);
    setSelected(null);
  }
  function updateSprint(sprint: StudySprint) {
    persist({
      ...current.current,
      sprints: current.current.sprints.map((s) =>
        s.id === sprint.id ? sprint : s,
      ),
    });
  }
  async function regenerate(set: StudySet) {
    setBusy(true);
    setError(false);
    try {
      const fresh = await generateStudySet(
        {
          ...set.source,
          kind: "text",
          reviewed: true,
          pages: [{ number: 1, text: set.notes }],
        },
        user,
        language,
      );
      persist({ ...current.current, sets: [fresh, ...current.current.sets] });
      openSet(fresh);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const tools = {
    games: Games,
    code: Code,
    debate: Debate,
    story: Story,
    slides: Slides,
    sql: Sql,
  };
  const Tool = tool ? tools[tool as keyof typeof tools] : null;
  const storageStatus = (
    <>
      {saveError && (
        <div className="bw-error" role="alert">
          {c.storageError}
          <button onClick={() => persist(current.current)}>
            {c.retrySave}
          </button>
        </div>
      )}
      <span className="bw-save-status" role="status">
        {saving ? c.working : saveError ? "" : c.saved}
      </span>
    </>
  );
  if (loadError)
    return (
      <div className="bw-hub">
        <p role="alert" className="bw-error">
          {c.storageError}
        </p>
        <button className="bw-button" onClick={() => location.reload()}>
          {c.retrySave}
        </button>
      </div>
    );
  if (!loaded)
    return (
      <div className="bw-hub" role="status">
        {c.working}
      </div>
    );
  if (Tool)
    return (
      <div className="bw-hub">
        <Suspense fallback={<p>{c.working}</p>}>
          <Tool
            userGrade={user.gradeLevel}
            language={language}
            translations={translations}
            theme={theme}
            onBack={() => setTool(null)}
            onXpEarned={onToolXp}
            onContextUpdate={onContext}
          />
        </Suspense>
      </div>
    );
  if (activeSprint && sprintSet)
    return (
      <div className="bw-hub">
        {storageStatus}
        <StudySprintView
          key={activeSprint.id}
          sprint={activeSprint}
          set={sprintSet}
          user={user}
          language={language}
          onChange={updateSprint}
          onLeave={() => {
            setSprintId(null);
          }}
        />
      </div>
    );
  const duration = (
    <fieldset className="bw-duration">
      <legend>{c.duration}</legend>
      {([5, 10, 15] as const).map((n) => (
        <button
          key={n}
          aria-pressed={minutes === n}
          onClick={() => setMinutes(n)}
        >
          {n} <span>{c.minutes.split(" · ")[0]}</span>
        </button>
      ))}
    </fieldset>
  );
  const explorer = (
    <section className="bw-section">
      <div className="bw-section-heading">
        <div>
          <h2>{c.explore}</h2>
          <p className="bw-muted">{c.exploreDesc}</p>
        </div>
        <Gamepad2 size={24} />
      </div>
      <div className="bw-tools">
        {(Object.keys(tools) as (keyof typeof tools)[]).map((id, i) => (
          <button className="bw-tool-card" key={id} onClick={() => setTool(id)}>
            <span className={`bw-tool-icon bw-tool-${i}`}>
              {["✦", "⌘", "↗", "✎", "▤", "⌕"][i]}
            </span>
            <strong>{c[id]}</strong>
            <ArrowRight size={17} />
          </button>
        ))}
        <button className="bw-tool-card" onClick={() => onNavigate("dungeon")}>
          <span className="bw-tool-icon">♜</span>
          <strong>{translations.memoryDungeon}</strong>
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
  return (
    <div className="bw-hub">
      {storageStatus}
      {activeSet ? (
        <>
          <button
            className="bw-text-button"
            onClick={() => {
              setSelected(null);
            }}
          >
            {c.back}
          </button>
          <div className="bw-section-heading">
            <div>
              <p className="bw-eyebrow">
                {activeSet.source.kind === "topic" ? c.generated : c.grounded}
              </p>
              <h1>{activeSet.title}</h1>
            </div>
            <button
              className="bw-button"
              disabled={busy}
              onClick={() =>
                activeSet.questions.length
                  ? start(activeSet)
                  : void regenerate(activeSet)
              }
            >
              {activeSet.questions.length ? c.start : c.noQuestions}
              <ArrowRight size={17} />
            </button>
          </div>
          {duration}
          <button
            className="bw-text-button"
            onClick={() => setMaterialTutor(!materialTutor)}
          >
            <Sparkles size={16} />
            {c.tutor}
          </button>
          {materialTutor && (
            <StudyTutor
              user={user}
              language={language}
              context={`${activeSet.notes}\n${activeSet.source.pages.map((p) => `[Page ${p.number}] ${p.text}`).join("\n")}`}
              messages={activeSet.messages ?? []}
              onMessages={(messages) =>
                persist({
                  ...current.current,
                  sets: current.current.sets.map((s) =>
                    s.id === activeSet.id ? { ...s, messages } : s,
                  ),
                })
              }
              onClose={() => setMaterialTutor(false)}
            />
          )}
          <div className="bw-tabs">
            {(["notes", "cards", "questions"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {c[t]}
              </button>
            ))}
          </div>
          <div className="bw-material-layout">
            <section className="bw-panel">
              {tab === "notes" ? (
                <>
                  <label className="bw-field">
                    {c.notes}
                    <textarea
                      aria-label={c.notes}
                      className="bw-notes-editor"
                      value={noteDraft}
                      onChange={(e) => {
                        const notes = e.target.value;
                        setNoteDraft(notes);
                        persist({
                          ...current.current,
                          sets: current.current.sets.map((s) =>
                            s.id === activeSet.id ? { ...s, notes } : s,
                          ),
                        });
                      }}
                      onBlur={() =>
                        persist({
                          ...current.current,
                          sets: current.current.sets.map((s) =>
                            s.id === activeSet.id
                              ? { ...s, notes: noteDraft }
                              : s,
                          ),
                        })
                      }
                      maxLength={60000}
                    />
                  </label>
                  <button
                    className="bw-button bw-secondary"
                    onClick={() =>
                      persist({
                        ...data,
                        sets: data.sets.map((s) =>
                          s.id === activeSet.id
                            ? { ...s, notes: noteDraft }
                            : s,
                        ),
                      })
                    }
                  >
                    {c.save}
                  </button>
                </>
              ) : tab === "cards" ? (
                <div className="bw-flashcards">
                  {activeSet.cards.map((card, i) => (
                    <button
                      key={i}
                      aria-label={`${c.flip}: ${card.front}`}
                      aria-pressed={!!flipped[i]}
                      onClick={() =>
                        setFlipped({ ...flipped, [i]: !flipped[i] })
                      }
                    >
                      <MathText>{flipped[i] ? card.back : card.front}</MathText>
                      <small>
                        {c.page} {card.pages.join(", ") || "—"}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bw-question-list">
                  {activeSet.questions.map((q, i) => (
                    <div key={q.id}>
                      <span className="bw-tag">{i + 1}</span>
                      <MathText>{q.question}</MathText>
                      <small>
                        {c.page} {q.sourcePages.join(", ") || "—"}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <aside className="bw-panel">
              <h2>{c.source}</h2>
              <p>{activeSet.source.name}</p>
              {activeSet.source.pages.map((p) => (
                <details key={p.number}>
                  <summary>
                    {c.page} {p.number}
                  </summary>
                  <MathText>{p.text}</MathText>
                </details>
              ))}
              <p className="bw-muted">{c.feedbackNote}</p>
              <h3>{c.sprint}</h3>
              {data.sprints
                .filter((s) => s.setId === activeSet.id)
                .map((s) => (
                  <button
                    className="bw-session-link"
                    key={s.id}
                    onClick={() => setSprintId(s.id)}
                  >
                    <span>{s.completedAt ? c.recap : c.resume}</span>
                    <small>
                      {new Date(s.createdAt).toLocaleDateString(language)} ·{" "}
                      {s.minutes} {c.minutes}
                    </small>
                  </button>
                ))}
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="bw-section-heading">
            <div>
              <p className="bw-eyebrow">
                {view === "dashboard"
                  ? `${c.today} / ${user.name}`
                  : "Brainwave"}
              </p>
              <h1>
                {view === "dashboard"
                  ? c.hello
                  : view === "courses"
                    ? c.library
                    : c.practice}
              </h1>
              <p className="bw-muted">
                {view === "dashboard"
                  ? c.welcome
                  : view === "courses"
                    ? c.promise
                    : c.exploreDesc}
              </p>
            </div>
            <button
              className="bw-button bw-secondary"
              onClick={() => {
                setTopic("");
                setForm(true);
              }}
            >
              <Plus size={18} />
              {c.add}
            </button>
          </div>
          {view === "dashboard" && (
            <>
              <section className="bw-hero">
                <div className="bw-hero-copy">
                  <span className="bw-hero-badge">
                    <Sparkles size={15} />
                    {c.recommended}
                  </span>
                  <h2>{recommended?.title ?? skill?.skillTag ?? c.sprint}</h2>
                  <p>{recommended ? c.sprintDesc : c.promise}</p>
                  {duration}
                  <button
                    className="bw-button bw-white"
                    onClick={() => {
                      if (recommended?.questions.length) start(recommended);
                      else {
                        setTopic(skill?.skillTag ?? "");
                        setForm(true);
                      }
                    }}
                  >
                    {c.start}
                    <ArrowRight size={18} />
                  </button>
                  <span className="bw-hero-foot">
                    <Clock3 size={14} />
                    {minutes} {c.minutes}
                  </span>
                </div>
                <BrainBuddy />
              </section>
              {resumable && (
                <button
                  className="bw-resume bw-panel"
                  onClick={() => setSprintId(resumable.id)}
                >
                  <span className="bw-icon">
                    <BookOpen size={22} />
                  </span>
                  <span>
                    <strong>{c.resume}</strong>
                    <small>
                      {data.sets.find((s) => s.id === resumable.setId)?.title} ·{" "}
                      {resumable.results.length} {c.activity}
                    </small>
                  </span>
                  <ArrowRight size={20} />
                </button>
              )}
            </>
          )}
          {view !== "practice" && (
            <section className="bw-section">
              <div className="bw-section-heading">
                <h2>{view === "dashboard" ? c.recent : c.library}</h2>
                {view === "dashboard" ? (
                  <button
                    className="bw-text-button"
                    onClick={() => onNavigate("courses")}
                  >
                    {c.all}
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <label className="bw-search">
                    <Search size={17} />
                    <input
                      aria-label={translations.search}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder={translations.search}
                    />
                  </label>
                )}
              </div>
              <div className="bw-set-grid">
                {data.sets
                  .filter((s) =>
                    s.title.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .slice(0, view === "dashboard" ? 3 : undefined)
                  .map((set, i) => (
                    <button
                      className="bw-set-card"
                      key={set.id}
                      onClick={() => openSet(set)}
                    >
                      <span className={`bw-set-art bw-set-art-${i % 3}`}>
                        <BookOpen size={32} />
                        <span>✦</span>
                      </span>
                      <small>
                        {set.source.kind === "topic" ? c.generated : c.grounded}
                      </small>
                      <h3>{set.title}</h3>
                      <span>
                        {set.cards.length} {c.cards} · {set.questions.length}{" "}
                        {c.questions}
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                {data.sets.length === 0 && (
                  <button
                    className="bw-empty"
                    onClick={() => {
                      setTopic("");
                      setForm(true);
                    }}
                  >
                    <Sprout size={36} />
                    <h3>{c.empty}</h3>
                    <span>{c.add} +</span>
                  </button>
                )}
              </div>
            </section>
          )}
          {view === "practice" && (
            <>
              <section className="bw-panel bw-practice-start">
                <div>
                  <span className="bw-icon">
                    <Sparkles size={24} />
                  </span>
                  <h2>{c.sprint}</h2>
                  <p>{c.sprintDesc}</p>
                  {skill && (
                    <p className="bw-muted">
                      {c.reviewPriority}: {skill.skillTag}
                    </p>
                  )}
                </div>
                {duration}
                <button
                  className="bw-button"
                  onClick={() => {
                    if (recommended?.questions.length) start(recommended);
                    else {
                      setTopic(skill?.skillTag ?? "");
                      setForm(true);
                    }
                  }}
                >
                  {c.start}
                  <ArrowRight size={18} />
                </button>
              </section>
              {explorer}
            </>
          )}
          {view === "courses" && (
            <>
              <section className="bw-section">
                <h2>{c.courses}</h2>
                <div className="bw-tools">
                  {courses.map((course) => (
                    <button
                      className="bw-tool-card"
                      key={course.id}
                      onClick={() => {
                        setTopic(
                          course.units
                            .flatMap((u) => u.topics)
                            .find((t) => t.mastery < 85)?.title ?? course.title,
                        );
                        setForm(true);
                      }}
                    >
                      <span className="bw-tool-icon">
                        <BookOpen size={18} />
                      </span>
                      <strong>{course.title}</strong>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              </section>
              {explorer}
              {legacy.some((n) => !data.importedLegacyIds.includes(n.id)) && (
                <section className="bw-panel">
                  <p>{c.legacy}</p>
                  <label className="bw-field">
                    {c.notes}
                    <select
                      value={legacyChoice}
                      onChange={(e) => setLegacyChoice(e.target.value)}
                    >
                      <option value="">—</option>
                      {legacy
                        .filter((n) => !data.importedLegacyIds.includes(n.id))
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="bw-button bw-secondary"
                    disabled={!legacyChoice}
                    onClick={() => {
                      const note = legacy.find((n) => n.id === legacyChoice);
                      if (!note) return;
                      const set: StudySet = {
                        id: crypto.randomUUID(),
                        ownerId: user.id,
                        createdAt: new Date().toISOString(),
                        grade: user.gradeLevel,
                        language,
                        subject: Subject.SCIENCE,
                        title: note.title,
                        notes: note.notes,
                        cards: [],
                        questions: [],
                        source: {
                          id: note.id,
                          kind: "legacy",
                          name: note.title,
                          reviewed: true,
                          pages: [{ number: 1, text: note.notes }],
                        },
                      };
                      persist({
                        ...data,
                        sets: [set, ...data.sets],
                        importedLegacyIds: [...data.importedLegacyIds, note.id],
                      });
                      setLegacyChoice("");
                    }}
                  >
                    {c.import}
                  </button>
                </section>
              )}
            </>
          )}
          {view === "dashboard" && (
            <section className="bw-discovery">
              <span className="bw-icon">
                <Gamepad2 size={26} />
              </span>
              <div>
                <h2>{c.explore}</h2>
                <p>{c.exploreDesc}</p>
              </div>
              <button
                className="bw-button bw-secondary"
                onClick={() => onNavigate("practice")}
              >
                {c.practice}
                <ArrowRight size={16} />
              </button>
            </section>
          )}
        </>
      )}
      {error && (
        <p className="bw-error" role="alert">
          {c.error}
        </p>
      )}
      {form && (
        <MaterialForm
          user={user}
          language={language}
          initialTopic={topic}
          onClose={() => setForm(false)}
          onDone={(set) => {
            persist({
              ...current.current,
              sets: [set, ...current.current.sets],
            });
            setForm(false);
            openSet(set);
          }}
        />
      )}
    </div>
  );
}
