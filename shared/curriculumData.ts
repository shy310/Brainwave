// Generated from the v1 curriculum, with Hebrew added. Edit freely — this file is the source of truth.
// Each topic: t(id, [English title, Hebrew title], [English description, Hebrew description], prerequisites)

import type { Course } from './curriculumTypes';
import { t, u } from './curriculumTypes';

export const COURSES: Course[] = [
  {
    id: "math-kinder", subject: "math", band: "k",
    units: [
      u("math-k-u1", ["Counting & Numbers", "ספירה ומספרים"], [
        t("math-k-t1", ["Counting to 20", "ספירה עד 20"], ["Counting objects, saying numbers in order, and recognizing numerals 1–20.", "סופרים חפצים, אומרים מספרים לפי הסדר ומזהים את הספרות 1–20."], []),
        t("math-k-t2", ["More and Less", "יותר ופחות"], ["Comparing groups of objects to decide which has more or fewer.", "משווים בין קבוצות של חפצים ומחליטים באיזו יש יותר ובאיזו פחות."], ["math-k-t1"]),
        t("math-k-t3", ["Adding and Taking Away", "מוסיפים ומורידים"], ["Putting groups together and taking some away using pictures and objects.", "מחברים קבוצות יחד ומורידים מהן בעזרת תמונות וחפצים."], ["math-k-t2"]),
      ]),
      u("math-k-u2", ["Shapes & Patterns", "צורות ודפוסים"], [
        t("math-k-t4", ["Basic Shapes", "צורות בסיסיות"], ["Recognizing and naming circles, squares, triangles and rectangles.", "מזהים וקוראים בשם לעיגול, ריבוע, משולש ומלבן."], []),
        t("math-k-t5", ["Patterns", "דפוסים"], ["Identifying and continuing simple AB, AAB and ABC patterns.", "מזהים וממשיכים דפוסים פשוטים כמו AB, AAB ו-ABC."], ["math-k-t4"]),
      ]),
    ],
  },
  {
    id: "math-elem13", subject: "math", band: "1-3",
    units: [
      u("math-e13-u1", ["Addition & Subtraction", "חיבור וחיסור"], [
        t("math-e13-t1", ["Adding to 100", "חיבור עד 100"], ["Adding two- and three-digit numbers with and without regrouping.", "חיבור מספרים דו-ספרתיים ותלת-ספרתיים, עם המרה ובלי."], []),
        t("math-e13-t2", ["Subtracting to 100", "חיסור עד 100"], ["Subtracting two-digit numbers and understanding borrowing.", "חיסור מספרים דו-ספרתיים והבנת הפריטה."], ["math-e13-t1"]),
        t("math-e13-t3", ["Word Problems", "בעיות מילוליות"], ["Solving addition and subtraction story problems step by step.", "פותרים בעיות חיבור וחיסור מילוליות צעד אחר צעד."], ["math-e13-t2"]),
      ]),
      u("math-e13-u2", ["Multiplication Intro & Geometry", "מבוא לכפל וגאומטריה"], [
        t("math-e13-t4", ["Intro to Multiplication", "מבוא לכפל"], ["Equal groups, repeated addition and times tables up to 5.", "קבוצות שוות, חיבור חוזר ולוח הכפל עד 5."], ["math-e13-t1"]),
        t("math-e13-t5", ["Telling Time", "קריאת שעון"], ["Reading clocks to the hour, half-hour and five minutes.", "קוראים שעון לשעה שלמה, לחצי שעה ולחמש דקות."], []),
        t("math-e13-t6", ["Shapes & Measurement", "צורות ומדידה"], ["Perimeter of simple shapes, measuring length with a ruler.", "היקף של צורות פשוטות ומדידת אורך בסרגל."], []),
      ]),
    ],
  },
  {
    id: "math-elem46", subject: "math", band: "4-6",
    units: [
      u("math-elem-u1", ["Multiplication & Division", "כפל וחילוק"], [
        t("math-elem-t1", ["Multiplication Tables", "לוח הכפל"], ["Mastering times tables 1–12 and multi-digit multiplication.", "שליטה בלוח הכפל 1–12 וכפל של מספרים רב-ספרתיים."], []),
        t("math-elem-t2", ["Long Division", "חילוק ארוך"], ["Dividing multi-digit numbers and understanding remainders.", "חילוק מספרים רב-ספרתיים והבנת השארית."], ["math-elem-t1"]),
        t("math-elem-t3", ["Order of Operations", "סדר פעולות חשבון"], ["PEMDAS: solving expressions with multiple operations correctly.", "פותרים נכון ביטויים עם כמה פעולות: סוגריים, חזקות, כפל וחילוק, חיבור וחיסור."], ["math-elem-t2"]),
      ]),
      u("math-elem-u2", ["Fractions & Decimals", "שברים ומספרים עשרוניים"], [
        t("math-elem-t4", ["Fractions", "שברים"], ["Equivalent fractions, comparing, adding and subtracting fractions.", "שברים שקולים, השוואה, חיבור וחיסור של שברים."], ["math-elem-t1"]),
        t("math-elem-t5", ["Decimals", "מספרים עשרוניים"], ["Tenths, hundredths, rounding and converting between fractions and decimals.", "עשיריות, מאיות, עיגול והמרה בין שברים למספרים עשרוניים."], ["math-elem-t4"]),
        t("math-elem-t6", ["Ratios & Percentages", "יחס ואחוזים"], ["Understanding ratios, rates and basic percentage calculations.", "הבנת יחס, קצב וחישובי אחוזים בסיסיים."], ["math-elem-t5"]),
      ]),
    ],
  },
  {
    id: "math-middle", subject: "math", band: "7-8",
    units: [
      u("math-mid-u1", ["Pre-Algebra", "טרום אלגברה"], [
        t("math-mid-t1", ["Integers & Rational Numbers", "מספרים שלמים ורציונליים"], ["Operations with negative numbers, fractions and decimals on a number line.", "פעולות עם מספרים שליליים, שברים ומספרים עשרוניים על ציר המספרים."], []),
        t("math-mid-t2", ["Variables & Expressions", "משתנים וביטויים"], ["Writing and simplifying algebraic expressions; combining like terms.", "כתיבה ופישוט של ביטויים אלגבריים; כינוס איברים דומים."], ["math-mid-t1"]),
        t("math-mid-t3", ["Linear Equations", "משוואות קוויות"], ["Solving one- and two-step equations with one variable.", "פתרון משוואות עם נעלם אחד בצעד אחד ובשני צעדים."], ["math-mid-t2"]),
        t("math-mid-t4", ["Proportions & Percent", "פרופורציה ואחוזים"], ["Unit rate, percent change, discount, tax and interest.", "מחיר ליחידה, שינוי באחוזים, הנחה, מס וריבית."], ["math-mid-t1"]),
      ]),
      u("math-mid-u2", ["Geometry & Statistics", "גאומטריה וסטטיסטיקה"], [
        t("math-mid-t5", ["Geometry: Angles & Triangles", "גאומטריה: זוויות ומשולשים"], ["Angle relationships, the Pythagorean theorem and triangle properties.", "קשרים בין זוויות, משפט פיתגורס ותכונות של משולשים."], []),
        t("math-mid-t6", ["Area, Volume & Surface Area", "שטח, נפח ושטח פנים"], ["Formulas for 2D and 3D shapes including circles, prisms and pyramids.", "נוסחאות לצורות דו-ממדיות ותלת-ממדיות, כולל מעגלים, מנסרות ופירמידות."], ["math-mid-t5"]),
        t("math-mid-t7", ["Statistics & Probability", "סטטיסטיקה והסתברות"], ["Mean, median, mode, range and basic probability experiments.", "ממוצע, חציון, שכיח, טווח וניסויי הסתברות בסיסיים."], []),
      ]),
    ],
  },
  {
    id: "math-high910", subject: "math", band: "9-10",
    units: [
      u("math-h1-u1", ["Algebra II", "אלגברה II"], [
        t("math-h1-t1", ["Quadratic Equations", "משוואות ריבועיות"], ["Factoring, completing the square and the quadratic formula.", "פירוק לגורמים, השלמה לריבוע ונוסחת השורשים."], []),
        t("math-h1-t2", ["Polynomial Functions", "פונקציות פולינומיות"], ["Graphing, finding roots and polynomial long division.", "שרטוט גרפים, מציאת שורשים וחילוק פולינומים ארוך."], ["math-h1-t1"]),
        t("math-h1-t3", ["Exponential & Logarithmic Functions", "פונקציות מעריכיות ולוגריתמיות"], ["Growth/decay models, log rules and solving exponential equations.", "מודלים של גדילה ודעיכה, חוקי לוגריתמים ופתרון משוואות מעריכיות."], ["math-h1-t2"]),
      ]),
      u("math-h1-u2", ["Geometry & Trigonometry", "גאומטריה וטריגונומטריה"], [
        t("math-h1-t4", ["Coordinate Geometry", "גאומטריה אנליטית"], ["Distance formula, midpoint, slopes of parallel and perpendicular lines.", "נוסחת המרחק, אמצע קטע, ושיפועים של ישרים מקבילים ומאונכים."], []),
        t("math-h1-t5", ["Right Triangle Trigonometry", "טריגונומטריה במשולש ישר-זווית"], ["SOH-CAH-TOA, inverse trig functions and solving triangles.", "סינוס, קוסינוס וטנגנס, הפונקציות ההפוכות ופתרון משולשים."], ["math-h1-t4"]),
        t("math-h1-t6", ["Unit Circle & Trig Identities", "מעגל היחידה וזהויות טריגונומטריות"], ["Angles in radians, the unit circle and fundamental identities.", "זוויות ברדיאנים, מעגל היחידה והזהויות הבסיסיות."], ["math-h1-t5"]),
      ]),
    ],
  },
  {
    id: "math-high1112", subject: "math", band: "11-12",
    units: [
      u("math-h2-u1", ["Pre-Calculus", "טרום חשבון אינפיניטסימלי"], [
        t("math-h2-t1", ["Functions & Transformations", "פונקציות והזזות"], ["Domain, range, inverse functions and graphical transformations.", "תחום הגדרה, טווח, פונקציות הפוכות והזזות של גרפים."], []),
        t("math-h2-t2", ["Sequences & Series", "סדרות וטורים"], ["Arithmetic and geometric sequences, sigma notation and limits.", "סדרות חשבוניות והנדסיות, כתיב סיגמה וגבולות."], ["math-h2-t1"]),
        t("math-h2-t3", ["Intro to Limits & Derivatives", "מבוא לגבולות ונגזרות"], ["The concept of a limit, instantaneous rate of change and basic derivatives.", "מושג הגבול, קצב שינוי רגעי ונגזרות בסיסיות."], ["math-h2-t2"]),
      ]),
      u("math-h2-u2", ["Statistics & Probability", "סטטיסטיקה והסתברות"], [
        t("math-h2-t4", ["Data Analysis", "ניתוח נתונים"], ["Descriptive statistics, normal distribution and z-scores.", "סטטיסטיקה תיאורית, ההתפלגות הנורמלית וציוני תקן (z)."], []),
        t("math-h2-t5", ["Probability & Combinatorics", "הסתברות וקומבינטוריקה"], ["Permutations, combinations, conditional probability and Bayes theorem.", "תמורות, צירופים, הסתברות מותנית ונוסחת בייס."], ["math-h2-t4"]),
      ]),
    ],
  },
  {
    id: "math-college", subject: "math", band: "college",
    units: [
      u("math-col-u1", ["Calculus I", "חשבון אינפיניטסימלי I"], [
        t("math-col-t1", ["Limits & Continuity", "גבולות ורציפות"], ["Formal definition of limits, one-sided limits and continuity of functions.", "ההגדרה הפורמלית של גבול, גבולות חד-צדדיים ורציפות של פונקציות."], []),
        t("math-col-t2", ["Differentiation", "גזירה"], ["Power rule, chain rule, product/quotient rule and implicit differentiation.", "כלל החזקה, כלל השרשרת, כללי המכפלה והמנה וגזירה סתומה."], ["math-col-t1"]),
        t("math-col-t3", ["Applications of Derivatives", "שימושי הנגזרת"], ["Related rates, optimization, curve sketching and Mean Value Theorem.", "קצבים קשורים, בעיות קיצון, חקירת פונקציות ומשפט הערך הממוצע."], ["math-col-t2"]),
      ]),
      u("math-col-u2", ["Calculus II", "חשבון אינפיניטסימלי II"], [
        t("math-col-t4", ["Integration", "אינטגרציה"], ["Antiderivatives, Riemann sums, the Fundamental Theorem of Calculus.", "פונקציות קדומות, סכומי רימן והמשפט היסודי של החשבון האינפיניטסימלי."], ["math-col-t2"]),
        t("math-col-t5", ["Techniques of Integration", "שיטות אינטגרציה"], ["Substitution, integration by parts and partial fractions.", "הצבה, אינטגרציה בחלקים ופירוק לשברים חלקיים."], ["math-col-t4"]),
      ]),
    ],
  },
  {
    id: "science-kinder", subject: "science", band: "k",
    units: [
      u("sci-k-u1", ["Living Things", "יצורים חיים"], [
        t("sci-k-t1", ["Plants & Animals", "צמחים ובעלי חיים"], ["What living things need: water, food, sunlight and air.", "מה יצורים חיים צריכים: מים, מזון, אור שמש ואוויר."], []),
        t("sci-k-t2", ["My Five Senses", "חמשת החושים שלי"], ["Using sight, hearing, touch, taste and smell to explore the world.", "משתמשים בראייה, שמיעה, מגע, טעם וריח כדי לחקור את העולם."], []),
      ]),
      u("sci-k-u2", ["Earth & Weather", "כדור הארץ ומזג האוויר"], [
        t("sci-k-t3", ["Weather & Seasons", "מזג אוויר ועונות השנה"], ["Recognizing sunny, rainy, snowy and windy weather and the four seasons.", "מזהים מזג אוויר שמשי, גשום, מושלג וסוער, ואת ארבע עונות השנה."], []),
        t("sci-k-t4", ["Materials Around Us", "חומרים סביבנו"], ["Hard vs soft, rough vs smooth — describing materials by their properties.", "קשה ורך, מחוספס וחלק — מתארים חומרים לפי התכונות שלהם."], []),
      ]),
    ],
  },
  {
    id: "science-elem13", subject: "science", band: "1-3",
    units: [
      u("sci-e13-u1", ["Life Science", "מדעי החיים"], [
        t("sci-e13-t1", ["Plant Life Cycles", "מחזור החיים של הצמח"], ["Seed, sprout, plant, flower, fruit — stages of plant growth.", "זרע, נבט, צמח, פרח ופרי — שלבי הגדילה של הצמח."], []),
        t("sci-e13-t2", ["Animal Adaptations", "התאמות של בעלי חיים"], ["How animals use their body parts and behaviors to survive.", "איך בעלי חיים משתמשים באברי הגוף ובהתנהגות שלהם כדי לשרוד."], ["sci-e13-t1"]),
      ]),
      u("sci-e13-u2", ["Earth & Physical Science", "מדעי כדור הארץ והפיזיקה"], [
        t("sci-e13-t3", ["States of Matter", "מצבי צבירה"], ["Solids, liquids and gases — properties and how matter changes state.", "מוצק, נוזל וגז — התכונות שלהם ואיך חומר עובר ממצב למצב."], []),
        t("sci-e13-t4", ["Forces & Motion", "כוחות ותנועה"], ["Pushes, pulls, gravity and how forces change the motion of objects.", "דחיפה, משיכה, כוח המשיכה ואיך כוחות משנים את תנועת הגופים."], []),
        t("sci-e13-t5", ["Weather & Water Cycle", "מזג האוויר ומחזור המים"], ["Evaporation, condensation, precipitation and the water cycle.", "התאדות, התעבות, משקעים ומחזור המים בטבע."], []),
      ]),
    ],
  },
  {
    id: "science-elem46", subject: "science", band: "4-6",
    units: [
      u("sci-elem-u1", ["Life Science", "מדעי החיים"], [
        t("sci-elem-t1", ["Ecosystems & Food Webs", "מערכות אקולוגיות ומארגי מזון"], ["Producers, consumers, decomposers and energy flow through food chains.", "יצרנים, צרכנים, מפרקים ומעבר האנרגיה בשרשראות המזון."], []),
        t("sci-elem-t2", ["Cells: Building Blocks of Life", "התא: אבן הבניין של החיים"], ["Plant vs animal cells, organelles and what each part does.", "תא צמחי ותא בעל חיים, האברונים ותפקידו של כל חלק."], ["sci-elem-t1"]),
      ]),
      u("sci-elem-u2", ["Earth & Space Science", "מדעי כדור הארץ והחלל"], [
        t("sci-elem-t3", ["Earth's Layers & Plate Tectonics", "שכבות כדור הארץ וטקטוניקת הלוחות"], ["Crust, mantle, core; earthquakes, volcanoes and continental drift.", "קרום, מעטפת וגלעין; רעידות אדמה, הרי געש ונדידת היבשות."], []),
        t("sci-elem-t4", ["Solar System & Space", "מערכת השמש והחלל"], ["The eight planets, the moon, stars, gravity and the scale of the solar system.", "שמונת כוכבי הלכת, הירח, הכוכבים, כוח המשיכה וגודלה של מערכת השמש."], ["sci-elem-t3"]),
      ]),
    ],
  },
  {
    id: "science-middle", subject: "science", band: "7-8",
    units: [
      u("sci-mid-u1", ["Life Science", "מדעי החיים"], [
        t("sci-mid-t1", ["Cell Biology & Mitosis", "ביולוגיה של התא ומיטוזה"], ["Cell division, DNA replication and how organisms grow and repair.", "חלוקת התא, שכפול DNA ואיך יצורים גדלים ומתקנים את עצמם."], []),
        t("sci-mid-t2", ["Genetics & Heredity", "גנטיקה ותורשה"], ["Dominant/recessive traits, Punnett squares and basic inheritance patterns.", "תכונות שולטות ונסגרות, ריבועי פאנט ודפוסי תורשה בסיסיים."], ["sci-mid-t1"]),
        t("sci-mid-t3", ["Evolution & Natural Selection", "אבולוציה וברירה טבעית"], ["Darwin's theory, adaptations, fossils and evidence for evolution.", "התאוריה של דרווין, התאמות, מאובנים והראיות לאבולוציה."], ["sci-mid-t2"]),
      ]),
      u("sci-mid-u2", ["Physical Science", "מדעים פיזיקליים"], [
        t("sci-mid-t4", ["Atoms & the Periodic Table", "אטומים והטבלה המחזורית"], ["Atomic structure, elements, compounds and reading the periodic table.", "מבנה האטום, יסודות, תרכובות וקריאת הטבלה המחזורית."], []),
        t("sci-mid-t5", ["Forces, Motion & Energy", "כוחות, תנועה ואנרגיה"], ["Newton's laws, speed, velocity, acceleration and types of energy.", "חוקי ניוטון, מהירות, מהירות וקטורית, תאוצה וסוגי אנרגיה."], ["sci-mid-t4"]),
        t("sci-mid-t6", ["Waves & Light", "גלים ואור"], ["Properties of waves, the electromagnetic spectrum and optics basics.", "תכונות של גלים, הספקטרום האלקטרומגנטי ויסודות האופטיקה."], ["sci-mid-t5"]),
      ]),
    ],
  },
  {
    id: "science-high910", subject: "science", band: "9-10",
    units: [
      u("sci-h-u1", ["Biology", "ביולוגיה"], [
        t("sci-h-t1", ["Cell Structure & Function", "מבנה התא ותפקודו"], ["Organelles, membranes, cell transport and enzyme function.", "אברונים, ממברנות, מעבר חומרים בתא ופעולת אנזימים."], []),
        t("sci-h-t2", ["DNA, Genes & Protein Synthesis", "DNA, גנים וסינתזת חלבונים"], ["DNA replication, transcription, translation and gene expression.", "שכפול DNA, שעתוק, תרגום וביטוי גנים."], ["sci-h-t1"]),
        t("sci-h-t3", ["Photosynthesis & Cellular Respiration", "פוטוסינתזה ונשימה תאית"], ["Light and dark reactions, ATP, glycolysis and the Krebs cycle.", "שלבי האור והחושך, ATP, גליקוליזה ומעגל קרבס."], ["sci-h-t1"]),
      ]),
      u("sci-h-u2", ["Chemistry", "כימיה"], [
        t("sci-h-t4", ["Atomic Structure & Periodic Table", "מבנה האטום והטבלה המחזורית"], ["Electron configurations, periodic trends and why elements are arranged as they are.", "מבנה אלקטרוני, מגמות בטבלה ולמה היסודות מסודרים כפי שהם."], []),
        t("sci-h-t5", ["Chemical Bonding & Reactions", "קשרים כימיים ותגובות"], ["Ionic, covalent, metallic bonds; balancing equations and reaction types.", "קשר יוני, קוולנטי ומתכתי; איזון משוואות וסוגי תגובות."], ["sci-h-t4"]),
        t("sci-h-t6", ["Stoichiometry", "סטויכיומטריה"], ["Molar mass, the mole concept and calculating reactants/products.", "מסה מולרית, מושג המול וחישוב כמויות של מגיבים ותוצרים."], ["sci-h-t5"]),
      ]),
    ],
  },
  {
    id: "science-high1112", subject: "science", band: "11-12",
    units: [
      u("sci-h2-u1", ["Physics", "פיזיקה"], [
        t("sci-h2-t1", ["Kinematics & Dynamics", "קינמטיקה ודינמיקה"], ["Equations of motion, Newton's laws and free-body diagrams.", "משוואות התנועה, חוקי ניוטון ותרשימי כוחות."], []),
        t("sci-h2-t2", ["Energy, Work & Power", "אנרגיה, עבודה והספק"], ["Kinetic and potential energy, conservation of energy, momentum.", "אנרגיה קינטית ופוטנציאלית, שימור אנרגיה ותנע."], ["sci-h2-t1"]),
        t("sci-h2-t3", ["Electricity & Magnetism", "חשמל ומגנטיות"], ["Charge, electric fields, circuits, Ohm's law and magnetic forces.", "מטען, שדות חשמליים, מעגלים, חוק אוהם וכוחות מגנטיים."], ["sci-h2-t2"]),
      ]),
      u("sci-h2-u2", ["Advanced Chemistry", "כימיה מתקדמת"], [
        t("sci-h2-t4", ["Thermodynamics", "תרמודינמיקה"], ["Enthalpy, entropy, Gibbs free energy and spontaneous reactions.", "אנתלפיה, אנטרופיה, אנרגיה חופשית של גיבס ותגובות ספונטניות."], []),
        t("sci-h2-t5", ["Equilibrium & Acid-Base Chemistry", "שיווי משקל וחומצות ובסיסים"], ["Le Chatelier's principle, pH, buffers and titrations.", "עקרון לה-שטלייה, pH, תמיסות בופר וטיטרציות."], ["sci-h2-t4"]),
      ]),
    ],
  },
  {
    id: "science-college", subject: "science", band: "college",
    units: [
      u("sci-col-u1", ["General Chemistry", "כימיה כללית"], [
        t("sci-col-t1", ["Quantum Mechanics & Atomic Theory", "מכניקת הקוונטים ותורת האטום"], ["Wave functions, orbitals, the Schrödinger equation and quantum numbers.", "פונקציות גל, אורביטלים, משוואת שרדינגר ומספרים קוונטיים."], []),
        t("sci-col-t2", ["Chemical Kinetics", "קינטיקה כימית"], ["Reaction rates, rate laws, activation energy and the Arrhenius equation.", "קצב תגובה, חוקי קצב, אנרגיית שפעול ומשוואת ארניוס."], ["sci-col-t1"]),
      ]),
      u("sci-col-u2", ["General Biology", "ביולוגיה כללית"], [
        t("sci-col-t3", ["Molecular Biology", "ביולוגיה מולקולרית"], ["CRISPR, gene regulation, epigenetics and recombinant DNA technology.", "CRISPR, בקרת ביטוי גנים, אפיגנטיקה וטכנולוגיית DNA רקומביננטי."], []),
        t("sci-col-t4", ["Ecology & Evolution", "אקולוגיה ואבולוציה"], ["Population dynamics, speciation, phylogenetics and biome analysis.", "דינמיקה של אוכלוסיות, היווצרות מינים, פילוגנטיקה וניתוח ביומים."], ["sci-col-t3"]),
      ]),
    ],
  },
  {
    id: "geo-kinder", subject: "geography", band: "k",
    units: [
      u("geo-k-u1", ["My World Around Me", "העולם שסביבי"], [
        t("geo-k-t1", ["Maps of My Home", "מפה של הבית שלי"], ["What is a map? Drawing simple maps of my room, home and classroom.", "מה זו מפה? משרטטים מפות פשוטות של החדר, הבית והכיתה."], []),
        t("geo-k-t2", ["Land & Water", "יבשה ומים"], ["Recognizing mountains, rivers, lakes, forests and oceans in pictures and our world.", "מזהים הרים, נהרות, אגמים, יערות ואוקיינוסים בתמונות ובעולם."], ["geo-k-t1"]),
        t("geo-k-t3", ["Weather & Seasons", "מזג אוויר ועונות"], ["Hot vs cold places, rain vs snow, and why we have four seasons.", "מקומות חמים וקרים, גשם ושלג, ולמה יש ארבע עונות."], []),
      ]),
    ],
  },
  {
    id: "geo-elem13", subject: "geography", band: "1-3",
    units: [
      u("geo-e13-u1", ["Maps & Globes", "מפות וגלובוסים"], [
        t("geo-e13-t1", ["Reading Maps", "קריאת מפות"], ["Map keys, compass roses, symbols and the four cardinal directions (N/S/E/W).", "מקרא, שושנת רוחות, סמלים וארבעת כיווני השמיים."], []),
        t("geo-e13-t2", ["Continents & Oceans", "יבשות ואוקיינוסים"], ["The seven continents and the five oceans — names, locations and basic facts.", "שבע היבשות וחמשת האוקיינוסים — שמות, מיקום ועובדות בסיסיות."], ["geo-e13-t1"]),
        t("geo-e13-t3", ["My Country & Neighbors", "הארץ שלי והשכנות שלה"], ["Locating my country, its capital and the countries that border it.", "מאתרים את המדינה שלי, את בירתה ואת המדינות הגובלות בה."], ["geo-e13-t2"]),
      ]),
      u("geo-e13-u2", ["Natural World", "עולם הטבע"], [
        t("geo-e13-t4", ["Landforms", "תבליטי נוף"], ["Mountains, hills, valleys, plains, deserts, peninsulas and islands.", "הרים, גבעות, עמקים, מישורים, מדבריות, חצאי איים ואיים."], []),
        t("geo-e13-t5", ["Bodies of Water", "גופי מים"], ["Oceans, seas, rivers, lakes and glaciers — how they shape our planet.", "אוקיינוסים, ימים, נהרות, אגמים וקרחונים — איך הם מעצבים את כדור הארץ."], ["geo-e13-t4"]),
      ]),
    ],
  },
  {
    id: "geo-elem46", subject: "geography", band: "4-6",
    units: [
      u("geo-e46-u1", ["Physical Geography", "גאוגרפיה פיזית"], [
        t("geo-e46-t1", ["Climate Zones & Biomes", "אזורי אקלים וביומים"], ["Tropical, temperate and polar zones; rainforests, deserts, grasslands, tundra and forests.", "אזור טרופי, ממוזג וקוטבי; יערות גשם, מדבריות, ערבות, טונדרה ויערות."], []),
        t("geo-e46-t2", ["Latitude & Longitude", "קווי רוחב ואורך"], ["The grid of the Earth: equator, prime meridian, hemispheres and finding any place by coordinates.", "רשת כדור הארץ: קו המשווה, קו האורך הראשי, חצאי כדור ומציאת כל מקום לפי קואורדינטות."], ["geo-e46-t1"]),
      ]),
      u("geo-e46-u2", ["World Regions", "אזורי העולם"], [
        t("geo-e46-t3", ["Countries & Capitals", "מדינות ובירות"], ["Major countries of each continent with their capitals, flags and main languages.", "מדינות מרכזיות בכל יבשת, הבירות, הדגלים והשפות העיקריות שלהן."], []),
        t("geo-e46-t4", ["World Cultures", "תרבויות העולם"], ["How people live differently around the world: food, clothing, customs and traditions.", "איך אנשים חיים אחרת ברחבי העולם: אוכל, לבוש, מנהגים ומסורות."], ["geo-e46-t3"]),
        t("geo-e46-t5", ["Natural Wonders", "פלאי הטבע"], ["Famous landmarks of the natural world: Amazon, Sahara, Everest, Great Barrier Reef and more.", "אתרי טבע מפורסמים: האמזונס, הסהרה, האוורסט, שונית המחסום הגדולה ועוד."], []),
      ]),
    ],
  },
  {
    id: "geo-middle", subject: "geography", band: "7-8",
    units: [
      u("geo-mid-u1", ["Earth Systems", "מערכות כדור הארץ"], [
        t("geo-mid-t1", ["Plate Tectonics", "טקטוניקת הלוחות"], ["How continents move, why earthquakes happen and how mountains and volcanoes form.", "איך היבשות זזות, למה יש רעידות אדמה ואיך נוצרים הרים והרי געש."], []),
        t("geo-mid-t2", ["Climate & Weather", "אקלים ומזג אוויר"], ["The atmosphere, weather vs climate, ocean currents and the water cycle.", "האטמוספרה, ההבדל בין מזג אוויר לאקלים, זרמי ים ומחזור המים."], ["geo-mid-t1"]),
        t("geo-mid-t3", ["Climate Change", "שינויי אקלים"], ["Greenhouse effect, carbon cycle, evidence of warming and global impacts.", "אפקט החממה, מחזור הפחמן, הראיות להתחממות וההשפעות על העולם."], ["geo-mid-t2"]),
      ]),
      u("geo-mid-u2", ["Human Geography", "גאוגרפיה של האדם"], [
        t("geo-mid-t4", ["Population & Migration", "אוכלוסייה והגירה"], ["Where people live and why; push/pull factors that drive migration.", "איפה אנשים גרים ולמה; גורמי דחייה ומשיכה שמניעים הגירה."], []),
        t("geo-mid-t5", ["Resources & Trade", "משאבים וסחר"], ["Renewable vs non-renewable resources; how goods move between countries.", "משאבים מתחדשים ומתכלים; איך סחורות עוברות בין מדינות."], ["geo-mid-t4"]),
      ]),
    ],
  },
  {
    id: "geo-high910", subject: "geography", band: "9-10",
    units: [
      u("geo-h1-u1", ["World Regional Geography", "גאוגרפיה אזורית של העולם"], [
        t("geo-h1-t1", ["Europe & Russia", "אירופה ורוסיה"], ["Physical features, political boundaries, the EU and major cultural regions.", "מאפיינים פיזיים, גבולות מדיניים, האיחוד האירופי ואזורי תרבות מרכזיים."], []),
        t("geo-h1-t2", ["Asia & Middle East", "אסיה והמזרח התיכון"], ["East, South and Southeast Asia plus the Middle East: physical, political and economic geography.", "מזרח, דרום ודרום-מזרח אסיה והמזרח התיכון: גאוגרפיה פיזית, מדינית וכלכלית."], ["geo-h1-t1"]),
      ]),
      u("geo-h1-u2", ["Geopolitics", "גאופוליטיקה"], [
        t("geo-h1-t3", ["Borders & Sovereignty", "גבולות וריבונות"], ["How borders are drawn, disputed territories and what makes a country a country.", "איך משרטטים גבולות, שטחים שנויים במחלוקת ומה הופך מדינה למדינה."], []),
        t("geo-h1-t4", ["Globalization", "גלובליזציה"], ["How transport, trade and technology connect places and reshape local cultures.", "איך תחבורה, סחר וטכנולוגיה מחברים מקומות ומשנים תרבויות מקומיות."], ["geo-h1-t3"]),
      ]),
    ],
  },
  {
    id: "geo-high1112", subject: "geography", band: "11-12",
    units: [
      u("geo-h2-u1", ["AP Human Geography", "גאוגרפיה של האדם (מתקדם)"], [
        t("geo-h2-t1", ["Demographic Transition", "המעבר הדמוגרפי"], ["Birth rates, death rates and how populations change as countries develop.", "שיעורי ילודה ותמותה ואיך אוכלוסיות משתנות כשמדינות מתפתחות."], []),
        t("geo-h2-t2", ["Urban Patterns", "דפוסים עירוניים"], ["How cities grow: concentric zones, sector and multiple-nuclei models, megacities.", "איך ערים גדלות: מודל המעגלים, מודל הסקטורים, מודל הגרעינים המרובים ומגה-ערים."], ["geo-h2-t1"]),
      ]),
      u("geo-h2-u2", ["Environmental Geography", "גאוגרפיה סביבתית"], [
        t("geo-h2-t3", ["Sustainability & Resources", "קיימות ומשאבים"], ["Carrying capacity, sustainable development and managing finite resources.", "כושר נשיאה, פיתוח בר-קיימא וניהול משאבים מוגבלים."], []),
        t("geo-h2-t4", ["Biodiversity & Conservation", "מגוון ביולוגי ושימור"], ["Why ecosystems matter, threats to biodiversity and conservation strategies.", "למה מערכות אקולוגיות חשובות, האיומים על המגוון הביולוגי ודרכי שימור."], ["geo-h2-t3"]),
      ]),
    ],
  },
  {
    id: "geo-college", subject: "geography", band: "college",
    units: [
      u("geo-col-u1", ["Geographic Analysis", "ניתוח גאוגרפי"], [
        t("geo-col-t1", ["Geographic Information Systems (GIS)", "מערכות מידע גאוגרפיות (GIS)"], ["Map layers, spatial data, georeferencing and basic GIS analysis.", "שכבות מפה, נתונים מרחביים, גאו-רפרנס וניתוח GIS בסיסי."], []),
        t("geo-col-t2", ["Cartography", "קרטוגרפיה"], ["Map projections, scale, generalization and the principles of map design.", "היטלי מפה, קנה מידה, הכללה ועקרונות עיצוב מפות."], ["geo-col-t1"]),
      ]),
    ],
  },
  {
    id: "history-kinder", subject: "history", band: "k",
    units: [
      u("hist-k-u1", ["My World", "העולם שלי"], [
        t("hist-k-t1", ["Me, My Family & My Community", "אני, המשפחה שלי והקהילה שלי"], ["Who I am, my family, my neighborhood and the helpers in my community.", "מי אני, המשפחה שלי, השכונה שלי והאנשים שעוזרים בקהילה."], []),
        t("hist-k-t2", ["Holidays & Traditions", "חגים ומסורות"], ["Cultural celebrations, national holidays and why we observe them.", "חגיגות תרבותיות, חגים לאומיים ולמה אנחנו מציינים אותם."], []),
      ]),
    ],
  },
  {
    id: "history-elem13", subject: "history", band: "1-3",
    units: [
      u("hist-e13-u1", ["American History Basics", "יסודות ההיסטוריה האמריקנית"], [
        t("hist-e13-t1", ["American Symbols & Government", "סמלים וממשל בארה\"ב"], ["The flag, the Pledge, the Constitution, the President and how our government works.", "הדגל, שבועת האמונים, החוקה, הנשיא ואיך הממשל עובד."], []),
        t("hist-e13-t2", ["Native Americans & Early Explorers", "הילידים האמריקנים והמגלים הראשונים"], ["Native American cultures and the arrival of European explorers.", "תרבויות הילידים בצפון אמריקה והגעתם של המגלים האירופים."], []),
        t("hist-e13-t3", ["Maps & Geography", "מפות וגאוגרפיה"], ["Reading maps, the seven continents, four oceans and compass directions.", "קריאת מפות, שבע היבשות, האוקיינוסים וכיווני המצפן."], []),
      ]),
    ],
  },
  {
    id: "history-elem46", subject: "history", band: "4-6",
    units: [
      u("hist-e46-u1", ["US History", "היסטוריה של ארה\"ב"], [
        t("hist-e46-t1", ["Colonial America & Revolution", "אמריקה הקולוניאלית והמהפכה"], ["The thirteen colonies, causes of the Revolution and the Declaration of Independence.", "שלוש-עשרה המושבות, הסיבות למהפכה והכרזת העצמאות."], []),
        t("hist-e46-t2", ["Westward Expansion", "ההתפשטות מערבה"], ["Manifest Destiny, the Oregon Trail and the impact on Native Americans.", "\"הייעוד הגלוי\", שביל אורגון וההשפעה על הילידים האמריקנים."], ["hist-e46-t1"]),
        t("hist-e46-t3", ["Civil War & Reconstruction", "מלחמת האזרחים והשיקום"], ["Causes of the Civil War, key battles, emancipation and Reconstruction.", "הסיבות למלחמת האזרחים, הקרבות המרכזיים, שחרור העבדים ותקופת השיקום."], ["hist-e46-t2"]),
      ]),
    ],
  },
  {
    id: "history-middle", subject: "history", band: "7-8",
    units: [
      u("hist-mid-u1", ["World History", "היסטוריה עולמית"], [
        t("hist-mid-t1", ["Ancient Civilizations", "תרבויות עתיקות"], ["Mesopotamia, Ancient Egypt, Greece and Rome — government, culture and legacy.", "מסופוטמיה, מצרים העתיקה, יוון ורומא — שלטון, תרבות ומורשת."], []),
        t("hist-mid-t2", ["Medieval World", "ימי הביניים"], ["Feudal Europe, Byzantine Empire, Islamic Golden Age and the Mongol Empire.", "אירופה הפאודלית, האימפריה הביזנטית, תור הזהב של האסלאם והאימפריה המונגולית."], ["hist-mid-t1"]),
        t("hist-mid-t3", ["Renaissance & Reformation", "הרנסנס והרפורמציה"], ["Art, science and religious change in early modern Europe.", "אמנות, מדע ושינוי דתי באירופה של ראשית העת החדשה."], ["hist-mid-t2"]),
      ]),
      u("hist-mid-u2", ["Geography & Civics", "גאוגרפיה ואזרחות"], [
        t("hist-mid-t4", ["World Geography", "גאוגרפיה של העולם"], ["Physical and political geography: regions, climate zones and human environment interaction.", "גאוגרפיה פיזית ומדינית: אזורים, אזורי אקלים והקשר בין האדם לסביבה."], []),
        t("hist-mid-t5", ["Government & Civics", "ממשל ואזרחות"], ["Types of government, the US Constitution, rights and responsibilities of citizens.", "סוגי משטר, חוקה, זכויות וחובות של אזרחים."], []),
      ]),
    ],
  },
  {
    id: "history-high910", subject: "history", band: "9-10",
    units: [
      u("hist-h-u1", ["Modern World History", "היסטוריה עולמית מודרנית"], [
        t("hist-h-t1", ["Age of Revolution", "עידן המהפכות"], ["The American, French and Haitian revolutions and the spread of democratic ideals.", "המהפכה האמריקנית, הצרפתית וההאיטית והתפשטות הרעיונות הדמוקרטיים."], []),
        t("hist-h-t2", ["Imperialism & Industrialization", "אימפריאליזם ותיעוש"], ["European imperialism, colonialism, the Industrial Revolution and its global impact.", "האימפריאליזם האירופי, הקולוניאליזם, המהפכה התעשייתית והשפעתה על העולם."], ["hist-h-t1"]),
        t("hist-h-t3", ["World Wars", "מלחמות העולם"], ["Causes, major events, the Holocaust and consequences of WWI and WWII.", "הסיבות, האירועים המרכזיים, השואה והתוצאות של מלחמת העולם הראשונה והשנייה."], ["hist-h-t2"]),
      ]),
      u("hist-h-u2", ["Post-War World", "העולם שאחרי המלחמה"], [
        t("hist-h-t4", ["Cold War", "המלחמה הקרה"], ["US-Soviet rivalry, proxy wars, the arms race and détente.", "היריבות בין ארה\"ב לברית המועצות, מלחמות שליחים, מרוץ החימוש והפשרת המתיחות."], ["hist-h-t3"]),
        t("hist-h-t5", ["Decolonization & Civil Rights", "דה-קולוניזציה וזכויות האזרח"], ["Independence movements in Africa and Asia; civil rights in America.", "תנועות עצמאות באפריקה ובאסיה; המאבק לזכויות האזרח בארה\"ב."], ["hist-h-t4"]),
      ]),
    ],
  },
  {
    id: "history-high1112", subject: "history", band: "11-12",
    units: [
      u("hist-h2-u1", ["US History", "היסטוריה של ארה\"ב"], [
        t("hist-h2-t1", ["Progressive Era & New Deal", "העידן הפרוגרסיבי והניו דיל"], ["Reform movements, the Great Depression and FDR's response.", "תנועות רפורמה, השפל הגדול והתגובה של רוזוולט."], []),
        t("hist-h2-t2", ["Post-War America", "אמריקה שאחרי המלחמה"], ["The 1950s boom, counterculture, Vietnam War and the Great Society.", "השגשוג של שנות ה-50, תרבות הנגד, מלחמת וייטנאם ו\"החברה הגדולה\"."], ["hist-h2-t1"]),
        t("hist-h2-t3", ["America in the Modern World", "אמריקה בעולם המודרני"], ["9/11, the War on Terror, globalization and political polarization.", "11 בספטמבר, המלחמה בטרור, גלובליזציה וקיטוב פוליטי."], ["hist-h2-t2"]),
      ]),
      u("hist-h2-u2", ["Government & Politics", "ממשל ופוליטיקה"], [
        t("hist-h2-t4", ["AP US Government", "ממשל ארה\"ב"], ["Branches of government, federalism, civil liberties and landmark Supreme Court cases.", "רשויות השלטון, פדרליזם, חירויות האזרח ופסקי דין מכוננים של בית המשפט העליון."], []),
        t("hist-h2-t5", ["Comparative Politics", "פוליטיקה השוואתית"], ["Comparing democratic systems, authoritarian regimes and international relations.", "השוואה בין שיטות דמוקרטיות, משטרים אוטוריטריים ויחסים בינלאומיים."], []),
      ]),
    ],
  },
  {
    id: "history-college", subject: "history", band: "college",
    units: [
      u("hist-col-u1", ["World History Survey", "סקירת היסטוריה עולמית"], [
        t("hist-col-t1", ["From Prehistory to 1500", "מהפרהיסטוריה עד 1500"], ["Human migration, early civilizations, trade networks and cultural exchange to 1500 CE.", "נדידת האדם, תרבויות קדומות, רשתות סחר וחילופי תרבות עד שנת 1500."], []),
        t("hist-col-t2", ["1500 to the Present", "מ-1500 ועד היום"], ["Global contact, colonialism, revolutions, world wars and the contemporary world.", "מגע עולמי, קולוניאליזם, מהפכות, מלחמות העולם והעולם בן זמננו."], ["hist-col-t1"]),
      ]),
    ],
  },
  {
    id: "coding-kinder", subject: "coding", band: "k",
    units: [
      u("code-k-u1", ["Intro to Computers", "מבוא למחשבים"], [
        t("code-k-t1", ["What is a Computer?", "מה זה מחשב?"], ["Parts of a computer: screen, keyboard, mouse and what each part does.", "חלקי המחשב: מסך, מקלדת ועכבר, ומה כל חלק עושה."], []),
        t("code-k-t2", ["Sequences & Algorithms", "רצפים ואלגוריתמים"], ["Following step-by-step instructions; putting steps in the right order.", "ממלאים הוראות צעד אחר צעד ומסדרים צעדים בסדר הנכון."], []),
        t("code-k-t3", ["Patterns & Loops", "דפוסים ולולאות"], ["Repeating patterns in the world and in simple programs (using tools like ScratchJr).", "דפוסים שחוזרים בעולם ובתוכניות פשוטות (בכלים כמו ScratchJr)."], ["code-k-t2"]),
      ]),
    ],
  },
  {
    id: "coding-elem13", subject: "coding", band: "1-3",
    units: [
      u("code-e13-u1", ["Block-Based Coding", "תכנות בבלוקים"], [
        t("code-e13-t1", ["Sequences & Events", "רצפים ואירועים"], ["Writing sequences of commands and triggering actions with events in Scratch.", "כותבים רצפי פקודות ומפעילים פעולות בעזרת אירועים בסקראץ'."], []),
        t("code-e13-t2", ["Loops & Repetition", "לולאות וחזרה"], ["Using repeat loops to avoid rewriting the same code over and over.", "משתמשים בלולאת \"חזור\" כדי לא לכתוב את אותו הקוד שוב ושוב."], ["code-e13-t1"]),
        t("code-e13-t3", ["Conditionals", "תנאים"], ["If/else blocks: making programs respond to conditions and user input.", "בלוקים של \"אם/אחרת\": תוכניות שמגיבות לתנאים ולקלט של המשתמש."], ["code-e13-t2"]),
      ]),
    ],
  },
  {
    id: "coding-elem46", subject: "coding", band: "4-6",
    units: [
      u("code-e46-u1", ["Scratch & Intro to Python", "סקראץ' ומבוא לפייתון"], [
        t("code-e46-t1", ["Advanced Scratch Projects", "פרויקטים מתקדמים בסקראץ'"], ["Building games and animations with sprites, variables and broadcasts in Scratch.", "בונים משחקים ואנימציות עם דמויות, משתנים ומסרים בסקראץ'."], []),
        t("code-e46-t2", ["Intro to Python", "מבוא לפייתון"], ["First Python programs: print, input, variables and basic arithmetic.", "תוכניות פייתון ראשונות: print, input, משתנים וחשבון בסיסי."], ["code-e46-t1"]),
        t("code-e46-t3", ["Loops & Conditionals in Python", "לולאות ותנאים בפייתון"], ["for/while loops, if/elif/else and writing programs that make decisions.", "לולאות for ו-while, if/elif/else ותוכניות שמקבלות החלטות."], ["code-e46-t2"]),
      ]),
    ],
  },
  {
    id: "coding-middle", subject: "coding", band: "7-8",
    units: [
      u("code-mid-u1", ["Python Programming", "תכנות בפייתון"], [
        t("code-mid-t1", ["Variables & Data Types", "משתנים וטיפוסי נתונים"], ["Strings, integers, floats, booleans and type conversion in Python.", "מחרוזות, מספרים שלמים, מספרים עשרוניים, בוליאנים והמרת טיפוסים בפייתון."], []),
        t("code-mid-t2", ["Control Flow", "בקרת זרימה"], ["if/elif/else, for loops, while loops and nested structures.", "if/elif/else, לולאות for, לולאות while ומבנים מקוננים."], ["code-mid-t1"]),
        t("code-mid-t3", ["Functions & Scope", "פונקציות ותחום הכרה"], ["Defining functions, parameters, return values and variable scope.", "הגדרת פונקציות, פרמטרים, ערכי החזרה ותחום ההכרה של משתנים."], ["code-mid-t2"]),
      ]),
      u("code-mid-u2", ["Data Structures", "מבני נתונים"], [
        t("code-mid-t4", ["Lists & Tuples", "רשימות ו-tuple"], ["Indexing, slicing, list methods and when to use tuples.", "גישה לפי אינדקס, חיתוך, מתודות של רשימות ומתי להשתמש ב-tuple."], ["code-mid-t2"]),
        t("code-mid-t5", ["Dictionaries & Sets", "מילונים וקבוצות"], ["Key-value pairs, dictionary methods and set operations.", "זוגות מפתח-ערך, מתודות של מילון ופעולות על קבוצות."], ["code-mid-t4"]),
        t("code-mid-t6", ["File I/O & Error Handling", "קבצים וטיפול בשגיאות"], ["Reading/writing files, try/except blocks and debugging strategies.", "קריאה וכתיבה של קבצים, try/except ואסטרטגיות לניפוי באגים."], ["code-mid-t3"]),
      ]),
    ],
  },
  {
    id: "coding-high910", subject: "coding", band: "9-10",
    units: [
      u("code-h1-u1", ["Object-Oriented Programming", "תכנות מונחה עצמים"], [
        t("code-h1-t1", ["Classes & Objects", "מחלקות ואובייקטים"], ["Defining classes, creating objects, attributes and methods in Python or Java.", "הגדרת מחלקות, יצירת אובייקטים, תכונות ומתודות בפייתון או בג'אווה."], []),
        t("code-h1-t2", ["Inheritance & Polymorphism", "ירושה ופולימורפיזם"], ["Extending classes, method overriding and using polymorphism.", "הרחבת מחלקות, דריסת מתודות ושימוש בפולימורפיזם."], ["code-h1-t1"]),
        t("code-h1-t3", ["Intro to Algorithms", "מבוא לאלגוריתמים"], ["Sorting algorithms (bubble, selection, merge), Big-O notation and efficiency.", "אלגוריתמי מיון (בועות, בחירה, מיזוג), סימון O גדול ויעילות."], ["code-h1-t2"]),
      ]),
      u("code-h1-u2", ["Web Development", "פיתוח אתרים"], [
        t("code-h1-t4", ["HTML & CSS", "HTML ו-CSS"], ["Building web pages with HTML structure and CSS styling.", "בניית דפי אינטרנט עם מבנה ב-HTML ועיצוב ב-CSS."], []),
        t("code-h1-t5", ["JavaScript Basics", "יסודות JavaScript"], ["Variables, functions, DOM manipulation and event handling.", "משתנים, פונקציות, שינוי ה-DOM וטיפול באירועים."], ["code-h1-t4"]),
      ]),
    ],
  },
  {
    id: "coding-high1112", subject: "coding", band: "11-12",
    units: [
      u("code-h2-u1", ["AP Computer Science", "מדעי המחשב (מתקדם)"], [
        t("code-h2-t1", ["Advanced Data Structures", "מבני נתונים מתקדמים"], ["Stacks, queues, linked lists, trees and hash tables.", "מחסניות, תורים, רשימות מקושרות, עצים וטבלאות גיבוב."], []),
        t("code-h2-t2", ["Recursion", "רקורסיה"], ["Recursive thinking, base cases, recursive algorithms and the call stack.", "חשיבה רקורסיבית, תנאי עצירה, אלגוריתמים רקורסיביים ומחסנית הקריאות."], ["code-h2-t1"]),
        t("code-h2-t3", ["Search & Sort Algorithms", "אלגוריתמי חיפוש ומיון"], ["Binary search, merge sort, quicksort and analyzing time complexity.", "חיפוש בינארי, מיון מיזוג, מיון מהיר וניתוח סיבוכיות זמן."], ["code-h2-t2"]),
      ]),
      u("code-h2-u2", ["Software Engineering", "הנדסת תוכנה"], [
        t("code-h2-t4", ["Version Control & Git", "ניהול גרסאות ו-Git"], ["Using Git and GitHub: commits, branches, merging and pull requests.", "עבודה עם Git ו-GitHub: קומיטים, ענפים, מיזוג ובקשות משיכה."], []),
        t("code-h2-t5", ["Databases & SQL", "מסדי נתונים ו-SQL"], ["Relational databases, SQL queries, joins and basic database design.", "מסדי נתונים יחסיים, שאילתות SQL, צירופים ותכנון בסיסי של מסד נתונים."], []),
      ]),
    ],
  },
  {
    id: "coding-college", subject: "coding", band: "college",
    units: [
      u("code-col-u1", ["Data Structures & Algorithms", "מבני נתונים ואלגוריתמים"], [
        t("code-col-t1", ["Advanced Algorithms", "אלגוריתמים מתקדמים"], ["Dynamic programming, graph algorithms (BFS, DFS, Dijkstra) and greedy methods.", "תכנון דינמי, אלגוריתמים על גרפים (BFS, DFS, דייקסטרה) ושיטות חמדניות."], []),
        t("code-col-t2", ["Computational Complexity", "סיבוכיות חישובית"], ["P vs NP, NP-completeness, reduction proofs and practical limits of computation.", "P מול NP, שלמות ב-NP, הוכחות רדוקציה והגבולות המעשיים של החישוב."], ["code-col-t1"]),
      ]),
      u("code-col-u2", ["Systems & Software", "מערכות ותוכנה"], [
        t("code-col-t3", ["Operating Systems", "מערכות הפעלה"], ["Processes, threads, memory management, virtual memory and the OS scheduler.", "תהליכים, תהליכונים, ניהול זיכרון, זיכרון וירטואלי ומתזמן מערכת ההפעלה."], []),
        t("code-col-t4", ["Software Engineering Principles", "עקרונות הנדסת תוכנה"], ["Agile, design patterns, testing, code review and system design.", "אג'ייל, תבניות עיצוב, בדיקות, סקירת קוד ותכנון מערכות."], []),
      ]),
    ],
  },
  {
    id: "econ-kinder", subject: "economics", band: "k",
    units: [
      u("econ-k-u1", ["Money & Needs", "כסף וצרכים"], [
        t("econ-k-t1", ["Needs vs Wants", "צרכים ורצונות"], ["Distinguishing between things we must have (food, shelter) and things we want.", "מבחינים בין מה שחייבים (אוכל, קורת גג) לבין מה שרוצים."], []),
        t("econ-k-t2", ["Money & Counting Coins", "כסף וספירת מטבעות"], ["Recognizing coins and bills, counting pennies, nickels and dimes.", "מזהים מטבעות ושטרות וסופרים מטבעות."], []),
      ]),
    ],
  },
  {
    id: "econ-elem13", subject: "economics", band: "1-3",
    units: [
      u("econ-e13-u1", ["Community Economics", "כלכלה בקהילה"], [
        t("econ-e13-t1", ["Goods & Services", "מוצרים ושירותים"], ["The difference between goods (things) and services (actions) people buy and sell.", "ההבדל בין מוצרים (דברים) לשירותים (פעולות) שאנשים קונים ומוכרים."], []),
        t("econ-e13-t2", ["Trade & Barter", "סחר וסחר חליפין"], ["How trade works, specialization and why people exchange goods.", "איך סחר עובד, התמחות ולמה אנשים מחליפים ביניהם סחורות."], ["econ-e13-t1"]),
        t("econ-e13-t3", ["Saving Money", "חיסכון בכסף"], ["Why we save, earning and spending and making simple choices with limited money.", "למה חוסכים, להרוויח ולהוציא, ולבחור נכון כשיש מעט כסף."], []),
      ]),
    ],
  },
  {
    id: "econ-elem46", subject: "economics", band: "4-6",
    units: [
      u("econ-e46-u1", ["Basic Economics", "יסודות הכלכלה"], [
        t("econ-e46-t1", ["Scarcity & Choice", "מחסור ובחירה"], ["Resources are limited — people must make choices and face trade-offs.", "המשאבים מוגבלים — אנשים צריכים לבחור ולוותר."], []),
        t("econ-e46-t2", ["Supply, Demand & Price", "היצע, ביקוש ומחיר"], ["Why prices rise and fall based on how much is available and how much people want.", "למה מחירים עולים ויורדים לפי הכמות הזמינה ולפי כמה אנשים רוצים."], ["econ-e46-t1"]),
        t("econ-e46-t3", ["Personal Finance & Budgeting", "כלכלה אישית ותקציב"], ["Income, expenses, savings goals and making a simple budget.", "הכנסות, הוצאות, יעדי חיסכון ובניית תקציב פשוט."], []),
      ]),
    ],
  },
  {
    id: "econ-middle", subject: "economics", band: "7-8",
    units: [
      u("econ-mid-u1", ["Economic Systems", "שיטות כלכליות"], [
        t("econ-mid-t1", ["Types of Economic Systems", "סוגי שיטות כלכליות"], ["Command, market, traditional and mixed economies — how each allocates resources.", "כלכלה ריכוזית, כלכלת שוק, כלכלה מסורתית וכלכלה מעורבת — איך כל אחת מחלקת משאבים."], []),
        t("econ-mid-t2", ["Entrepreneurship", "יזמות"], ["Starting a business, profit, loss, risk and what makes a successful entrepreneur.", "הקמת עסק, רווח, הפסד, סיכון ומה עושה יזם מצליח."], ["econ-mid-t1"]),
      ]),
      u("econ-mid-u2", ["Personal Finance", "כלכלת המשפחה"], [
        t("econ-mid-t3", ["Banking & Saving", "בנקאות וחיסכון"], ["Checking vs savings accounts, interest, compound interest and financial goals.", "חשבון עובר ושב וחשבון חיסכון, ריבית, ריבית דריבית ויעדים כלכליים."], []),
        t("econ-mid-t4", ["Credit & Debt", "אשראי וחוב"], ["How credit cards and loans work, interest rates and the cost of borrowing.", "איך כרטיסי אשראי והלוואות עובדים, שיעורי ריבית והמחיר של לווה."], ["econ-mid-t3"]),
      ]),
    ],
  },
  {
    id: "econ-high910", subject: "economics", band: "9-10",
    units: [
      u("econ-h-u1", ["Microeconomics", "מיקרו-כלכלה"], [
        t("econ-h-t1", ["Supply & Demand", "היצע וביקוש"], ["Market equilibrium, price floors/ceilings and how markets allocate resources.", "שיווי משקל בשוק, מחיר רצפה ומחיר תקרה ואיך שווקים מקצים משאבים."], []),
        t("econ-h-t2", ["Elasticity", "גמישות"], ["Price elasticity of demand and supply; calculating and interpreting elasticity.", "גמישות המחיר של הביקוש ושל ההיצע; חישוב ופירוש של גמישות."], ["econ-h-t1"]),
        t("econ-h-t3", ["Market Structures", "מבני שוק"], ["Perfect competition, monopolistic competition, oligopoly and monopoly.", "תחרות משוכללת, תחרות מונופוליסטית, אוליגופול ומונופול."], ["econ-h-t2"]),
      ]),
      u("econ-h-u2", ["Macroeconomics", "מאקרו-כלכלה"], [
        t("econ-h-t4", ["GDP & Economic Growth", "תוצר וצמיחה כלכלית"], ["Measuring national output, the business cycle and factors of economic growth.", "מדידת התוצר הלאומי, מחזור העסקים והגורמים לצמיחה."], ["econ-h-t1"]),
        t("econ-h-t5", ["Inflation, Unemployment & Policy", "אינפלציה, אבטלה ומדיניות"], ["The Phillips curve, fiscal policy, monetary policy and the role of central banks.", "עקומת פיליפס, מדיניות פיסקלית, מדיניות מוניטרית ותפקיד הבנק המרכזי."], ["econ-h-t4"]),
      ]),
    ],
  },
  {
    id: "econ-high1112", subject: "economics", band: "11-12",
    units: [
      u("econ-h2-u1", ["AP Economics", "כלכלה (מתקדם)"], [
        t("econ-h2-t1", ["Advanced Microeconomics", "מיקרו-כלכלה מתקדמת"], ["Consumer theory, production costs, factor markets and game theory basics.", "תורת הצרכן, עלויות ייצור, שווקי גורמי ייצור ויסודות תורת המשחקים."], []),
        t("econ-h2-t2", ["Advanced Macroeconomics", "מאקרו-כלכלה מתקדמת"], ["IS-LM model, aggregate demand/supply, exchange rates and international trade.", "מודל IS-LM, ביקוש והיצע מצרפיים, שערי חליפין וסחר בינלאומי."], ["econ-h2-t1"]),
      ]),
      u("econ-h2-u2", ["Personal & Global Finance", "פיננסים אישיים וגלובליים"], [
        t("econ-h2-t3", ["Investing & Stock Markets", "השקעות ושוק ההון"], ["Stocks, bonds, mutual funds, risk/return and how to read financial statements.", "מניות, אג\"ח, קרנות נאמנות, סיכון ותשואה וקריאת דוחות כספיים."], []),
        t("econ-h2-t4", ["Global Economy", "הכלכלה העולמית"], ["International trade, comparative advantage, tariffs and global financial institutions.", "סחר בינלאומי, יתרון יחסי, מכסים ומוסדות פיננסיים עולמיים."], []),
      ]),
    ],
  },
  {
    id: "econ-college", subject: "economics", band: "college",
    units: [
      u("econ-col-u1", ["Principles of Economics", "עקרונות הכלכלה"], [
        t("econ-col-t1", ["Microeconomic Theory", "תאוריה מיקרו-כלכלית"], ["Utility maximization, cost curves, general equilibrium and welfare economics.", "מקסום תועלת, עקומות עלות, שיווי משקל כללי וכלכלת רווחה."], []),
        t("econ-col-t2", ["Macroeconomic Theory", "תאוריה מאקרו-כלכלית"], ["National income accounting, growth models, monetary theory and open economy macroeconomics.", "חשבונאות לאומית, מודלים של צמיחה, תאוריה מוניטרית ומאקרו-כלכלה של משק פתוח."], []),
        t("econ-col-t3", ["Econometrics Intro", "מבוא לאקונומטריקה"], ["Using data and regression analysis to test economic theories.", "שימוש בנתונים וברגרסיה כדי לבדוק תאוריות כלכליות."], ["econ-col-t1"]),
      ]),
    ],
  },
];
