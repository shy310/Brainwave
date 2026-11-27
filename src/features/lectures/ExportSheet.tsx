import { useState } from 'react';
import { BookMarked, Check, Copy, FileText, Layers } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { Sheet } from '@/ui/Sheet';
import { ListRow, ListSection } from '@/ui/List';
import { isRtl } from '@shared/locales';
import type { Lecture } from './repo';
import { ankiTsv, docxBytes, fileName } from './exporters';
import { notesLabels, notesLocale, notesToMarkdown } from './notesExport';

const save = (name: string, data: BlobPart, type: string) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Take a lecture to other apps: flashcards to Anki, notes to Google Docs (.docx) or Notion (Markdown). */
export const ExportSheet = ({ open, onClose, lecture, title }: { open: boolean; onClose: () => void; lecture: Lecture; title: string }) => {
  const { t, locale } = useI18n();
  const te = t.lectures.export;
  const [copied, setCopied] = useState(false);
  const notes = lecture.notes;
  const lang = notes ? notesLocale(notes, locale) : locale;
  const labels = notesLabels(lang);
  const cards = lecture.flashcards?.cards ?? [];
  const markdown = () => (notes ? notesToMarkdown(title, notes, labels) : '');

  return (
    <Sheet open={open} onClose={onClose} title={te.title}>
      <div className="space-y-4">
        <ListSection title={te.flashcards}>
          <ListRow icon={Layers} label={te.anki} hint={cards.length ? te.ankiBody : te.noCards} chevron={false}
            onClick={() => { if (cards.length) save(fileName(title, 'txt'), ankiTsv(title, cards), 'text/plain;charset=utf-8'); }} />
        </ListSection>
        <ListSection title={te.notes} footer={!notes ? te.noNotes : undefined}>
          <ListRow icon={FileText} label={te.docs} hint={te.docsBody} chevron={false}
            onClick={() => { if (notes) save(fileName(title, 'docx'), docxBytes(title, notes, labels, isRtl(lang)) as BlobPart, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); }} />
          <ListRow icon={BookMarked} label={te.notion} hint={te.notionBody} chevron={false}
            onClick={() => { if (notes) save(fileName(title, 'md'), markdown(), 'text/markdown;charset=utf-8'); }} />
          <ListRow icon={copied ? Check : Copy} label={copied ? te.copied : te.copyNotion} chevron={false}
            onClick={() => { if (!notes) return; void navigator.clipboard.writeText(markdown()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} />
        </ListSection>
      </div>
    </Sheet>
  );
};
