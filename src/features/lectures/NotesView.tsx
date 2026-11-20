import { useT } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Card } from '@/ui/Card';
import { Rich, RichInline } from '@/ui/Rich';
import type { Notes } from '@shared/lectures';

/** Lecture notes: summary, sections, key terms and reminders. Used on screen, in print and on share links. */
export const NotesView = ({ notes }: { notes: Notes }) => {
  const t = useT();
  return (
    <>
      <Card className="space-y-5 p-6 print:border-0 print:p-0 print:shadow-none">
        <section className="break-inside-avoid">
          <h2 className="mb-2 text-lg font-semibold">{t.lectures.summary}</h2>
          <Rich text={notes.summary} />
        </section>
        {notes.sections.map((s, i) => (
          <section key={i} className="break-inside-avoid">
            <h2 className="mb-2 text-lg font-semibold" dir="auto">{s.heading}</h2>
            <ul className="list-disc space-y-1.5 ps-6">{s.points.map((p, j) => <li key={j} dir="auto"><RichInline text={p} /></li>)}</ul>
          </section>
        ))}
      </Card>
      {notes.keyTerms.length > 0 && (
        <Card className="p-6 print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 text-lg font-semibold">{t.lectures.keyTerms}</h2>
          <dl className="space-y-2">
            {notes.keyTerms.map((k, i) => (
              <div key={i} className="break-inside-avoid"><dt className="font-medium" dir="auto"><RichInline text={k.term} /></dt><dd className="text-sm text-muted" dir="auto"><RichInline text={k.definition} /></dd></div>
            ))}
          </dl>
        </Card>
      )}
      {notes.reminders.length > 0 && (
        <Alert className="break-inside-avoid">
          <p className="mb-1 font-semibold">{t.lectures.reminders}</p>
          <ul className="list-disc space-y-1 ps-5">{notes.reminders.map((r, i) => <li key={i} dir="auto">{r}</li>)}</ul>
        </Alert>
      )}
    </>
  );
};
