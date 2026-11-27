/**
 * BrainWave's only icon source: Phosphor Icons, one family in bold, fill and
 * duotone weights. Each icon keeps the name the app used before (Mic, Layers,
 * ChevronRight…) so call sites read the same; the Phosphor glyph behind it is
 * chosen for meaning (Layers → Cards for flashcards, ClipboardCheck → Exam…).
 *
 * These are plain re-exports, one module per icon, so each page's bundle holds
 * only the icons it uses. The defaults (bold, 24px) come from `IconProvider`
 * at the app root; pass `weight` for the other roles (see DESIGN.md › Icons):
 * - `bold` (default): buttons, menus, chevrons, players.
 * - `fill`: keycaps and the open tab.
 * - `duotone`: an icon on a soft tint without a tile (alerts).
 */
import type { ReactNode } from 'react';
import { IconContext } from '@phosphor-icons/react/dist/lib/context';
import type { Icon, IconWeight } from '@phosphor-icons/react';

export type IconType = Icon;
export type { IconWeight };

// Icons are decoration: the button or link around them carries the name. Phosphor spreads
// extra context values onto every <svg>, so this hides them all from screen readers (as
// Lucide did); a call site can still pass aria-hidden={false} with its own label.
const DEFAULTS = { weight: 'bold' as IconWeight, size: 24, 'aria-hidden': true as const };
/** Bold, 24px, decorative icons everywhere unless a call site says otherwise. */
export const IconProvider = ({ children }: { children: ReactNode }) => <IconContext.Provider value={DEFAULTS}>{children}</IconContext.Provider>;

export { Warning as AlertTriangle } from '@phosphor-icons/react/dist/csr/Warning';
export { ArrowLeft as ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
export { ArrowRight as ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
export { ArrowUp as ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
export { Waveform as AudioLines } from '@phosphor-icons/react/dist/csr/Waveform';
export { Bell as Bell } from '@phosphor-icons/react/dist/csr/Bell';
export { BookBookmark as BookMarked } from '@phosphor-icons/react/dist/csr/BookBookmark';
export { BookOpen as BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
export { BookOpenText as BookOpenCheck } from '@phosphor-icons/react/dist/csr/BookOpenText';
export { BookOpenText as BookOpenText } from '@phosphor-icons/react/dist/csr/BookOpenText';
export { Calculator as Calculator } from '@phosphor-icons/react/dist/csr/Calculator';
export { CalendarStar as CalendarClock } from '@phosphor-icons/react/dist/csr/CalendarStar';
export { CalendarDots as CalendarDays } from '@phosphor-icons/react/dist/csr/CalendarDots';
export { CalendarPlus as CalendarPlus } from '@phosphor-icons/react/dist/csr/CalendarPlus';
export { CalendarBlank as CalendarRange } from '@phosphor-icons/react/dist/csr/CalendarBlank';
export { Camera as Camera } from '@phosphor-icons/react/dist/csr/Camera';
export { ClosedCaptioning as Captions } from '@phosphor-icons/react/dist/csr/ClosedCaptioning';
export { Car as CarFront } from '@phosphor-icons/react/dist/csr/Car';
export { Check as Check } from '@phosphor-icons/react/dist/csr/Check';
export { CheckCircle as CheckCircle2 } from '@phosphor-icons/react/dist/csr/CheckCircle';
export { CaretDown as ChevronDown } from '@phosphor-icons/react/dist/csr/CaretDown';
export { CaretLeft as ChevronLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
export { CaretRight as ChevronRight } from '@phosphor-icons/react/dist/csr/CaretRight';
export { CaretUp as ChevronUp } from '@phosphor-icons/react/dist/csr/CaretUp';
export { CaretDoubleLeft as ChevronsLeft } from '@phosphor-icons/react/dist/csr/CaretDoubleLeft';
export { CaretDoubleRight as ChevronsRight } from '@phosphor-icons/react/dist/csr/CaretDoubleRight';
export { Circle as Circle } from '@phosphor-icons/react/dist/csr/Circle';
export { WarningCircle as CircleAlert } from '@phosphor-icons/react/dist/csr/WarningCircle';
export { CheckCircle as CircleCheck } from '@phosphor-icons/react/dist/csr/CheckCircle';
export { CircleDashed as CircleDashed } from '@phosphor-icons/react/dist/csr/CircleDashed';
export { FilmSlate as Clapperboard } from '@phosphor-icons/react/dist/csr/FilmSlate';
export { Exam as ClipboardCheck } from '@phosphor-icons/react/dist/csr/Exam';
export { ClipboardText as ClipboardList } from '@phosphor-icons/react/dist/csr/ClipboardText';
export { Clipboard as ClipboardPaste } from '@phosphor-icons/react/dist/csr/Clipboard';
export { Coffee as Coffee } from '@phosphor-icons/react/dist/csr/Coffee';
export { Copy as Copy } from '@phosphor-icons/react/dist/csr/Copy';
export { DownloadSimple as Download } from '@phosphor-icons/react/dist/csr/DownloadSimple';
export { Ear as Ear } from '@phosphor-icons/react/dist/csr/Ear';
export { FileAudio as FileAudio } from '@phosphor-icons/react/dist/csr/FileAudio';
export { FileArrowDown as FileDown } from '@phosphor-icons/react/dist/csr/FileArrowDown';
export { FileText as FileText } from '@phosphor-icons/react/dist/csr/FileText';
export { FileDoc as FileType } from '@phosphor-icons/react/dist/csr/FileDoc';
export { FileArrowUp as FileUp } from '@phosphor-icons/react/dist/csr/FileArrowUp';
export { Fire as Flame } from '@phosphor-icons/react/dist/csr/Fire';
export { Flask as FlaskConical } from '@phosphor-icons/react/dist/csr/Flask';
export { Folder as Folder } from '@phosphor-icons/react/dist/csr/Folder';
export { FolderOpen as FolderInput } from '@phosphor-icons/react/dist/csr/FolderOpen';
export { FolderPlus as FolderPlus } from '@phosphor-icons/react/dist/csr/FolderPlus';
export { GameController as Gamepad2 } from '@phosphor-icons/react/dist/csr/GameController';
export { GlobeHemisphereWest as Globe2 } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
export { GraduationCap as GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
export { Hand as Hand } from '@phosphor-icons/react/dist/csr/Hand';
export { Headphones as Headphones } from '@phosphor-icons/react/dist/csr/Headphones';
export { Heart as Heart } from '@phosphor-icons/react/dist/csr/Heart';
export { HighlighterCircle as Highlighter } from '@phosphor-icons/react/dist/csr/HighlighterCircle';
export { ClockCounterClockwise as History } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
export { House as House } from '@phosphor-icons/react/dist/csr/House';
export { Image as ImageIcon } from '@phosphor-icons/react/dist/csr/Image';
export { ImagesSquare as ImagePlus } from '@phosphor-icons/react/dist/csr/ImagesSquare';
export { Info as Info } from '@phosphor-icons/react/dist/csr/Info';
export { Bank as Landmark } from '@phosphor-icons/react/dist/csr/Bank';
export { Translate as Languages } from '@phosphor-icons/react/dist/csr/Translate';
export { Code as Laptop } from '@phosphor-icons/react/dist/csr/Code';
export { Cards as Layers } from '@phosphor-icons/react/dist/csr/Cards';
export { SquaresFour as LayoutGrid } from '@phosphor-icons/react/dist/csr/SquaresFour';
export { Books as Library } from '@phosphor-icons/react/dist/csr/Books';
export { Lifebuoy as LifeBuoy } from '@phosphor-icons/react/dist/csr/Lifebuoy';
export { Lightbulb as Lightbulb } from '@phosphor-icons/react/dist/csr/Lightbulb';
export { Link as Link2 } from '@phosphor-icons/react/dist/csr/Link';
export { ListChecks as ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
export { ListNumbers as ListOrdered } from '@phosphor-icons/react/dist/csr/ListNumbers';
export { SignOut as LogOut } from '@phosphor-icons/react/dist/csr/SignOut';
export { Envelope as Mail } from '@phosphor-icons/react/dist/csr/Envelope';
export { CornersOut as Maximize } from '@phosphor-icons/react/dist/csr/CornersOut';
export { ArrowsOut as Maximize2 } from '@phosphor-icons/react/dist/csr/ArrowsOut';
export { ChatCircleDots as MessageCircle } from '@phosphor-icons/react/dist/csr/ChatCircleDots';
export { ChatTeardropText as MessageCircleQuestion } from '@phosphor-icons/react/dist/csr/ChatTeardropText';
export { ChatCenteredDots as MessageSquarePlus } from '@phosphor-icons/react/dist/csr/ChatCenteredDots';
export { Microphone as Mic } from '@phosphor-icons/react/dist/csr/Microphone';
export { ArrowsIn as Minimize2 } from '@phosphor-icons/react/dist/csr/ArrowsIn';
export { Minus as Minus } from '@phosphor-icons/react/dist/csr/Minus';
export { MonitorPlay as MonitorPlay } from '@phosphor-icons/react/dist/csr/MonitorPlay';
export { DotsThree as MoreHorizontal } from '@phosphor-icons/react/dist/csr/DotsThree';
export { Graph as Network } from '@phosphor-icons/react/dist/csr/Graph';
export { Notebook as NotebookText } from '@phosphor-icons/react/dist/csr/Notebook';
export { Palette as Palette } from '@phosphor-icons/react/dist/csr/Palette';
export { Paperclip as Paperclip } from '@phosphor-icons/react/dist/csr/Paperclip';
export { Pause as Pause } from '@phosphor-icons/react/dist/csr/Pause';
export { PencilLine as PenLine } from '@phosphor-icons/react/dist/csr/PencilLine';
export { PencilSimple as Pencil } from '@phosphor-icons/react/dist/csr/PencilSimple';
export { Play as Play } from '@phosphor-icons/react/dist/csr/Play';
export { Plus as Plus } from '@phosphor-icons/react/dist/csr/Plus';
export { Printer as Printer } from '@phosphor-icons/react/dist/csr/Printer';
export { ArrowsClockwise as RefreshCw } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
export { Repeat as Repeat } from '@phosphor-icons/react/dist/csr/Repeat';
export { ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
export { ArrowClockwise as RotateCw } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
export { Scroll as ScrollText } from '@phosphor-icons/react/dist/csr/Scroll';
export { MagnifyingGlass as Search } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
export { PaperPlaneTilt as Send } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
export { GearSix as Settings } from '@phosphor-icons/react/dist/csr/GearSix';
export { ShareNetwork as Share2 } from '@phosphor-icons/react/dist/csr/ShareNetwork';
export { ShieldCheck as ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
export { Shuffle as Shuffle } from '@phosphor-icons/react/dist/csr/Shuffle';
export { Siren as Siren } from '@phosphor-icons/react/dist/csr/Siren';
export { SkipBack as SkipBack } from '@phosphor-icons/react/dist/csr/SkipBack';
export { SkipForward as SkipForward } from '@phosphor-icons/react/dist/csr/SkipForward';
export { SlidersHorizontal as SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
export { Sparkle as Sparkles } from '@phosphor-icons/react/dist/csr/Sparkle';
export { Square as Square } from '@phosphor-icons/react/dist/csr/Square';
export { Star as Star } from '@phosphor-icons/react/dist/csr/Star';
export { Star as StarOff } from '@phosphor-icons/react/dist/csr/Star';
export { Target as Target } from '@phosphor-icons/react/dist/csr/Target';
export { Timer as Timer } from '@phosphor-icons/react/dist/csr/Timer';
export { Trash as Trash2 } from '@phosphor-icons/react/dist/csr/Trash';
export { TrendDown as TrendingDown } from '@phosphor-icons/react/dist/csr/TrendDown';
export { ChartLineUp as TrendingUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
export { Warning as TriangleAlert } from '@phosphor-icons/react/dist/csr/Warning';
export { Trophy as Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
export { UploadSimple as Upload } from '@phosphor-icons/react/dist/csr/UploadSimple';
export { UserMinus as UserMinus } from '@phosphor-icons/react/dist/csr/UserMinus';
export { UsersThree as Users } from '@phosphor-icons/react/dist/csr/UsersThree';
export { SpeakerHigh as Volume2 } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
export { SpeakerX as VolumeX } from '@phosphor-icons/react/dist/csr/SpeakerX';
export { X as X } from '@phosphor-icons/react/dist/csr/X';
