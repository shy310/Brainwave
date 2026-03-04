
import React, { useState, useRef, useEffect } from 'react';
import { Message, Attachment, GradeLevel, Translations, LearningSession } from '../types';
import { generateTutorResponse } from '../services/aiService';
import FileUpload from './FileUpload';
import MathText from './MathText';
import { MessageCircle, X, Send, User, Brain, Maximize2, Minimize2, Trash2, Eye } from 'lucide-react';

interface Props {
  userGrade: GradeLevel;
  language: string;
  context: string;
  translations: Translations;
  activeView: string;
  currentSession: LearningSession | null;
}

// ─── VIEW CONFIG ──────────────────────────────────────────────────────────────

interface ViewConfig {
  greeting: string;
  role: string;        // injected into system prompt (always English)
  badge: string;       // shown in header
  placeholder: string; // textarea hint
}

type LangKey = 'en' | 'ru' | 'he' | 'ar';

const VIEW_STRINGS: Record<LangKey, Record<string, Pick<ViewConfig, 'greeting' | 'badge' | 'placeholder'>>> = {
  en: {
    lesson: {
      greeting: "I can see the lesson you're reading! 📖 Ask me to explain any concept, give you a real-world example, or test you on the material.",
      badge: 'Lesson mode',
      placeholder: 'Ask about anything in this lesson…',
    },
    exercise: {
      greeting: "Stuck on a question? 🧩 I can see it on your screen. Tell me where you're lost and I'll guide you — no spoilers though!",
      badge: 'Exercise mode',
      placeholder: 'Tell me where you\'re stuck…',
    },
    courses: {
      greeting: "Looking for the right course? 🎯 Tell me what you want to learn or what you're struggling with and I'll point you in the right direction.",
      badge: 'Course guide',
      placeholder: 'What do you want to learn?',
    },
    progress: {
      greeting: "Let's look at your progress together! 📊 Ask me which subjects to focus on next or how to improve in a weak area.",
      badge: 'Progress coach',
      placeholder: 'Ask about your progress…',
    },
    default: {
      greeting: "Hey! 👋 I'm your BrainWave AI tutor. I can see your dashboard. What would you like to learn today? I can suggest subjects based on your level or just chat about anything!",
      badge: 'Ready to help',
      placeholder: 'Ask me anything…',
    },
  },
  ru: {
    lesson: {
      greeting: "Я вижу урок, который ты читаешь! 📖 Спроси меня объяснить любую концепцию, привести пример из жизни или проверить твои знания.",
      badge: 'Режим урока',
      placeholder: 'Спроси о чём-нибудь из урока…',
    },
    exercise: {
      greeting: "Застрял на вопросе? 🧩 Я вижу его на экране. Скажи, где потерялся — я направлю тебя, без подсказок ответа!",
      badge: 'Режим упражнений',
      placeholder: 'Скажи, где застрял…',
    },
    courses: {
      greeting: "Ищешь подходящий курс? 🎯 Расскажи, что хочешь изучить или что не получается — укажу правильное направление.",
      badge: 'Гид по курсам',
      placeholder: 'Что хочешь изучить?',
    },
    progress: {
      greeting: "Давай посмотрим на твой прогресс вместе! 📊 Спроси, на каких темах лучше сосредоточиться или как улучшить слабые места.",
      badge: 'Коуч по прогрессу',
      placeholder: 'Спроси о своём прогрессе…',
    },
    default: {
      greeting: "Привет! 👋 Я твой ИИ-репетитор BrainWave. Что хочешь изучить сегодня? Могу предложить темы по твоему уровню или просто поговорить!",
      badge: 'Готов помочь',
      placeholder: 'Спроси меня что угодно…',
    },
  },
  he: {
    lesson: {
      greeting: "אני רואה את השיעור שאתה קורא! 📖 שאל אותי להסביר כל מושג, לתת דוגמה מהחיים, או לבחון אותך על החומר.",
      badge: 'מצב שיעור',
      placeholder: 'שאל על כל דבר בשיעור…',
    },
    exercise: {
      greeting: "תקוע בשאלה? 🧩 אני רואה אותה על המסך. ספר לי איפה אתה תקוע ואנחנו נגיע לתשובה — בלי לחשוף את התשובה!",
      badge: 'מצב תרגול',
      placeholder: 'ספר לי איפה תקוע…',
    },
    courses: {
      greeting: "מחפש את הקורס הנכון? 🎯 ספר לי מה אתה רוצה ללמוד ואכוון אותך לכיוון הנכון.",
      badge: 'מדריך קורסים',
      placeholder: 'מה אתה רוצה ללמוד?',
    },
    progress: {
      greeting: "בוא נסתכל על ההתקדמות שלך ביחד! 📊 שאל אותי על אילו נושאים להתמקד או איך להשתפר בתחומים חלשים.",
      badge: 'מאמן התקדמות',
      placeholder: 'שאל על ההתקדמות שלך…',
    },
    default: {
      greeting: "היי! 👋 אני הטוטור שלך BrainWave. מה תרצה ללמוד היום? אוכל להציע נושאים לפי הרמה שלך או פשוט לשוחח!",
      badge: 'מוכן לעזור',
      placeholder: 'שאל אותי כל דבר…',
    },
  },
  ar: {
    lesson: {
      greeting: "أرى الدرس الذي تقرأه! 📖 اسألني لشرح أي مفهوم أو إعطاء مثال من الحياة أو اختبارك على المادة.",
      badge: 'وضع الدرس',
      placeholder: 'اسأل عن أي شيء في هذا الدرس…',
    },
    exercise: {
      greeting: "عالق في سؤال؟ 🧩 أرى الشاشة. أخبرني أين تاهت وسأرشدك — دون إفساد التجربة!",
      badge: 'وضع التمرين',
      placeholder: 'أخبرني أين تعثرت…',
    },
    courses: {
      greeting: "تبحث عن الدورة المناسبة؟ 🎯 أخبرني ما تريد تعلمه وسأوجهك في الاتجاه الصحيح.",
      badge: 'مرشد الدورات',
      placeholder: 'ماذا تريد أن تتعلم؟',
    },
    progress: {
      greeting: "دعنا نراجع تقدمك معاً! 📊 اسألني عن المواد التي يجب التركيز عليها أو كيفية التحسن في المجالات الضعيفة.",
      badge: 'مدرب التقدم',
      placeholder: 'اسأل عن تقدمك…',
    },
    default: {
      greeting: "مرحباً! 👋 أنا مدرسك الخاص BrainWave. ماذا تريد أن تتعلم اليوم؟ يمكنني اقتراح مواضيع حسب مستواك أو مجرد الحديث!",
      badge: 'مستعد للمساعدة',
      placeholder: 'اسألني أي شيء…',
    },
  },
};

const VIEW_ROLES: Record<string, string> = {
  lesson: "The student is reading a lesson. Your job: explain the lesson content clearly, use analogies, and ask Socratic follow-up questions. Do NOT reveal exercise answers — guide through reasoning instead.",
  exercise: "The student is doing exercises. Give HINTS and guiding questions ONLY — never give the direct answer. Use the Socratic method. Break the problem into smaller steps. Be encouraging.",
  courses: "The student is browsing courses. Help them pick courses that match their interests and grade level. Be enthusiastic and concrete.",
  progress: "The student is reviewing their learning progress. Help them interpret their stats, identify the weakest areas, and plan their next study sessions. Be motivating and specific.",
  default: "The student is on the home dashboard. Help them decide what to study next, explain what subjects are available, motivate them, and answer general questions. Be friendly and energetic.",
};

function getViewConfig(view: string, language: string): ViewConfig {
  const lang = (VIEW_STRINGS[language as LangKey] ? language : 'en') as LangKey;
  const strings = VIEW_STRINGS[lang];
  const viewKey = strings[view] ? view : 'default';
  const role = VIEW_ROLES[view] ?? VIEW_ROLES.default;
  return { ...strings[viewKey], role };
}

// ─── MARKDOWN + MATH RENDERER ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold"><MathText>{part.slice(2, -2)}</MathText></strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}><MathText>{part.slice(1, -1)}</MathText></em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-black/15 rounded px-1 py-0.5 font-mono text-[11px]">{part.slice(1, -1)}</code>;
    return <MathText key={i}>{part}</MathText>;
  });
}

function MarkdownMessage({ text, isUser }: { text: string; isUser: boolean }) {
  const codeBlockStyle = "bg-gray-900 text-green-300 rounded-xl p-3 text-[11px] overflow-x-auto my-2 font-mono leading-relaxed";
  const accentColor = isUser ? 'text-white/70' : 'text-brand-500';

  const blocks = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-1 leading-relaxed">
      {blocks.map((block, bi) => {
        if (block.startsWith('```')) {
          const code = block.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '');
          return <pre key={bi} className={codeBlockStyle}><code>{code}</code></pre>;
        }

        const lines = block.split('\n');
        const nodes: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];
          const trimmed = line.trim();

          if (!trimmed) { nodes.push(<div key={`${bi}-${i}`} className="h-1" />); i++; continue; }

          if (trimmed.startsWith('### '))
            { nodes.push(<p key={`${bi}-${i}`} className="font-bold text-sm mt-2 mb-0.5">{renderInline(trimmed.slice(4))}</p>); i++; continue; }
          if (trimmed.startsWith('## '))
            { nodes.push(<p key={`${bi}-${i}`} className="font-bold text-sm mt-2 mb-0.5">{renderInline(trimmed.slice(3))}</p>); i++; continue; }
          if (trimmed.startsWith('# '))
            { nodes.push(<p key={`${bi}-${i}`} className="font-bold text-base mt-2 mb-1">{renderInline(trimmed.slice(2))}</p>); i++; continue; }

          if (trimmed.match(/^[-*•] /))
            { nodes.push(<div key={`${bi}-${i}`} className="flex gap-2 my-0.5 pl-1"><span className={`${accentColor} flex-shrink-0 leading-5`}>•</span><span>{renderInline(trimmed.replace(/^[-*•] /, ''))}</span></div>); i++; continue; }

          const nm = trimmed.match(/^(\d+)[.)]\s+/);
          if (nm)
            { nodes.push(<div key={`${bi}-${i}`} className="flex gap-2 my-0.5 pl-1"><span className={`${accentColor} font-bold flex-shrink-0 w-5 leading-5`}>{nm[1]}.</span><span>{renderInline(trimmed.replace(/^\d+[.)]\s+/, ''))}</span></div>); i++; continue; }

          if (trimmed === '---' || trimmed === '***')
            { nodes.push(<hr key={`${bi}-${i}`} className="border-current opacity-20 my-2" />); i++; continue; }

          nodes.push(<p key={`${bi}-${i}`}>{renderInline(trimmed)}</p>);
          i++;
        }

        return <div key={bi}>{nodes}</div>;
      })}
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const INITIAL_MESSAGE_ID = 'init-0';

const FloatingChat: React.FC<Props> = ({ userGrade, language, context, translations, activeView, currentSession }) => {
  const cfg = getViewConfig(activeView, language);

  const makeInitialMessage = (config: ViewConfig): Message => ({
    id: INITIAL_MESSAGE_ID,
    role: 'model',
    text: config.greeting,
    timestamp: Date.now(),
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([makeInitialMessage(cfg)]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Index into `messages` from which API history starts — reset on language change
  // so the AI never sees old-language messages and responds in the correct language.
  const apiHistoryStartRef = useRef(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  // When language changes, cut the API history window so the AI gets no old-language context.
  // Visual history is unchanged — the user still sees the full conversation.
  useEffect(() => {
    setMessages(prev => {
      apiHistoryStartRef.current = prev.length;
      return prev; // no visual change
    });
  }, [language]);

  // When view changes, update the greeting only if chat is still pristine.
  useEffect(() => {
    const newCfg = getViewConfig(activeView, language);
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === INITIAL_MESSAGE_ID)
        return [{ ...prev[0], text: newCfg.greeting }];
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const clearChat = () => setMessages([makeInitialMessage(getViewConfig(activeView, language))]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      attachments: [...attachments],
      timestamp: Date.now(),
    };

    const historySnapshot = messages.slice(apiHistoryStartRef.current);
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    // Capture visible screen text from the main content area
    const mainEl = document.querySelector('main');
    const screenText = mainEl
      ? mainEl.innerText.replace(/\s{3,}/g, '\n\n').trim().slice(0, 3000)
      : '';

    // Build rich context: view-specific role + active session + screen content
    const viewCfg = getViewConfig(activeView, language);
    const sessionContext = currentSession
      ? `ACTIVE SESSION: The student is currently studying "${currentSession.topicTitle}" in ${currentSession.subject} at grade ${currentSession.grade}. Phase: ${currentSession.phase}. Answer questions relevant to this topic when possible.`
      : '';
    const fullContext = [
      `TUTOR MODE: ${viewCfg.role}`,
      sessionContext,
      context,
      screenText ? `--- CURRENT SCREEN CONTENT ---\n${screenText}\n---` : '',
    ].filter(Boolean).join('\n\n');

    const response = await generateTutorResponse(
      historySnapshot,
      userMsg.text,
      userMsg.attachments,
      { grade: userGrade, language, contextStr: fullContext }
    );

    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: response.text,
      attachments: response.attachments,
      timestamp: Date.now(),
    }]);
    setIsTyping(false);
  };

  // ── CLOSED STATE ─────────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-2xl shadow-brand-500/40 flex items-center justify-center transition-all hover:scale-110 z-50 rtl:left-6 rtl:right-auto"
      >
        <MessageCircle size={26} />
      </button>
    );
  }

  const currentCfg = getViewConfig(activeView, language);

  // ── OPEN STATE ───────────────────────────────────────────────────────────────
  return (
    <div className={`fixed bottom-6 right-6 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col z-50 transition-all duration-300 rtl:left-6 rtl:right-auto overflow-hidden
      ${isExpanded ? 'w-[780px] h-[82vh] max-w-[calc(100vw-48px)]' : 'w-96 h-[560px] max-w-[calc(100vw-48px)]'}`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 bg-brand-600 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <Brain size={17} />
          </div>
          <div>
            <p className="font-black text-sm leading-tight">{translations.mentorAiTutor}</p>
            <p className="text-[10px] text-white/60 leading-tight flex items-center gap-1.5">
              <Eye size={9} />
              {currentCfg.badge}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} title="Clear chat" className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <Trash2 size={15} />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-950">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center mt-1
                ${isUser
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  : 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
                }`}
              >
                {isUser ? <User size={13} /> : <Brain size={13} />}
              </div>

              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm
                ${isUser
                  ? 'bg-brand-600 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 shadow-sm rounded-tl-sm'
                }`}
              >
                <MarkdownMessage text={msg.text || '…'} isUser={isUser} />

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.attachments.map((att, idx) =>
                      att.mimeType.startsWith('image/') ? (
                        <img key={idx} src={`data:${att.mimeType};base64,${att.data}`} alt={att.name || 'attachment'} className="rounded-xl max-h-52 object-contain w-full" />
                      ) : (
                        <div key={idx} className="text-xs opacity-70 flex items-center gap-1">📎 {att.name}</div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-2.5 items-end">
            <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
              <Brain size={13} />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* ── Input ── */}
      <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">

        <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2">
          <FileUpload onAttach={setAttachments} translations={translations} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder={currentCfg.placeholder}
            rows={1}
            className="flex-1 bg-transparent border-none resize-none focus:ring-0 outline-none py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || isTyping}
            className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 active:scale-95"
          >
            <Send size={16} className="rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingChat;
