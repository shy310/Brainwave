import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Language } from '../types';

const titles = {
  games: ['Quick play', 'Быстрая игра', 'משחק קצר', 'لعبة سريعة'],
  code: ['Code lab', 'Пишем код', 'מעבדת קוד', 'مختبر البرمجة'],
  debate: ['Make your case', 'Твой аргумент', 'מה הטיעון שלך?', 'ما حجتك؟'],
  story: ['Plot twist', 'Поворот сюжета', 'טוויסט בעלילה', 'مفاجأة في القصة'],
  slides: ['Show your idea', 'Покажи идею', 'רעיון על המסך', 'اعرض فكرتك'],
  sql: ['Crack the case', 'Раскрой дело', 'פותרים את התעלומה', 'حل اللغز'],
} as const;
const descriptions = {
  games: ['Pick a game. Try a round.', 'Выбери игру. Попробуй раунд.', 'בוחרים משחק. מנסים סיבוב.', 'اختر لعبة. جرّب جولة.'],
  code: ['Build it. Run it. Make it work.', 'Напиши. Запусти. Улучши.', 'כותבים. מריצים. משפרים.', 'اكتب. شغّل. حسّن.'],
  debate: ['Pick a side. Back it up.', 'Выбери сторону. Приведи довод.', 'בוחרים צד. מביאים נימוק.', 'اختر موقفًا. ادعمه بدليل.'],
  story: ['Your story. What happens next?', 'Твоя история. Что дальше?', 'הסיפור שלך. מה קורה עכשיו?', 'قصتك. ماذا يحدث الآن؟'],
  slides: ['One idea. A few great slides.', 'Одна идея. Несколько ярких слайдов.', 'רעיון אחד. כמה שקופיות טובות.', 'فكرة واحدة. شرائح مميزة.'],
  sql: ['Follow the clues with SQL.', 'Ищи улики с помощью SQL.', 'עוקבים אחרי הרמזים עם SQL.', 'تتبّع الأدلة باستخدام SQL.'],
} as const;
export type ActivityKind = keyof typeof titles;
export function activityCopy(kind: ActivityKind, language: Language) {
  const i = {en: 0, ru: 1, he: 2, ar: 3}[language];
  return {title: titles[kind][i], description: descriptions[kind][i]};
}
export default function ActivityHeader({kind, language, onBack}: {
  kind: ActivityKind; language: Language; onBack: () => void;
}) {
  const c = activityCopy(kind, language);
  const back = {en:'Back', ru:'Назад', he:'חזרה', ar:'رجوع'}[language];
  return <header className={`bw-activity-header bw-activity-${kind}`} dir={language === 'he' || language === 'ar' ? 'rtl' : 'ltr'}>
    <button className="bw-icon-button" onClick={onBack} aria-label={back}><ArrowLeft size={20}/></button>
    <div><h1>{c.title}</h1><p>{c.description}</p></div>
    <Sparkles className="bw-activity-spark" size={28} aria-hidden="true"/>
  </header>;
}
