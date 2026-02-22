
import { Subject, GradeLevel, Course, Language, Translations, ProgressMap, Topic, Unit } from './types';
import {
  Calculator, FlaskConical, BookOpen, Globe, Laptop, TrendingUp,
  Atom, Dna, Variable, MessageCircle, Scale, Code, Sparkles, Image, Video, Search, Mic
} from 'lucide-react';

export const ICON_MAP: Record<string, any> = {
  Calculator, FlaskConical, BookOpen, Globe, Laptop, TrendingUp,
  Atom, Dna, Variable, MessageCircle, Scale, Code, Sparkles, Image, Video, Search, Mic
};

export const SUBJECTS_DATA = [
  { id: Subject.MATH, icon: 'Calculator', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  { id: Subject.SCIENCE, icon: 'FlaskConical', color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  { id: Subject.LANGUAGE, icon: 'Globe', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
  { id: Subject.CODING, icon: 'Laptop', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' },
  { id: Subject.HISTORY, icon: 'BookOpen', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  { id: Subject.ECONOMICS, icon: 'TrendingUp', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' }
];

// ─── STATIC CURRICULUM TREE ───────────────────────────────────────────────────
// 6 subjects × representative grade bands → used to build Course objects dynamically

export interface CurriculumTopic {
  id: string;
  title: string;
  description: string;
  skillTags: string[];
  prerequisiteIds: string[];
}

export interface CurriculumUnit {
  id: string;
  title: string;
  topics: CurriculumTopic[];
}

export interface CurriculumCourse {
  id: string;
  subject: Subject;
  gradeLevel: GradeLevel;
  iconName: string;
  units: CurriculumUnit[];
}

export const CURRICULUM: CurriculumCourse[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // MATH
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'math-kinder', subject: Subject.MATH, gradeLevel: GradeLevel.KINDER, iconName: 'Calculator',
    units: [
      { id: 'math-k-u1', title: 'Counting & Numbers', topics: [
        { id: 'math-k-t1', title: 'Counting to 20', description: 'Counting objects, saying numbers in order, and recognizing numerals 1–20.', skillTags: ['counting'], prerequisiteIds: [] },
        { id: 'math-k-t2', title: 'More and Less', description: 'Comparing groups of objects to decide which has more or fewer.', skillTags: ['comparison'], prerequisiteIds: ['math-k-t1'] },
        { id: 'math-k-t3', title: 'Adding and Taking Away', description: 'Putting groups together and taking some away using pictures and objects.', skillTags: ['addition', 'subtraction'], prerequisiteIds: ['math-k-t2'] },
      ]},
      { id: 'math-k-u2', title: 'Shapes & Patterns', topics: [
        { id: 'math-k-t4', title: 'Basic Shapes', description: 'Recognizing and naming circles, squares, triangles and rectangles.', skillTags: ['geometry', 'shapes'], prerequisiteIds: [] },
        { id: 'math-k-t5', title: 'Patterns', description: 'Identifying and continuing simple AB, AAB and ABC patterns.', skillTags: ['patterns'], prerequisiteIds: ['math-k-t4'] },
      ]},
    ]
  },
  {
    id: 'math-elem13', subject: Subject.MATH, gradeLevel: GradeLevel.ELEMENTARY_1_3, iconName: 'Calculator',
    units: [
      { id: 'math-e13-u1', title: 'Addition & Subtraction', topics: [
        { id: 'math-e13-t1', title: 'Adding to 100', description: 'Adding two- and three-digit numbers with and without regrouping.', skillTags: ['addition'], prerequisiteIds: [] },
        { id: 'math-e13-t2', title: 'Subtracting to 100', description: 'Subtracting two-digit numbers and understanding borrowing.', skillTags: ['subtraction'], prerequisiteIds: ['math-e13-t1'] },
        { id: 'math-e13-t3', title: 'Word Problems', description: 'Solving addition and subtraction story problems step by step.', skillTags: ['problem-solving'], prerequisiteIds: ['math-e13-t2'] },
      ]},
      { id: 'math-e13-u2', title: 'Multiplication Intro & Geometry', topics: [
        { id: 'math-e13-t4', title: 'Intro to Multiplication', description: 'Equal groups, repeated addition and times tables up to 5.', skillTags: ['multiplication'], prerequisiteIds: ['math-e13-t1'] },
        { id: 'math-e13-t5', title: 'Telling Time', description: 'Reading clocks to the hour, half-hour and five minutes.', skillTags: ['time'], prerequisiteIds: [] },
        { id: 'math-e13-t6', title: 'Shapes & Measurement', description: 'Perimeter of simple shapes, measuring length with a ruler.', skillTags: ['geometry', 'measurement'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'math-elem46', subject: Subject.MATH, gradeLevel: GradeLevel.ELEMENTARY_4_6, iconName: 'Calculator',
    units: [
      { id: 'math-elem-u1', title: 'Multiplication & Division', topics: [
        { id: 'math-elem-t1', title: 'Multiplication Tables', description: 'Mastering times tables 1–12 and multi-digit multiplication.', skillTags: ['multiplication'], prerequisiteIds: [] },
        { id: 'math-elem-t2', title: 'Long Division', description: 'Dividing multi-digit numbers and understanding remainders.', skillTags: ['division'], prerequisiteIds: ['math-elem-t1'] },
        { id: 'math-elem-t3', title: 'Order of Operations', description: 'PEMDAS: solving expressions with multiple operations correctly.', skillTags: ['order-of-operations'], prerequisiteIds: ['math-elem-t2'] },
      ]},
      { id: 'math-elem-u2', title: 'Fractions & Decimals', topics: [
        { id: 'math-elem-t4', title: 'Fractions', description: 'Equivalent fractions, comparing, adding and subtracting fractions.', skillTags: ['fractions'], prerequisiteIds: ['math-elem-t1'] },
        { id: 'math-elem-t5', title: 'Decimals', description: 'Tenths, hundredths, rounding and converting between fractions and decimals.', skillTags: ['decimals'], prerequisiteIds: ['math-elem-t4'] },
        { id: 'math-elem-t6', title: 'Ratios & Percentages', description: 'Understanding ratios, rates and basic percentage calculations.', skillTags: ['ratios', 'percentages'], prerequisiteIds: ['math-elem-t5'] },
      ]},
    ]
  },
  {
    id: 'math-middle', subject: Subject.MATH, gradeLevel: GradeLevel.MIDDLE_7_8, iconName: 'Calculator',
    units: [
      { id: 'math-mid-u1', title: 'Pre-Algebra', topics: [
        { id: 'math-mid-t1', title: 'Integers & Rational Numbers', description: 'Operations with negative numbers, fractions and decimals on a number line.', skillTags: ['integers', 'rational-numbers'], prerequisiteIds: [] },
        { id: 'math-mid-t2', title: 'Variables & Expressions', description: 'Writing and simplifying algebraic expressions; combining like terms.', skillTags: ['algebra', 'variables'], prerequisiteIds: ['math-mid-t1'] },
        { id: 'math-mid-t3', title: 'Linear Equations', description: 'Solving one- and two-step equations with one variable.', skillTags: ['equations'], prerequisiteIds: ['math-mid-t2'] },
        { id: 'math-mid-t4', title: 'Proportions & Percent', description: 'Unit rate, percent change, discount, tax and interest.', skillTags: ['proportions', 'percent'], prerequisiteIds: ['math-mid-t1'] },
      ]},
      { id: 'math-mid-u2', title: 'Geometry & Statistics', topics: [
        { id: 'math-mid-t5', title: 'Geometry: Angles & Triangles', description: 'Angle relationships, the Pythagorean theorem and triangle properties.', skillTags: ['geometry', 'pythagorean'], prerequisiteIds: [] },
        { id: 'math-mid-t6', title: 'Area, Volume & Surface Area', description: 'Formulas for 2D and 3D shapes including circles, prisms and pyramids.', skillTags: ['geometry', 'volume'], prerequisiteIds: ['math-mid-t5'] },
        { id: 'math-mid-t7', title: 'Statistics & Probability', description: 'Mean, median, mode, range and basic probability experiments.', skillTags: ['statistics', 'probability'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'math-high910', subject: Subject.MATH, gradeLevel: GradeLevel.HIGH_9_10, iconName: 'Calculator',
    units: [
      { id: 'math-h1-u1', title: 'Algebra II', topics: [
        { id: 'math-h1-t1', title: 'Quadratic Equations', description: 'Factoring, completing the square and the quadratic formula.', skillTags: ['quadratics'], prerequisiteIds: [] },
        { id: 'math-h1-t2', title: 'Polynomial Functions', description: 'Graphing, finding roots and polynomial long division.', skillTags: ['polynomials'], prerequisiteIds: ['math-h1-t1'] },
        { id: 'math-h1-t3', title: 'Exponential & Logarithmic Functions', description: 'Growth/decay models, log rules and solving exponential equations.', skillTags: ['exponentials', 'logarithms'], prerequisiteIds: ['math-h1-t2'] },
      ]},
      { id: 'math-h1-u2', title: 'Geometry & Trigonometry', topics: [
        { id: 'math-h1-t4', title: 'Coordinate Geometry', description: 'Distance formula, midpoint, slopes of parallel and perpendicular lines.', skillTags: ['coordinate-geometry'], prerequisiteIds: [] },
        { id: 'math-h1-t5', title: 'Right Triangle Trigonometry', description: 'SOH-CAH-TOA, inverse trig functions and solving triangles.', skillTags: ['trigonometry'], prerequisiteIds: ['math-h1-t4'] },
        { id: 'math-h1-t6', title: 'Unit Circle & Trig Identities', description: 'Angles in radians, the unit circle and fundamental identities.', skillTags: ['trigonometry', 'unit-circle'], prerequisiteIds: ['math-h1-t5'] },
      ]},
    ]
  },
  {
    id: 'math-high1112', subject: Subject.MATH, gradeLevel: GradeLevel.HIGH_11_12, iconName: 'Calculator',
    units: [
      { id: 'math-h2-u1', title: 'Pre-Calculus', topics: [
        { id: 'math-h2-t1', title: 'Functions & Transformations', description: 'Domain, range, inverse functions and graphical transformations.', skillTags: ['functions'], prerequisiteIds: [] },
        { id: 'math-h2-t2', title: 'Sequences & Series', description: 'Arithmetic and geometric sequences, sigma notation and limits.', skillTags: ['sequences', 'series'], prerequisiteIds: ['math-h2-t1'] },
        { id: 'math-h2-t3', title: 'Intro to Limits & Derivatives', description: 'The concept of a limit, instantaneous rate of change and basic derivatives.', skillTags: ['calculus', 'derivatives'], prerequisiteIds: ['math-h2-t2'] },
      ]},
      { id: 'math-h2-u2', title: 'Statistics & Probability', topics: [
        { id: 'math-h2-t4', title: 'Data Analysis', description: 'Descriptive statistics, normal distribution and z-scores.', skillTags: ['statistics', 'normal-distribution'], prerequisiteIds: [] },
        { id: 'math-h2-t5', title: 'Probability & Combinatorics', description: 'Permutations, combinations, conditional probability and Bayes theorem.', skillTags: ['probability', 'combinatorics'], prerequisiteIds: ['math-h2-t4'] },
      ]},
    ]
  },
  {
    id: 'math-college', subject: Subject.MATH, gradeLevel: GradeLevel.COLLEGE_FRESHMAN, iconName: 'Calculator',
    units: [
      { id: 'math-col-u1', title: 'Calculus I', topics: [
        { id: 'math-col-t1', title: 'Limits & Continuity', description: 'Formal definition of limits, one-sided limits and continuity of functions.', skillTags: ['calculus', 'limits'], prerequisiteIds: [] },
        { id: 'math-col-t2', title: 'Differentiation', description: 'Power rule, chain rule, product/quotient rule and implicit differentiation.', skillTags: ['derivatives', 'differentiation'], prerequisiteIds: ['math-col-t1'] },
        { id: 'math-col-t3', title: 'Applications of Derivatives', description: 'Related rates, optimization, curve sketching and Mean Value Theorem.', skillTags: ['optimization'], prerequisiteIds: ['math-col-t2'] },
      ]},
      { id: 'math-col-u2', title: 'Calculus II', topics: [
        { id: 'math-col-t4', title: 'Integration', description: 'Antiderivatives, Riemann sums, the Fundamental Theorem of Calculus.', skillTags: ['integration'], prerequisiteIds: ['math-col-t2'] },
        { id: 'math-col-t5', title: 'Techniques of Integration', description: 'Substitution, integration by parts and partial fractions.', skillTags: ['integration'], prerequisiteIds: ['math-col-t4'] },
      ]},
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SCIENCE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'science-kinder', subject: Subject.SCIENCE, gradeLevel: GradeLevel.KINDER, iconName: 'FlaskConical',
    units: [
      { id: 'sci-k-u1', title: 'Living Things', topics: [
        { id: 'sci-k-t1', title: 'Plants & Animals', description: 'What living things need: water, food, sunlight and air.', skillTags: ['biology', 'living-things'], prerequisiteIds: [] },
        { id: 'sci-k-t2', title: 'My Five Senses', description: 'Using sight, hearing, touch, taste and smell to explore the world.', skillTags: ['senses', 'observation'], prerequisiteIds: [] },
      ]},
      { id: 'sci-k-u2', title: 'Earth & Weather', topics: [
        { id: 'sci-k-t3', title: 'Weather & Seasons', description: 'Recognizing sunny, rainy, snowy and windy weather and the four seasons.', skillTags: ['weather', 'seasons'], prerequisiteIds: [] },
        { id: 'sci-k-t4', title: 'Materials Around Us', description: 'Hard vs soft, rough vs smooth — describing materials by their properties.', skillTags: ['matter', 'properties'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'science-elem13', subject: Subject.SCIENCE, gradeLevel: GradeLevel.ELEMENTARY_1_3, iconName: 'FlaskConical',
    units: [
      { id: 'sci-e13-u1', title: 'Life Science', topics: [
        { id: 'sci-e13-t1', title: 'Plant Life Cycles', description: 'Seed, sprout, plant, flower, fruit — stages of plant growth.', skillTags: ['biology', 'life-cycles'], prerequisiteIds: [] },
        { id: 'sci-e13-t2', title: 'Animal Adaptations', description: 'How animals use their body parts and behaviors to survive.', skillTags: ['biology', 'adaptations'], prerequisiteIds: ['sci-e13-t1'] },
      ]},
      { id: 'sci-e13-u2', title: 'Earth & Physical Science', topics: [
        { id: 'sci-e13-t3', title: 'States of Matter', description: 'Solids, liquids and gases — properties and how matter changes state.', skillTags: ['matter', 'states'], prerequisiteIds: [] },
        { id: 'sci-e13-t4', title: 'Forces & Motion', description: 'Pushes, pulls, gravity and how forces change the motion of objects.', skillTags: ['forces', 'motion'], prerequisiteIds: [] },
        { id: 'sci-e13-t5', title: 'Weather & Water Cycle', description: 'Evaporation, condensation, precipitation and the water cycle.', skillTags: ['weather', 'water-cycle'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'science-elem46', subject: Subject.SCIENCE, gradeLevel: GradeLevel.ELEMENTARY_4_6, iconName: 'FlaskConical',
    units: [
      { id: 'sci-elem-u1', title: 'Life Science', topics: [
        { id: 'sci-elem-t1', title: 'Ecosystems & Food Webs', description: 'Producers, consumers, decomposers and energy flow through food chains.', skillTags: ['ecology', 'food-webs'], prerequisiteIds: [] },
        { id: 'sci-elem-t2', title: 'Cells: Building Blocks of Life', description: 'Plant vs animal cells, organelles and what each part does.', skillTags: ['biology', 'cells'], prerequisiteIds: ['sci-elem-t1'] },
      ]},
      { id: 'sci-elem-u2', title: 'Earth & Space Science', topics: [
        { id: 'sci-elem-t3', title: 'Earth\'s Layers & Plate Tectonics', description: 'Crust, mantle, core; earthquakes, volcanoes and continental drift.', skillTags: ['earth-science', 'geology'], prerequisiteIds: [] },
        { id: 'sci-elem-t4', title: 'Solar System & Space', description: 'The eight planets, the moon, stars, gravity and the scale of the solar system.', skillTags: ['astronomy', 'solar-system'], prerequisiteIds: ['sci-elem-t3'] },
      ]},
    ]
  },
  {
    id: 'science-middle', subject: Subject.SCIENCE, gradeLevel: GradeLevel.MIDDLE_7_8, iconName: 'FlaskConical',
    units: [
      { id: 'sci-mid-u1', title: 'Life Science', topics: [
        { id: 'sci-mid-t1', title: 'Cell Biology & Mitosis', description: 'Cell division, DNA replication and how organisms grow and repair.', skillTags: ['cell-biology', 'mitosis'], prerequisiteIds: [] },
        { id: 'sci-mid-t2', title: 'Genetics & Heredity', description: 'Dominant/recessive traits, Punnett squares and basic inheritance patterns.', skillTags: ['genetics', 'heredity'], prerequisiteIds: ['sci-mid-t1'] },
        { id: 'sci-mid-t3', title: 'Evolution & Natural Selection', description: 'Darwin\'s theory, adaptations, fossils and evidence for evolution.', skillTags: ['evolution', 'natural-selection'], prerequisiteIds: ['sci-mid-t2'] },
      ]},
      { id: 'sci-mid-u2', title: 'Physical Science', topics: [
        { id: 'sci-mid-t4', title: 'Atoms & the Periodic Table', description: 'Atomic structure, elements, compounds and reading the periodic table.', skillTags: ['chemistry', 'atoms'], prerequisiteIds: [] },
        { id: 'sci-mid-t5', title: 'Forces, Motion & Energy', description: 'Newton\'s laws, speed, velocity, acceleration and types of energy.', skillTags: ['physics', 'forces', 'energy'], prerequisiteIds: ['sci-mid-t4'] },
        { id: 'sci-mid-t6', title: 'Waves & Light', description: 'Properties of waves, the electromagnetic spectrum and optics basics.', skillTags: ['physics', 'waves', 'light'], prerequisiteIds: ['sci-mid-t5'] },
      ]},
    ]
  },
  {
    id: 'science-high910', subject: Subject.SCIENCE, gradeLevel: GradeLevel.HIGH_9_10, iconName: 'FlaskConical',
    units: [
      { id: 'sci-h-u1', title: 'Biology', topics: [
        { id: 'sci-h-t1', title: 'Cell Structure & Function', description: 'Organelles, membranes, cell transport and enzyme function.', skillTags: ['cell-biology'], prerequisiteIds: [] },
        { id: 'sci-h-t2', title: 'DNA, Genes & Protein Synthesis', description: 'DNA replication, transcription, translation and gene expression.', skillTags: ['genetics', 'dna'], prerequisiteIds: ['sci-h-t1'] },
        { id: 'sci-h-t3', title: 'Photosynthesis & Cellular Respiration', description: 'Light and dark reactions, ATP, glycolysis and the Krebs cycle.', skillTags: ['biochemistry'], prerequisiteIds: ['sci-h-t1'] },
      ]},
      { id: 'sci-h-u2', title: 'Chemistry', topics: [
        { id: 'sci-h-t4', title: 'Atomic Structure & Periodic Table', description: 'Electron configurations, periodic trends and why elements are arranged as they are.', skillTags: ['chemistry', 'atoms'], prerequisiteIds: [] },
        { id: 'sci-h-t5', title: 'Chemical Bonding & Reactions', description: 'Ionic, covalent, metallic bonds; balancing equations and reaction types.', skillTags: ['chemistry', 'bonding'], prerequisiteIds: ['sci-h-t4'] },
        { id: 'sci-h-t6', title: 'Stoichiometry', description: 'Molar mass, the mole concept and calculating reactants/products.', skillTags: ['stoichiometry', 'moles'], prerequisiteIds: ['sci-h-t5'] },
      ]},
    ]
  },
  {
    id: 'science-high1112', subject: Subject.SCIENCE, gradeLevel: GradeLevel.HIGH_11_12, iconName: 'FlaskConical',
    units: [
      { id: 'sci-h2-u1', title: 'Physics', topics: [
        { id: 'sci-h2-t1', title: 'Kinematics & Dynamics', description: 'Equations of motion, Newton\'s laws and free-body diagrams.', skillTags: ['physics', 'kinematics'], prerequisiteIds: [] },
        { id: 'sci-h2-t2', title: 'Energy, Work & Power', description: 'Kinetic and potential energy, conservation of energy, momentum.', skillTags: ['physics', 'energy'], prerequisiteIds: ['sci-h2-t1'] },
        { id: 'sci-h2-t3', title: 'Electricity & Magnetism', description: 'Charge, electric fields, circuits, Ohm\'s law and magnetic forces.', skillTags: ['physics', 'electricity'], prerequisiteIds: ['sci-h2-t2'] },
      ]},
      { id: 'sci-h2-u2', title: 'Advanced Chemistry', topics: [
        { id: 'sci-h2-t4', title: 'Thermodynamics', description: 'Enthalpy, entropy, Gibbs free energy and spontaneous reactions.', skillTags: ['thermodynamics'], prerequisiteIds: [] },
        { id: 'sci-h2-t5', title: 'Equilibrium & Acid-Base Chemistry', description: 'Le Chatelier\'s principle, pH, buffers and titrations.', skillTags: ['equilibrium', 'acid-base'], prerequisiteIds: ['sci-h2-t4'] },
      ]},
    ]
  },
  {
    id: 'science-college', subject: Subject.SCIENCE, gradeLevel: GradeLevel.COLLEGE_FRESHMAN, iconName: 'FlaskConical',
    units: [
      { id: 'sci-col-u1', title: 'General Chemistry', topics: [
        { id: 'sci-col-t1', title: 'Quantum Mechanics & Atomic Theory', description: 'Wave functions, orbitals, the Schrödinger equation and quantum numbers.', skillTags: ['quantum-chemistry'], prerequisiteIds: [] },
        { id: 'sci-col-t2', title: 'Chemical Kinetics', description: 'Reaction rates, rate laws, activation energy and the Arrhenius equation.', skillTags: ['kinetics'], prerequisiteIds: ['sci-col-t1'] },
      ]},
      { id: 'sci-col-u2', title: 'General Biology', topics: [
        { id: 'sci-col-t3', title: 'Molecular Biology', description: 'CRISPR, gene regulation, epigenetics and recombinant DNA technology.', skillTags: ['molecular-biology'], prerequisiteIds: [] },
        { id: 'sci-col-t4', title: 'Ecology & Evolution', description: 'Population dynamics, speciation, phylogenetics and biome analysis.', skillTags: ['ecology', 'evolution'], prerequisiteIds: ['sci-col-t3'] },
      ]},
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LANGUAGE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'lang-kinder', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.KINDER, iconName: 'Globe',
    units: [
      { id: 'lang-k-u1', title: 'Reading Foundations', topics: [
        { id: 'lang-k-t1', title: 'Letter Recognition', description: 'Naming and writing all 26 uppercase and lowercase letters of the alphabet.', skillTags: ['phonics', 'letters'], prerequisiteIds: [] },
        { id: 'lang-k-t2', title: 'Phonics & Sight Words', description: 'Letter sounds, blending CVC words and the first 50 sight words.', skillTags: ['phonics', 'reading'], prerequisiteIds: ['lang-k-t1'] },
        { id: 'lang-k-t3', title: 'Listening & Storytelling', description: 'Understanding stories read aloud: characters, setting and what happens.', skillTags: ['comprehension', 'listening'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'lang-elem13', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.ELEMENTARY_1_3, iconName: 'Globe',
    units: [
      { id: 'lang-e13-u1', title: 'Reading & Phonics', topics: [
        { id: 'lang-e13-t1', title: 'Phonics & Decoding', description: 'Blends, digraphs, vowel teams and decoding multi-syllable words.', skillTags: ['phonics', 'decoding'], prerequisiteIds: [] },
        { id: 'lang-e13-t2', title: 'Reading Fluency', description: 'Reading aloud with accuracy, speed and expression.', skillTags: ['fluency', 'reading'], prerequisiteIds: ['lang-e13-t1'] },
        { id: 'lang-e13-t3', title: 'Comprehension', description: 'Retelling stories, identifying main idea and asking questions about a text.', skillTags: ['comprehension'], prerequisiteIds: ['lang-e13-t2'] },
      ]},
      { id: 'lang-e13-u2', title: 'Writing & Grammar', topics: [
        { id: 'lang-e13-t4', title: 'Sentences & Punctuation', description: 'Writing complete sentences with capital letters and end punctuation.', skillTags: ['grammar', 'writing'], prerequisiteIds: [] },
        { id: 'lang-e13-t5', title: 'Vocabulary Building', description: 'Using context clues, prefixes and suffixes to learn new words.', skillTags: ['vocabulary'], prerequisiteIds: ['lang-e13-t4'] },
      ]},
    ]
  },
  {
    id: 'lang-elem46', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.ELEMENTARY_4_6, iconName: 'Globe',
    units: [
      { id: 'lang-e46-u1', title: 'Reading & Analysis', topics: [
        { id: 'lang-e46-t1', title: 'Main Idea & Supporting Details', description: 'Finding the central idea and how details support it in non-fiction texts.', skillTags: ['comprehension', 'non-fiction'], prerequisiteIds: [] },
        { id: 'lang-e46-t2', title: 'Story Elements', description: 'Analyzing characters, plot, conflict and theme in fiction.', skillTags: ['literary-analysis'], prerequisiteIds: ['lang-e46-t1'] },
      ]},
      { id: 'lang-e46-u2', title: 'Writing & Grammar', topics: [
        { id: 'lang-e46-t3', title: 'Paragraph Writing', description: 'Topic sentence, supporting details and a concluding sentence.', skillTags: ['writing', 'paragraphs'], prerequisiteIds: [] },
        { id: 'lang-e46-t4', title: 'Grammar: Parts of Speech', description: 'Nouns, verbs, adjectives, adverbs, pronouns and conjunctions.', skillTags: ['grammar'], prerequisiteIds: ['lang-e46-t3'] },
        { id: 'lang-e46-t5', title: 'Spelling & Vocabulary', description: 'Greek/Latin roots, context clues and commonly confused words.', skillTags: ['vocabulary', 'spelling'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'lang-middle', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.MIDDLE_7_8, iconName: 'Globe',
    units: [
      { id: 'lang-mid-u1', title: 'Grammar & Writing', topics: [
        { id: 'lang-mid-t1', title: 'Advanced Grammar', description: 'Phrases, clauses, compound-complex sentences and common errors.', skillTags: ['grammar'], prerequisiteIds: [] },
        { id: 'lang-mid-t2', title: 'Essay Writing', description: 'Five-paragraph essays: thesis, body paragraphs, transitions and conclusion.', skillTags: ['writing', 'essays'], prerequisiteIds: ['lang-mid-t1'] },
        { id: 'lang-mid-t3', title: 'Argumentative Writing', description: 'Building a claim, using evidence and addressing counterarguments.', skillTags: ['writing', 'argumentation'], prerequisiteIds: ['lang-mid-t2'] },
      ]},
      { id: 'lang-mid-u2', title: 'Literature & Analysis', topics: [
        { id: 'lang-mid-t4', title: 'Literary Devices', description: 'Metaphor, simile, alliteration, foreshadowing and symbolism.', skillTags: ['literary-devices'], prerequisiteIds: [] },
        { id: 'lang-mid-t5', title: 'Textual Evidence & Inference', description: 'Supporting claims with direct quotes, paraphrase and inference.', skillTags: ['analysis', 'evidence'], prerequisiteIds: ['lang-mid-t4'] },
      ]},
    ]
  },
  {
    id: 'lang-high910', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.HIGH_9_10, iconName: 'Globe',
    units: [
      { id: 'lang-h1-u1', title: 'Rhetoric & Composition', topics: [
        { id: 'lang-h1-t1', title: 'Rhetorical Analysis', description: 'Identifying ethos, pathos and logos in speeches, essays and advertisements.', skillTags: ['rhetoric', 'analysis'], prerequisiteIds: [] },
        { id: 'lang-h1-t2', title: 'Research Writing', description: 'Thesis statements, integrating sources, MLA/APA citation and avoiding plagiarism.', skillTags: ['research', 'writing'], prerequisiteIds: ['lang-h1-t1'] },
      ]},
      { id: 'lang-h1-u2', title: 'Literature', topics: [
        { id: 'lang-h1-t3', title: 'World Literature', description: 'Analyzing novels, poems and plays from global traditions and historical contexts.', skillTags: ['literature', 'world'], prerequisiteIds: [] },
        { id: 'lang-h1-t4', title: 'Shakespeare & Classic Drama', description: 'Reading Shakespeare: plot, character, language and historical significance.', skillTags: ['shakespeare', 'drama'], prerequisiteIds: ['lang-h1-t3'] },
      ]},
    ]
  },
  {
    id: 'lang-high1112', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.HIGH_11_12, iconName: 'Globe',
    units: [
      { id: 'lang-h2-u1', title: 'AP Language & Composition', topics: [
        { id: 'lang-h2-t1', title: 'Synthesis Essays', description: 'Combining multiple sources into a coherent argument with proper attribution.', skillTags: ['synthesis', 'argumentation'], prerequisiteIds: [] },
        { id: 'lang-h2-t2', title: 'Stylistic Analysis', description: 'How authors\' diction, syntax and tone create meaning and effect.', skillTags: ['stylistics', 'analysis'], prerequisiteIds: ['lang-h2-t1'] },
      ]},
      { id: 'lang-h2-u2', title: 'AP Literature', topics: [
        { id: 'lang-h2-t3', title: 'The American Novel', description: 'Major themes in American literature from Hawthorne to Toni Morrison.', skillTags: ['american-literature'], prerequisiteIds: [] },
        { id: 'lang-h2-t4', title: 'Poetry Analysis', description: 'Close reading of poems: form, imagery, voice, tone and irony.', skillTags: ['poetry', 'analysis'], prerequisiteIds: ['lang-h2-t3'] },
      ]},
    ]
  },
  {
    id: 'lang-college', subject: Subject.LANGUAGE, gradeLevel: GradeLevel.COLLEGE_FRESHMAN, iconName: 'Globe',
    units: [
      { id: 'lang-col-u1', title: 'College Composition', topics: [
        { id: 'lang-col-t1', title: 'Academic Writing', description: 'Writing college-level essays: argumentation, evidence, citations and revision.', skillTags: ['academic-writing'], prerequisiteIds: [] },
        { id: 'lang-col-t2', title: 'Critical Reading', description: 'Analyzing complex texts for argument, bias, rhetoric and underlying assumptions.', skillTags: ['critical-reading'], prerequisiteIds: ['lang-col-t1'] },
      ]},
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HISTORY
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'history-kinder', subject: Subject.HISTORY, gradeLevel: GradeLevel.KINDER, iconName: 'BookOpen',
    units: [
      { id: 'hist-k-u1', title: 'My World', topics: [
        { id: 'hist-k-t1', title: 'Me, My Family & My Community', description: 'Who I am, my family, my neighborhood and the helpers in my community.', skillTags: ['community', 'family'], prerequisiteIds: [] },
        { id: 'hist-k-t2', title: 'Holidays & Traditions', description: 'Cultural celebrations, national holidays and why we observe them.', skillTags: ['culture', 'traditions'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'history-elem13', subject: Subject.HISTORY, gradeLevel: GradeLevel.ELEMENTARY_1_3, iconName: 'BookOpen',
    units: [
      { id: 'hist-e13-u1', title: 'American History Basics', topics: [
        { id: 'hist-e13-t1', title: 'American Symbols & Government', description: 'The flag, the Pledge, the Constitution, the President and how our government works.', skillTags: ['civics', 'us-government'], prerequisiteIds: [] },
        { id: 'hist-e13-t2', title: 'Native Americans & Early Explorers', description: 'Native American cultures and the arrival of European explorers.', skillTags: ['native-american', 'exploration'], prerequisiteIds: [] },
        { id: 'hist-e13-t3', title: 'Maps & Geography', description: 'Reading maps, the seven continents, four oceans and compass directions.', skillTags: ['geography', 'maps'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'history-elem46', subject: Subject.HISTORY, gradeLevel: GradeLevel.ELEMENTARY_4_6, iconName: 'BookOpen',
    units: [
      { id: 'hist-e46-u1', title: 'US History', topics: [
        { id: 'hist-e46-t1', title: 'Colonial America & Revolution', description: 'The thirteen colonies, causes of the Revolution and the Declaration of Independence.', skillTags: ['american-revolution', 'colonial'], prerequisiteIds: [] },
        { id: 'hist-e46-t2', title: 'Westward Expansion', description: 'Manifest Destiny, the Oregon Trail and the impact on Native Americans.', skillTags: ['westward-expansion'], prerequisiteIds: ['hist-e46-t1'] },
        { id: 'hist-e46-t3', title: 'Civil War & Reconstruction', description: 'Causes of the Civil War, key battles, emancipation and Reconstruction.', skillTags: ['civil-war'], prerequisiteIds: ['hist-e46-t2'] },
      ]},
    ]
  },
  {
    id: 'history-middle', subject: Subject.HISTORY, gradeLevel: GradeLevel.MIDDLE_7_8, iconName: 'BookOpen',
    units: [
      { id: 'hist-mid-u1', title: 'World History', topics: [
        { id: 'hist-mid-t1', title: 'Ancient Civilizations', description: 'Mesopotamia, Ancient Egypt, Greece and Rome — government, culture and legacy.', skillTags: ['ancient-history'], prerequisiteIds: [] },
        { id: 'hist-mid-t2', title: 'Medieval World', description: 'Feudal Europe, Byzantine Empire, Islamic Golden Age and the Mongol Empire.', skillTags: ['medieval-history'], prerequisiteIds: ['hist-mid-t1'] },
        { id: 'hist-mid-t3', title: 'Renaissance & Reformation', description: 'Art, science and religious change in early modern Europe.', skillTags: ['renaissance', 'reformation'], prerequisiteIds: ['hist-mid-t2'] },
      ]},
      { id: 'hist-mid-u2', title: 'Geography & Civics', topics: [
        { id: 'hist-mid-t4', title: 'World Geography', description: 'Physical and political geography: regions, climate zones and human environment interaction.', skillTags: ['geography'], prerequisiteIds: [] },
        { id: 'hist-mid-t5', title: 'Government & Civics', description: 'Types of government, the US Constitution, rights and responsibilities of citizens.', skillTags: ['civics', 'government'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'history-high910', subject: Subject.HISTORY, gradeLevel: GradeLevel.HIGH_9_10, iconName: 'BookOpen',
    units: [
      { id: 'hist-h-u1', title: 'Modern World History', topics: [
        { id: 'hist-h-t1', title: 'Age of Revolution', description: 'The American, French and Haitian revolutions and the spread of democratic ideals.', skillTags: ['revolutions', 'modern-history'], prerequisiteIds: [] },
        { id: 'hist-h-t2', title: 'Imperialism & Industrialization', description: 'European imperialism, colonialism, the Industrial Revolution and its global impact.', skillTags: ['imperialism', 'industrialization'], prerequisiteIds: ['hist-h-t1'] },
        { id: 'hist-h-t3', title: 'World Wars', description: 'Causes, major events, the Holocaust and consequences of WWI and WWII.', skillTags: ['wwi', 'wwii', '20th-century'], prerequisiteIds: ['hist-h-t2'] },
      ]},
      { id: 'hist-h-u2', title: 'Post-War World', topics: [
        { id: 'hist-h-t4', title: 'Cold War', description: 'US-Soviet rivalry, proxy wars, the arms race and détente.', skillTags: ['cold-war'], prerequisiteIds: ['hist-h-t3'] },
        { id: 'hist-h-t5', title: 'Decolonization & Civil Rights', description: 'Independence movements in Africa and Asia; civil rights in America.', skillTags: ['decolonization', 'civil-rights'], prerequisiteIds: ['hist-h-t4'] },
      ]},
    ]
  },
  {
    id: 'history-high1112', subject: Subject.HISTORY, gradeLevel: GradeLevel.HIGH_11_12, iconName: 'BookOpen',
    units: [
      { id: 'hist-h2-u1', title: 'US History', topics: [
        { id: 'hist-h2-t1', title: 'Progressive Era & New Deal', description: 'Reform movements, the Great Depression and FDR\'s response.', skillTags: ['progressive-era', 'new-deal'], prerequisiteIds: [] },
        { id: 'hist-h2-t2', title: 'Post-War America', description: 'The 1950s boom, counterculture, Vietnam War and the Great Society.', skillTags: ['post-war-america'], prerequisiteIds: ['hist-h2-t1'] },
        { id: 'hist-h2-t3', title: 'America in the Modern World', description: '9/11, the War on Terror, globalization and political polarization.', skillTags: ['modern-america'], prerequisiteIds: ['hist-h2-t2'] },
      ]},
      { id: 'hist-h2-u2', title: 'Government & Politics', topics: [
        { id: 'hist-h2-t4', title: 'AP US Government', description: 'Branches of government, federalism, civil liberties and landmark Supreme Court cases.', skillTags: ['us-government', 'ap'], prerequisiteIds: [] },
        { id: 'hist-h2-t5', title: 'Comparative Politics', description: 'Comparing democratic systems, authoritarian regimes and international relations.', skillTags: ['comparative-politics'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'history-college', subject: Subject.HISTORY, gradeLevel: GradeLevel.COLLEGE_FRESHMAN, iconName: 'BookOpen',
    units: [
      { id: 'hist-col-u1', title: 'World History Survey', topics: [
        { id: 'hist-col-t1', title: 'From Prehistory to 1500', description: 'Human migration, early civilizations, trade networks and cultural exchange to 1500 CE.', skillTags: ['world-history', 'ancient'], prerequisiteIds: [] },
        { id: 'hist-col-t2', title: '1500 to the Present', description: 'Global contact, colonialism, revolutions, world wars and the contemporary world.', skillTags: ['world-history', 'modern'], prerequisiteIds: ['hist-col-t1'] },
      ]},
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CODING
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'coding-kinder', subject: Subject.CODING, gradeLevel: GradeLevel.KINDER, iconName: 'Laptop',
    units: [
      { id: 'code-k-u1', title: 'Intro to Computers', topics: [
        { id: 'code-k-t1', title: 'What is a Computer?', description: 'Parts of a computer: screen, keyboard, mouse and what each part does.', skillTags: ['computers', 'hardware'], prerequisiteIds: [] },
        { id: 'code-k-t2', title: 'Sequences & Algorithms', description: 'Following step-by-step instructions; putting steps in the right order.', skillTags: ['algorithms', 'sequences'], prerequisiteIds: [] },
        { id: 'code-k-t3', title: 'Patterns & Loops', description: 'Repeating patterns in the world and in simple programs (using tools like ScratchJr).', skillTags: ['patterns', 'loops'], prerequisiteIds: ['code-k-t2'] },
      ]},
    ]
  },
  {
    id: 'coding-elem13', subject: Subject.CODING, gradeLevel: GradeLevel.ELEMENTARY_1_3, iconName: 'Laptop',
    units: [
      { id: 'code-e13-u1', title: 'Block-Based Coding', topics: [
        { id: 'code-e13-t1', title: 'Sequences & Events', description: 'Writing sequences of commands and triggering actions with events in Scratch.', skillTags: ['sequences', 'events'], prerequisiteIds: [] },
        { id: 'code-e13-t2', title: 'Loops & Repetition', description: 'Using repeat loops to avoid rewriting the same code over and over.', skillTags: ['loops'], prerequisiteIds: ['code-e13-t1'] },
        { id: 'code-e13-t3', title: 'Conditionals', description: 'If/else blocks: making programs respond to conditions and user input.', skillTags: ['conditionals'], prerequisiteIds: ['code-e13-t2'] },
      ]},
    ]
  },
  {
    id: 'coding-elem46', subject: Subject.CODING, gradeLevel: GradeLevel.ELEMENTARY_4_6, iconName: 'Laptop',
    units: [
      { id: 'code-e46-u1', title: 'Scratch & Intro to Python', topics: [
        { id: 'code-e46-t1', title: 'Advanced Scratch Projects', description: 'Building games and animations with sprites, variables and broadcasts in Scratch.', skillTags: ['scratch', 'game-design'], prerequisiteIds: [] },
        { id: 'code-e46-t2', title: 'Intro to Python', description: 'First Python programs: print, input, variables and basic arithmetic.', skillTags: ['python', 'variables'], prerequisiteIds: ['code-e46-t1'] },
        { id: 'code-e46-t3', title: 'Loops & Conditionals in Python', description: 'for/while loops, if/elif/else and writing programs that make decisions.', skillTags: ['python', 'loops', 'conditionals'], prerequisiteIds: ['code-e46-t2'] },
      ]},
    ]
  },
  {
    id: 'coding-middle', subject: Subject.CODING, gradeLevel: GradeLevel.MIDDLE_7_8, iconName: 'Laptop',
    units: [
      { id: 'code-mid-u1', title: 'Python Programming', topics: [
        { id: 'code-mid-t1', title: 'Variables & Data Types', description: 'Strings, integers, floats, booleans and type conversion in Python.', skillTags: ['variables', 'data-types'], prerequisiteIds: [] },
        { id: 'code-mid-t2', title: 'Control Flow', description: 'if/elif/else, for loops, while loops and nested structures.', skillTags: ['control-flow'], prerequisiteIds: ['code-mid-t1'] },
        { id: 'code-mid-t3', title: 'Functions & Scope', description: 'Defining functions, parameters, return values and variable scope.', skillTags: ['functions', 'scope'], prerequisiteIds: ['code-mid-t2'] },
      ]},
      { id: 'code-mid-u2', title: 'Data Structures', topics: [
        { id: 'code-mid-t4', title: 'Lists & Tuples', description: 'Indexing, slicing, list methods and when to use tuples.', skillTags: ['lists', 'data-structures'], prerequisiteIds: ['code-mid-t2'] },
        { id: 'code-mid-t5', title: 'Dictionaries & Sets', description: 'Key-value pairs, dictionary methods and set operations.', skillTags: ['dictionaries', 'sets'], prerequisiteIds: ['code-mid-t4'] },
        { id: 'code-mid-t6', title: 'File I/O & Error Handling', description: 'Reading/writing files, try/except blocks and debugging strategies.', skillTags: ['file-io', 'debugging'], prerequisiteIds: ['code-mid-t3'] },
      ]},
    ]
  },
  {
    id: 'coding-high910', subject: Subject.CODING, gradeLevel: GradeLevel.HIGH_9_10, iconName: 'Laptop',
    units: [
      { id: 'code-h1-u1', title: 'Object-Oriented Programming', topics: [
        { id: 'code-h1-t1', title: 'Classes & Objects', description: 'Defining classes, creating objects, attributes and methods in Python or Java.', skillTags: ['oop', 'classes'], prerequisiteIds: [] },
        { id: 'code-h1-t2', title: 'Inheritance & Polymorphism', description: 'Extending classes, method overriding and using polymorphism.', skillTags: ['oop', 'inheritance'], prerequisiteIds: ['code-h1-t1'] },
        { id: 'code-h1-t3', title: 'Intro to Algorithms', description: 'Sorting algorithms (bubble, selection, merge), Big-O notation and efficiency.', skillTags: ['algorithms', 'sorting'], prerequisiteIds: ['code-h1-t2'] },
      ]},
      { id: 'code-h1-u2', title: 'Web Development', topics: [
        { id: 'code-h1-t4', title: 'HTML & CSS', description: 'Building web pages with HTML structure and CSS styling.', skillTags: ['html', 'css', 'web'], prerequisiteIds: [] },
        { id: 'code-h1-t5', title: 'JavaScript Basics', description: 'Variables, functions, DOM manipulation and event handling.', skillTags: ['javascript', 'web'], prerequisiteIds: ['code-h1-t4'] },
      ]},
    ]
  },
  {
    id: 'coding-high1112', subject: Subject.CODING, gradeLevel: GradeLevel.HIGH_11_12, iconName: 'Laptop',
    units: [
      { id: 'code-h2-u1', title: 'AP Computer Science', topics: [
        { id: 'code-h2-t1', title: 'Advanced Data Structures', description: 'Stacks, queues, linked lists, trees and hash tables.', skillTags: ['data-structures', 'ap-cs'], prerequisiteIds: [] },
        { id: 'code-h2-t2', title: 'Recursion', description: 'Recursive thinking, base cases, recursive algorithms and the call stack.', skillTags: ['recursion', 'algorithms'], prerequisiteIds: ['code-h2-t1'] },
        { id: 'code-h2-t3', title: 'Search & Sort Algorithms', description: 'Binary search, merge sort, quicksort and analyzing time complexity.', skillTags: ['algorithms', 'complexity'], prerequisiteIds: ['code-h2-t2'] },
      ]},
      { id: 'code-h2-u2', title: 'Software Engineering', topics: [
        { id: 'code-h2-t4', title: 'Version Control & Git', description: 'Using Git and GitHub: commits, branches, merging and pull requests.', skillTags: ['git', 'version-control'], prerequisiteIds: [] },
        { id: 'code-h2-t5', title: 'Databases & SQL', description: 'Relational databases, SQL queries, joins and basic database design.', skillTags: ['databases', 'sql'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'coding-college', subject: Subject.CODING, gradeLevel: GradeLevel.COLLEGE_FRESHMAN, iconName: 'Laptop',
    units: [
      { id: 'code-col-u1', title: 'Data Structures & Algorithms', topics: [
        { id: 'code-col-t1', title: 'Advanced Algorithms', description: 'Dynamic programming, graph algorithms (BFS, DFS, Dijkstra) and greedy methods.', skillTags: ['algorithms', 'graph-theory'], prerequisiteIds: [] },
        { id: 'code-col-t2', title: 'Computational Complexity', description: 'P vs NP, NP-completeness, reduction proofs and practical limits of computation.', skillTags: ['complexity', 'theory'], prerequisiteIds: ['code-col-t1'] },
      ]},
      { id: 'code-col-u2', title: 'Systems & Software', topics: [
        { id: 'code-col-t3', title: 'Operating Systems', description: 'Processes, threads, memory management, virtual memory and the OS scheduler.', skillTags: ['os', 'systems'], prerequisiteIds: [] },
        { id: 'code-col-t4', title: 'Software Engineering Principles', description: 'Agile, design patterns, testing, code review and system design.', skillTags: ['software-engineering'], prerequisiteIds: [] },
      ]},
    ]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ECONOMICS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'econ-kinder', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.KINDER, iconName: 'TrendingUp',
    units: [
      { id: 'econ-k-u1', title: 'Money & Needs', topics: [
        { id: 'econ-k-t1', title: 'Needs vs Wants', description: 'Distinguishing between things we must have (food, shelter) and things we want.', skillTags: ['needs-wants'], prerequisiteIds: [] },
        { id: 'econ-k-t2', title: 'Money & Counting Coins', description: 'Recognizing coins and bills, counting pennies, nickels and dimes.', skillTags: ['money', 'counting'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'econ-elem13', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.ELEMENTARY_1_3, iconName: 'TrendingUp',
    units: [
      { id: 'econ-e13-u1', title: 'Community Economics', topics: [
        { id: 'econ-e13-t1', title: 'Goods & Services', description: 'The difference between goods (things) and services (actions) people buy and sell.', skillTags: ['goods-services'], prerequisiteIds: [] },
        { id: 'econ-e13-t2', title: 'Trade & Barter', description: 'How trade works, specialization and why people exchange goods.', skillTags: ['trade', 'barter'], prerequisiteIds: ['econ-e13-t1'] },
        { id: 'econ-e13-t3', title: 'Saving Money', description: 'Why we save, earning and spending and making simple choices with limited money.', skillTags: ['saving', 'personal-finance'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'econ-elem46', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.ELEMENTARY_4_6, iconName: 'TrendingUp',
    units: [
      { id: 'econ-e46-u1', title: 'Basic Economics', topics: [
        { id: 'econ-e46-t1', title: 'Scarcity & Choice', description: 'Resources are limited — people must make choices and face trade-offs.', skillTags: ['scarcity', 'choice'], prerequisiteIds: [] },
        { id: 'econ-e46-t2', title: 'Supply, Demand & Price', description: 'Why prices rise and fall based on how much is available and how much people want.', skillTags: ['supply-demand'], prerequisiteIds: ['econ-e46-t1'] },
        { id: 'econ-e46-t3', title: 'Personal Finance & Budgeting', description: 'Income, expenses, savings goals and making a simple budget.', skillTags: ['budgeting', 'personal-finance'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'econ-middle', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.MIDDLE_7_8, iconName: 'TrendingUp',
    units: [
      { id: 'econ-mid-u1', title: 'Economic Systems', topics: [
        { id: 'econ-mid-t1', title: 'Types of Economic Systems', description: 'Command, market, traditional and mixed economies — how each allocates resources.', skillTags: ['economic-systems'], prerequisiteIds: [] },
        { id: 'econ-mid-t2', title: 'Entrepreneurship', description: 'Starting a business, profit, loss, risk and what makes a successful entrepreneur.', skillTags: ['entrepreneurship'], prerequisiteIds: ['econ-mid-t1'] },
      ]},
      { id: 'econ-mid-u2', title: 'Personal Finance', topics: [
        { id: 'econ-mid-t3', title: 'Banking & Saving', description: 'Checking vs savings accounts, interest, compound interest and financial goals.', skillTags: ['banking', 'saving'], prerequisiteIds: [] },
        { id: 'econ-mid-t4', title: 'Credit & Debt', description: 'How credit cards and loans work, interest rates and the cost of borrowing.', skillTags: ['credit', 'debt'], prerequisiteIds: ['econ-mid-t3'] },
      ]},
    ]
  },
  {
    id: 'econ-high910', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.HIGH_9_10, iconName: 'TrendingUp',
    units: [
      { id: 'econ-h-u1', title: 'Microeconomics', topics: [
        { id: 'econ-h-t1', title: 'Supply & Demand', description: 'Market equilibrium, price floors/ceilings and how markets allocate resources.', skillTags: ['supply-demand'], prerequisiteIds: [] },
        { id: 'econ-h-t2', title: 'Elasticity', description: 'Price elasticity of demand and supply; calculating and interpreting elasticity.', skillTags: ['elasticity'], prerequisiteIds: ['econ-h-t1'] },
        { id: 'econ-h-t3', title: 'Market Structures', description: 'Perfect competition, monopolistic competition, oligopoly and monopoly.', skillTags: ['market-structures'], prerequisiteIds: ['econ-h-t2'] },
      ]},
      { id: 'econ-h-u2', title: 'Macroeconomics', topics: [
        { id: 'econ-h-t4', title: 'GDP & Economic Growth', description: 'Measuring national output, the business cycle and factors of economic growth.', skillTags: ['gdp', 'macroeconomics'], prerequisiteIds: ['econ-h-t1'] },
        { id: 'econ-h-t5', title: 'Inflation, Unemployment & Policy', description: 'The Phillips curve, fiscal policy, monetary policy and the role of central banks.', skillTags: ['inflation', 'unemployment', 'policy'], prerequisiteIds: ['econ-h-t4'] },
      ]},
    ]
  },
  {
    id: 'econ-high1112', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.HIGH_11_12, iconName: 'TrendingUp',
    units: [
      { id: 'econ-h2-u1', title: 'AP Economics', topics: [
        { id: 'econ-h2-t1', title: 'Advanced Microeconomics', description: 'Consumer theory, production costs, factor markets and game theory basics.', skillTags: ['microeconomics', 'game-theory'], prerequisiteIds: [] },
        { id: 'econ-h2-t2', title: 'Advanced Macroeconomics', description: 'IS-LM model, aggregate demand/supply, exchange rates and international trade.', skillTags: ['macroeconomics', 'trade'], prerequisiteIds: ['econ-h2-t1'] },
      ]},
      { id: 'econ-h2-u2', title: 'Personal & Global Finance', topics: [
        { id: 'econ-h2-t3', title: 'Investing & Stock Markets', description: 'Stocks, bonds, mutual funds, risk/return and how to read financial statements.', skillTags: ['investing', 'stocks'], prerequisiteIds: [] },
        { id: 'econ-h2-t4', title: 'Global Economy', description: 'International trade, comparative advantage, tariffs and global financial institutions.', skillTags: ['global-economy', 'trade'], prerequisiteIds: [] },
      ]},
    ]
  },
  {
    id: 'econ-college', subject: Subject.ECONOMICS, gradeLevel: GradeLevel.COLLEGE_FRESHMAN, iconName: 'TrendingUp',
    units: [
      { id: 'econ-col-u1', title: 'Principles of Economics', topics: [
        { id: 'econ-col-t1', title: 'Microeconomic Theory', description: 'Utility maximization, cost curves, general equilibrium and welfare economics.', skillTags: ['microeconomics', 'theory'], prerequisiteIds: [] },
        { id: 'econ-col-t2', title: 'Macroeconomic Theory', description: 'National income accounting, growth models, monetary theory and open economy macroeconomics.', skillTags: ['macroeconomics', 'theory'], prerequisiteIds: [] },
        { id: 'econ-col-t3', title: 'Econometrics Intro', description: 'Using data and regression analysis to test economic theories.', skillTags: ['econometrics', 'data'], prerequisiteIds: ['econ-col-t1'] },
      ]},
    ]
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Maps individual grade years and legacy grouped values to their curriculum entry */
const GRADE_TO_CURRICULUM_LEVEL: Partial<Record<GradeLevel, GradeLevel>> = {
  // Individual grade years → curriculum band
  [GradeLevel.GRADE_1]: GradeLevel.ELEMENTARY_1_3,
  [GradeLevel.GRADE_2]: GradeLevel.ELEMENTARY_1_3,
  [GradeLevel.GRADE_3]: GradeLevel.ELEMENTARY_1_3,
  [GradeLevel.GRADE_4]: GradeLevel.ELEMENTARY_4_6,
  [GradeLevel.GRADE_5]: GradeLevel.ELEMENTARY_4_6,
  [GradeLevel.GRADE_6]: GradeLevel.ELEMENTARY_4_6,
  [GradeLevel.GRADE_7]: GradeLevel.MIDDLE_7_8,
  [GradeLevel.GRADE_8]: GradeLevel.MIDDLE_7_8,
  [GradeLevel.GRADE_9]: GradeLevel.HIGH_9_10,
  [GradeLevel.GRADE_10]: GradeLevel.HIGH_9_10,
  [GradeLevel.GRADE_11]: GradeLevel.HIGH_11_12,
  [GradeLevel.GRADE_12]: GradeLevel.HIGH_11_12,
  // College Advanced uses same curriculum as College Freshman
  [GradeLevel.COLLEGE_ADVANCED]: GradeLevel.COLLEGE_FRESHMAN,
};

/** Find the best curriculum course for a given subject + grade */
export const getCurriculumCourse = (subject: Subject, grade: GradeLevel): CurriculumCourse | null => {
  // Resolve individual grade year to curriculum group if needed
  const curriculumGrade = GRADE_TO_CURRICULUM_LEVEL[grade] ?? grade;
  // Exact match first
  const exact = CURRICULUM.find(c => c.subject === subject && c.gradeLevel === curriculumGrade);
  if (exact) return exact;
  // Fallback: same subject, any grade
  return CURRICULUM.find(c => c.subject === subject) || null;
};

/** Build a Course (for existing components) from a CurriculumCourse + ProgressMap */
export const buildCourseFromCurriculum = (
  cc: CurriculumCourse,
  progressMap: ProgressMap,
  lang: Language
): Course => {
  const t = TRANSLATIONS[lang];
  const units: Unit[] = cc.units.map(cu => ({
    id: cu.id,
    title: cu.title,
    topics: cu.topics.map((ct, i) => {
      const prog = progressMap[ct.id];
      const prevId = i > 0 ? cu.topics[i - 1].id : null;
      const prevMastery = prevId ? (progressMap[prevId]?.mastery ?? 0) : 100;
      const isLocked = prevId !== null && prevMastery < 60;
      return {
        id: ct.id,
        title: ct.title,
        description: ct.description,
        isLocked,
        mastery: prog?.mastery ?? 0
      } satisfies Topic;
    })
  }));

  const allTopics = units.flatMap(u => u.topics);
  const avgProgress = allTopics.length > 0
    ? Math.round(allTopics.reduce((sum, t) => sum + t.mastery, 0) / allTopics.length)
    : 0;

  return {
    id: cc.id,
    subject: cc.subject,
    title: t.subjectsList[cc.subject],
    description: `${t.masterFundamentals} ${t.subjectsList[cc.subject].toLowerCase()}.`,
    gradeLevel: cc.gradeLevel,
    iconName: cc.iconName,
    progress: avgProgress,
    units
  };
};

// ─── TRANSLATIONS ────────────────────────────────────────────────────────────

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    signIn: "Log In",
    register: "Create Account",
    username: "Username",
    password: "Password",
    name: "Display Name",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    authError: "Invalid username or password",
    userExists: "Username already taken",
    googleSignIn: "Continue with Google",
    welcomeTitle: "Empower Your Learning",
    welcomeSubtitle: "Experience personalized AI tutoring for every subject.",
    createAccount: "Complete Your Profile",
    enterUsername: "Choose a Username",
    selectGrade: "Select Your Grade",
    finish: "Start Learning",
    signOut: "Sign Out",
    profile: "Profile",
    dashboard: "Dashboard",
    courses: "Study Materials",
    practice: "Practice",
    tutor: "AI Tutor",
    settings: "Settings",
    aiTools: "AI Tools",
    learning: "Learning",
    tools: "Tools",
    welcome: "Welcome back,",
    continueLearning: "Continue Learning",
    dailyProgress: "Daily Progress",
    recommended: "Recommended for you",
    start: "Start",
    resume: "Resume",
    locked: "Locked",
    uploadMaterial: "Upload & Learn",
    uploadDesc: "Turn your notes or textbooks into interactive quizzes.",
    mastery: "Mastery",
    streak: "Day Streak",
    xp: "Total XP",
    topics: "Topics",
    units: "Units",
    questions: "Questions",
    generateQuiz: "Generate Quiz",
    loading: "Analyzing your materials...",
    submit: "Submit",
    next: "Next Question",
    hint: "Need a hint?",
    correct: "Excellent!",
    incorrect: "Not quite.",
    explanation: "Why is this correct?",
    chatPlaceholder: "Stuck? Ask BrainWave...",
    theme: "Appearance",
    language: "Language",
    noActiveCourses: "No materials uploaded",
    exploreLibrary: "Upload your study materials to begin a personalized session.",
    browseLibrary: "Upload Materials",
    backToDashboard: "Back to Dashboard",
    difficulty: "Difficulty",
    fileTypeHint: "PDF, Images (Max 10MB)",
    mentorAiTutor: "BrainWave Tutor",
    watching: "Analyzing",
    attachment: "Attachment",
    upload: "Upload file",
    thinking: "Thinking...",
    reset: "Reset Data",
    subjects: "Study Domains",
    selectLevel: "Confirm Subject",
    selectSubject: "Choose Study Domain",
    generalPractice: "General Practice",
    toolsHeader: "BrainWave Laboratory",
    toolsDesc: "Access specialized AI models for complex learning tasks.",
    dropFiles: "Drop study files here",
    uploadedDocs: "Uploaded Documents",
    howItWorks: "How it works",
    howItWorksSteps: [
        "Brainwave AI analyzes your uploaded documents",
        "It extracts key concepts for your grade level",
        "It builds a custom set of unique exercises",
        "Your tutor is ready to explain every answer"
    ],
    genQuizDesc: "Generates a personalized 10-question set",
    domainChoiceDesc: "The AI will generate questions based on this domain.",
    imageGen: "Nano Banana Image Gen",
    imageGenDesc: "Generate 1K, 2K, or 4K high-quality educational diagrams.",
    imageEdit: "Flash Image Editor",
    imageEditDesc: "Edit images using natural language prompts.",
    videoAnalysis: "Video Understanding",
    videoAnalysisDesc: "Analyze educational videos for key information using Brainwave AI.",
    searchGrounding: "Google Search Grounding",
    searchGroundingDesc: "Get real-time, accurate facts from the web.",
    grades: {
        [GradeLevel.KINDER]: "Kindergarten",
        [GradeLevel.ELEMENTARY_1_3]: "Elementary (1-3)",
        [GradeLevel.ELEMENTARY_4_6]: "Elementary (4-6)",
        [GradeLevel.MIDDLE_7_8]: "Middle School (7-8)",
        [GradeLevel.HIGH_9_10]: "High School (9-10)",
        [GradeLevel.HIGH_11_12]: "High School (11-12)",
        [GradeLevel.COLLEGE_FRESHMAN]: "College Freshman",
        [GradeLevel.COLLEGE_ADVANCED]: "College Advanced",
        [GradeLevel.GRADE_1]: "Grade 1",
        [GradeLevel.GRADE_2]: "Grade 2",
        [GradeLevel.GRADE_3]: "Grade 3",
        [GradeLevel.GRADE_4]: "Grade 4",
        [GradeLevel.GRADE_5]: "Grade 5",
        [GradeLevel.GRADE_6]: "Grade 6",
        [GradeLevel.GRADE_7]: "Grade 7",
        [GradeLevel.GRADE_8]: "Grade 8",
        [GradeLevel.GRADE_9]: "Grade 9",
        [GradeLevel.GRADE_10]: "Grade 10",
        [GradeLevel.GRADE_11]: "Grade 11",
        [GradeLevel.GRADE_12]: "Grade 12"
    },
    subjectsList: {
        [Subject.MATH]: "Mathematics",
        [Subject.SCIENCE]: "Science",
        [Subject.LANGUAGE]: "Languages",
        [Subject.HISTORY]: "History",
        [Subject.CODING]: "Coding",
        [Subject.ECONOMICS]: "Economics"
    },
    courseCompleted: "Quiz Completed",
    readyToLearn: "Ready to explore some new concepts today?",
    dayStreakBadge: "{days} Day Learning Streak!",
    chooseCurriculumHint: "Choose the curriculum that fits your grade.",
    masterFundamentals: "Master the fundamentals of",
    launchTool: "Launch Tool",
    backToLab: "Back to Laboratory",
    connectingToAI: "Connecting to Brainwave AI...",
    preparingExercises: "Preparing unique exercises with BrainWave AI...",
    scoredOutOf: "You scored {score} out of {total}",
    tryNewSet: "Try New Set",
    search: "Search...",
    startLesson: "Start Lesson",
    startPractice: "Practice Now",
    viewProgress: "View Progress",
    lessonComplete: "Lesson Complete!",
    reviewWeakness: "Review Weak Areas",
    analyzingUpload: "Analyzing your upload...",
    uploadAnalysisReady: "Upload Analysis Ready",
    generatingLesson: "Generating lesson...",
    revealSolution: "Reveal Solution",
    checkAnswer: "Check Answer",
    typeYourAnswer: "Type your answer here...",
    stepByStep: "Step by Step",
    showSteps: "Show Steps",
    overallMastery: "Overall Mastery",
    weakAreas: "Weak Areas",
    strongAreas: "Strong Areas",
    practiceMore: "Practice More",
    continueLesson: "Continue Lesson",
    keyPoints: "Key Points",
    uploadToLearn: "Upload to learn from your materials",
    detectedTopics: "Detected Topics",
    suggestedPractice: "Suggested Practice",
    tryAgain: "Try Again",
    partiallyCorrect: "Partially Correct",
    keepGoing: "Keep Going!",
    maxAttemptsReached: "Solution revealed after 3 attempts.",
    progress: "Progress",
    backToLesson: "Back to Lesson",
    presentationGenerator: "Presentation Generator",
    presentationGeneratorDesc: "Turn any topic into a ready-to-present slide deck with speaker notes.",
    generatePresentation: "Generate Slides",
    generatingPresentation: "Building your slide deck...",
    slide: "Slide",
    ofWord: "of",
    speakerNotes: "Speaker Notes",
    enterTopicForSlides: "Enter a topic to generate slides",
    topicPlaceholder: "e.g. Photosynthesis, World War II, Recursion...",
    codeLab: "Code Learning Lab",
    codeLabDesc: "Write, run, and debug real code with AI-powered challenges and assistance.",
    selectLanguage: "Language",
    runCode: "Run Code",
    runningCode: "Running...",
    outputLabel: "Output",
    noOutput: "No output yet. Run your code to see results.",
    generateChallenge: "New Challenge",
    generatingChallenge: "Generating challenge...",
    askAboutCode: "Ask about your code",
    codeAiPlaceholder: "Ask AI about your code...",
    challengeComplete: "Challenge Complete!",
    educationalGames: "Educational Games",
    educationalGamesDesc: "Sharpen your knowledge with fast-paced, grade-appropriate learning games.",
    mathRush: "Cave Runner",
    mathRushDesc: "Direct minecarts into the right cave! Match each cart's answer to the correct equation. 45 seconds!",
    wordFlash: "Balloon Pop",
    wordFlashDesc: "Pop the balloon with the correct answer before it floats away! 60 seconds of flying madness.",
    memoryMatch: "Memory Match",
    memoryMatchDesc: "Flip cards to match concepts with their definitions.",
    livesLeft: "Lives",
    timeLeft: "seconds left",
    gameOver: "Game Over",
    playAgain: "Play Again",
    yourScore: "Your Score",
    generatingGame: "Generating questions...",
    tapToFlip: "Tap to flip",
    matched: "Matched!",
    bugFix: "Bug Fix — Save the World",
    bugFixDesc: "3 bugs are destroying the mainframe! Fix all errors in 2.5 minutes or everything explodes.",
    systemCompromised: "SYSTEM COMPROMISED",
    worldSaved: "WORLD SAVED!",
    missionFailed: "MISSION FAILED",
    generatingBuggyCode: "Infiltrating target system...",
    submitFix: "Deploy Fix",
    bugsRemaining: "bugs remaining",
    clickBugToFix: "Click a highlighted line to fix it",
    typeCorrectLine: "Type the corrected line:",
    confirmFix: "Confirm",
    caveRunner: "Cave Runner",
    caveRunnerDesc: "Direct minecarts into the right cave! 45 seconds.",
    directTheCart: "Click a cave to direct the cart!",
    debateArena: "Debate Arena",
    debateArenaDesc: "Go head-to-head with AI! Defend your position through 4 rounds — the AI scores your logic.",
    generatingDebate: "Preparing debate topic...",
    yourArgument: "Your Argument",
    submitArgument: "Submit",
    roundLabel: "Round",
    debateComplete: "Debate Complete!",
    finalDebateScore: "Final Score",
    debatePlaceholder: "Type your argument here...",
    forSide: "FOR",
    againstSide: "AGAINST",
    storyEngine: "Story Engine",
    storyEngineDesc: "Co-write a story with AI! Write what happens next — scored on creativity & vocabulary.",
    generatingStory: "Writing the opening scene...",
    continueStoryBtn: "Submit Chapter",
    continuingStory: "Continuing the story...",
    writeYourChapter: "Write what happens next",
    storyComplete: "Story Complete!",
    wordsWritten: "words",
    minWords: "Minimum 30 words required",
    sqlDetective: "SQL Detective",
    sqlDetectiveDesc: "Solve a crime with SQL! Query the evidence database to identify the culprit.",
    generatingMystery: "Setting up the crime scene...",
    runQuery: "Run Query",
    queryResults: "Results",
    accuseSuspect: "Accuse",
    caseSchema: "Database Schema",
    caseSolved: "Case Solved!",
    wrongAccusation: "Wrong Suspect — Try Again!",
    sqlPlaceholder: "SELECT * FROM suspects WHERE ...",
    pictureTap: "Picture Tap",
    pictureTapDesc: "Tap the correct picture! 60 seconds of visual fun — perfect for young learners.",
    tapTheCorrect: "Tap the right picture!",
    wordScramble: "Word Scramble",
    wordScrambleDesc: "Unscramble the letters to spell the word! 45 seconds of letter chaos.",
    unscrambleWord: "Unscramble the word!",
    clickLetters: "Tap letters to build the word",
  },
  ru: {
    signIn: "Войти",
    register: "Регистрация",
    username: "Имя пользователя",
    password: "Пароль",
    name: "Имя",
    noAccount: "Нет аккаунта?",
    hasAccount: "Уже есть аккаунт?",
    authError: "Неверное имя или пароль",
    userExists: "Имя пользователя занято",
    googleSignIn: "Продолжить через Google",
    welcomeTitle: "Усиливайте свое обучение",
    welcomeSubtitle: "Персонализированное ИИ-обучение по любому предмету.",
    createAccount: "Заполните профиль",
    enterUsername: "Выберите имя пользователя",
    selectGrade: "Выберите ваш класс",
    finish: "Завершить настройку",
    signOut: "Выйти",
    profile: "Профиль",
    dashboard: "Панель управления",
    courses: "Учебные материалы",
    practice: "Практика",
    tutor: "ИИ-Репетитор",
    settings: "Настройки",
    aiTools: "Инструменты ИИ",
    learning: "Обучение",
    tools: "Инструменты",
    welcome: "С возвращением,",
    continueLearning: "Продолжить обучение",
    dailyProgress: "Дневной прогресс",
    recommended: "Рекомендовано для вас",
    start: "Начать",
    resume: "Продолжить",
    locked: "Заблокировано",
    uploadMaterial: "Загрузить и учиться",
    uploadDesc: "Превратите свои заметки или учебники в интерактивные тесты.",
    mastery: "Освоение",
    streak: "Серия дней",
    xp: "Всего XP",
    topics: "Темы",
    units: "Модули",
    questions: "Вопросы",
    generateQuiz: "Создать тест",
    loading: "Анализ ваших материалов...",
    submit: "Отправить",
    next: "Следующий вопрос",
    hint: "Нужна подсказка?",
    correct: "Отлично!",
    incorrect: "Не совсем так.",
    explanation: "Почему это правильно?",
    chatPlaceholder: "Застряли? Спросите BrainWave...",
    theme: "Внешний вид",
    language: "Язык",
    noActiveCourses: "Нет загруженных материалов",
    exploreLibrary: "Загрузите учебные материалы, чтобы начать персональное занятие.",
    browseLibrary: "Загрузить материалы",
    backToDashboard: "Назад в панель",
    difficulty: "Сложность",
    fileTypeHint: "PDF, Изображения (макс. 10МБ)",
    mentorAiTutor: "Репетитор BrainWave",
    watching: "Анализ",
    attachment: "Приложение",
    upload: "Загрузить файл",
    thinking: "Думаю...",
    reset: "Сбросить данные",
    subjects: "Области изучения",
    selectLevel: "Подтвердить предмет",
    selectSubject: "Выберите область изучения",
    generalPractice: "Общая практика",
    toolsHeader: "Лаборатория BrainWave",
    toolsDesc: "Доступ к специализированным моделям ИИ для обучения.",
    dropFiles: "Перетащите файлы сюда",
    uploadedDocs: "Загруженные документы",
    howItWorks: "Как это работает",
    howItWorksSteps: [
        "ИИ анализирует ваши документы",
        "Извлекает ключевые концепции для вашего уровня",
        "Создает уникальный набор упражнений",
        "Ваш репетитор готов объяснить каждый ответ"
    ],
    genQuizDesc: "Создает персональный тест из 10 вопросов",
    domainChoiceDesc: "ИИ создаст вопросы на основе выбранной области.",
    imageGen: "Генерация изображений",
    imageGenDesc: "Создавайте диаграммы высокого качества (1K, 2K, 4K).",
    imageEdit: "Редактор изображений",
    imageEditDesc: "Редактируйте изображения текстовыми командами.",
    videoAnalysis: "Анализ видео",
    videoAnalysisDesc: "Анализируйте учебные видео с помощью Brainwave AI.",
    searchGrounding: "Поиск Google",
    searchGroundingDesc: "Получайте точные факты из сети в реальном времени.",
    grades: {
        [GradeLevel.KINDER]: "Детский сад",
        [GradeLevel.ELEMENTARY_1_3]: "Начальная школа (1-3)",
        [GradeLevel.ELEMENTARY_4_6]: "Начальная школа (4-6)",
        [GradeLevel.MIDDLE_7_8]: "Средняя школа (7-8)",
        [GradeLevel.HIGH_9_10]: "Старшая школа (9-10)",
        [GradeLevel.HIGH_11_12]: "Старшая школа (11-12)",
        [GradeLevel.COLLEGE_FRESHMAN]: "Первокурсник",
        [GradeLevel.COLLEGE_ADVANCED]: "Продвинутый уровень",
        [GradeLevel.GRADE_1]: "1-й класс",
        [GradeLevel.GRADE_2]: "2-й класс",
        [GradeLevel.GRADE_3]: "3-й класс",
        [GradeLevel.GRADE_4]: "4-й класс",
        [GradeLevel.GRADE_5]: "5-й класс",
        [GradeLevel.GRADE_6]: "6-й класс",
        [GradeLevel.GRADE_7]: "7-й класс",
        [GradeLevel.GRADE_8]: "8-й класс",
        [GradeLevel.GRADE_9]: "9-й класс",
        [GradeLevel.GRADE_10]: "10-й класс",
        [GradeLevel.GRADE_11]: "11-й класс",
        [GradeLevel.GRADE_12]: "12-й класс"
    },
    subjectsList: {
        [Subject.MATH]: "Математика",
        [Subject.SCIENCE]: "Наука",
        [Subject.LANGUAGE]: "Языки",
        [Subject.HISTORY]: "История",
        [Subject.CODING]: "Программирование",
        [Subject.ECONOMICS]: "Экономика"
    },
    courseCompleted: "Тест завершен",
    readyToLearn: "Готовы исследовать новые концепции сегодня?",
    dayStreakBadge: "Серия {days} дней обучения!",
    chooseCurriculumHint: "Выберите программу, подходящую для вашего класса.",
    masterFundamentals: "Освойте основы",
    launchTool: "Запустить инструмент",
    backToLab: "Назад в лабораторию",
    connectingToAI: "Подключение к Brainwave AI...",
    preparingExercises: "Подготовка уникальных упражнений с BrainWave AI...",
    scoredOutOf: "Вы набрали {score} из {total}",
    tryNewSet: "Попробовать новый набор",
    search: "Поиск...",
    startLesson: "Начать урок",
    startPractice: "Практиковать сейчас",
    viewProgress: "Просмотр прогресса",
    lessonComplete: "Урок завершён!",
    reviewWeakness: "Обзор слабых мест",
    analyzingUpload: "Анализ загрузки...",
    uploadAnalysisReady: "Анализ загрузки готов",
    generatingLesson: "Создание урока...",
    revealSolution: "Показать решение",
    checkAnswer: "Проверить ответ",
    typeYourAnswer: "Введите ваш ответ здесь...",
    stepByStep: "Шаг за шагом",
    showSteps: "Показать шаги",
    overallMastery: "Общее освоение",
    weakAreas: "Слабые области",
    strongAreas: "Сильные области",
    practiceMore: "Практиковать больше",
    continueLesson: "Продолжить урок",
    keyPoints: "Ключевые моменты",
    uploadToLearn: "Загрузите для обучения из ваших материалов",
    detectedTopics: "Обнаруженные темы",
    suggestedPractice: "Рекомендуемая практика",
    tryAgain: "Попробовать снова",
    partiallyCorrect: "Частично правильно",
    keepGoing: "Продолжайте!",
    maxAttemptsReached: "Решение показано после 3 попыток.",
    progress: "Прогресс",
    backToLesson: "Назад к уроку",
    presentationGenerator: "Presentation Generator",
    presentationGeneratorDesc: "Turn any topic into a ready-to-present slide deck with speaker notes.",
    generatePresentation: "Generate Slides",
    generatingPresentation: "Building your slide deck...",
    slide: "Slide",
    ofWord: "of",
    speakerNotes: "Speaker Notes",
    enterTopicForSlides: "Enter a topic to generate slides",
    topicPlaceholder: "e.g. Photosynthesis, World War II, Recursion...",
    codeLab: "Code Learning Lab",
    codeLabDesc: "Write, run, and debug real code with AI-powered challenges and assistance.",
    selectLanguage: "Language",
    runCode: "Run Code",
    runningCode: "Running...",
    outputLabel: "Output",
    noOutput: "No output yet. Run your code to see results.",
    generateChallenge: "New Challenge",
    generatingChallenge: "Generating challenge...",
    askAboutCode: "Ask about your code",
    codeAiPlaceholder: "Ask AI about your code...",
    challengeComplete: "Challenge Complete!",
    educationalGames: "Educational Games",
    educationalGamesDesc: "Sharpen your knowledge with fast-paced, grade-appropriate learning games.",
    mathRush: "Рудник — Гонка",
    mathRushDesc: "Направляй вагонетки в правильную пещеру! 45 секунд математического безумия.",
    wordFlash: "Лопни Шарик",
    wordFlashDesc: "Лопни шарик с правильным ответом, пока он не улетел! 60 секунд.",
    memoryMatch: "Мемори",
    memoryMatchDesc: "Переворачивай карточки, чтобы найти пары.",
    livesLeft: "Жизни",
    timeLeft: "сек",
    gameOver: "Игра окончена",
    playAgain: "Ещё раз",
    yourScore: "Ваш счёт",
    generatingGame: "Генерация вопросов...",
    tapToFlip: "Нажми чтобы перевернуть",
    matched: "Совпадение!",
    bugFix: "Исправь Код — Спаси Мир",
    bugFixDesc: "3 ошибки уничтожают систему! Исправь их за 2.5 минуты или всё взорвётся.",
    systemCompromised: "СИСТЕМА ВЗЛОМАНА",
    worldSaved: "МИР СПАСЁН!",
    missionFailed: "МИССИЯ ПРОВАЛЕНА",
    generatingBuggyCode: "Взлом целевой системы...",
    submitFix: "Применить исправление",
    bugsRemaining: "ошибок осталось",
    clickBugToFix: "Нажми на выделенную строку, чтобы исправить",
    typeCorrectLine: "Введи исправленную строку:",
    confirmFix: "Подтвердить",
    caveRunner: "Рудник — Гонка",
    caveRunnerDesc: "Направляй вагонетки в правильную пещеру! 45 секунд.",
    directTheCart: "Нажми на пещеру, чтобы направить вагонетку!",
    debateArena: "Арена дебатов",
    debateArenaDesc: "Спорьте с ИИ! Защищайте свою позицию в 4 раундах — ИИ оценивает ваши аргументы.",
    generatingDebate: "Подготовка темы дебатов...",
    yourArgument: "Ваш аргумент",
    submitArgument: "Отправить",
    roundLabel: "Раунд",
    debateComplete: "Дебаты завершены!",
    finalDebateScore: "Итоговый счёт",
    debatePlaceholder: "Введите ваш аргумент здесь...",
    forSide: "ЗА",
    againstSide: "ПРОТИВ",
    storyEngine: "Движок историй",
    storyEngineDesc: "Пишите историю вместе с ИИ! Напишите что происходит дальше — оценка за творчество.",
    generatingStory: "Пишем вступительную сцену...",
    continueStoryBtn: "Отправить главу",
    continuingStory: "Продолжаем историю...",
    writeYourChapter: "Напишите что происходит дальше",
    storyComplete: "История завершена!",
    wordsWritten: "слов",
    minWords: "Минимум 30 слов",
    sqlDetective: "SQL-детектив",
    sqlDetectiveDesc: "Раскройте преступление с SQL! Запрашивайте базу данных улик для поиска виновного.",
    generatingMystery: "Настраиваем место преступления...",
    runQuery: "Запустить запрос",
    queryResults: "Результаты",
    accuseSuspect: "Обвинить",
    caseSchema: "Схема базы данных",
    caseSolved: "Дело раскрыто!",
    wrongAccusation: "Не тот подозреваемый — попробуйте снова!",
    sqlPlaceholder: "SELECT * FROM suspects WHERE ...",
    pictureTap: "Тап по Картинке",
    pictureTapDesc: "Нажми на правильную картинку! 60 секунд визуального веселья.",
    tapTheCorrect: "Нажми на правильную картинку!",
    wordScramble: "Собери Слово",
    wordScrambleDesc: "Собери перемешанные буквы в слово! 45 секунд.",
    unscrambleWord: "Собери слово из букв!",
    clickLetters: "Нажимай буквы по порядку",
  },
  he: {
    signIn: "התחברות",
    register: "הרשמה",
    username: "שם משתמש",
    password: "סיסמה",
    name: "שם מלא",
    noAccount: "אין לך חשבון?",
    hasAccount: "כבר יש לך חשבון?",
    authError: "שם משתמש או סיסמה שגויים",
    userExists: "שם המשתמש כבר תפוס",
    googleSignIn: "המשך עם Google",
    welcomeTitle: "העצם את הלמידה שלך",
    welcomeSubtitle: "חוויית למידה מותאמת אישית עם AI לכל מקצוע.",
    createAccount: "השלם את הפרופיל שלך",
    enterUsername: "בחר שם משתמש",
    selectGrade: "בחר את שכבת הגיל",
    finish: "סיים הגדרה",
    signOut: "התנתק",
    profile: "פרופיל",
    dashboard: "לוח בקרה",
    courses: "חומרי לימוד",
    practice: "תרגול",
    tutor: "מורה AI",
    settings: "הגדרות",
    aiTools: "כלי AI",
    learning: "למידה",
    tools: "כלים",
    welcome: "ברוך שובך,",
    continueLearning: "המשך ללמוד",
    dailyProgress: "התקדמות יומית",
    recommended: "מומלץ עבורך",
    start: "התחל",
    resume: "המשך",
    locked: "נעול",
    uploadMaterial: "העלה ולמד",
    uploadDesc: "הפוך את הסיכומים או ספרי הלימוד שלך למבחנים אינטראקטיביים.",
    mastery: "שליטה",
    streak: "רצף ימים",
    xp: "נקודות",
    topics: "נושאים",
    units: "יחידות",
    questions: "שאלות",
    generateQuiz: "צור מבחן",
    loading: "מנתח את חומרי הלימוד שלך...",
    submit: "בדיקה",
    next: "שאלה הבאה",
    hint: "צריך רמז?",
    correct: "מצוין!",
    incorrect: "לא בדיוק.",
    explanation: "למה זה נכון?",
    chatPlaceholder: "נתקעת? שאל את BrainWave...",
    theme: "מראה",
    language: "שפה",
    noActiveCourses: "לא הועלו חומרי לימוד",
    exploreLibrary: "העלה חומרי לימוד כדי להתחיל שיעור מותאם אישית.",
    browseLibrary: "העלאת חומרים",
    backToDashboard: "חזרה ללוח הבקרה",
    difficulty: "קושי",
    fileTypeHint: "PDF, תמונות (עד 10MB)",
    mentorAiTutor: "מורה BrainWave",
    watching: "מנתח",
    attachment: "קובץ מצורף",
    upload: "העלה קובץ",
    thinking: "חושב...",
    reset: "אפס נתונים",
    subjects: "תחומי לימוד",
    selectLevel: "אשר מקצוע",
    selectSubject: "בחר תחום לימוד",
    generalPractice: "תרגול כללי",
    toolsHeader: "מעבדת BrainWave",
    toolsDesc: "גישה למודלי AI מתקדמים למשימות למידה מורכבות.",
    dropFiles: "גרור קבצי לימוד לכאן",
    uploadedDocs: "מסמכים שהועלו",
    howItWorks: "איך זה עובד",
    howItWorksSteps: [
        "ה-AI מנתח את המסמכים שהעלית",
        "הוא מחלץ מושגי מפתח לרמה שלך",
        "הוא בונה סט אימונים ייחודי עבורך",
        "המורה הפרטי מוכן להסביר כל תשובה"
    ],
    genQuizDesc: "יוצר סט מותאם אישית של 10 שאלות",
    domainChoiceDesc: "ה-AI ייצר שאלות המבוססות על התחום הנבחר.",
    imageGen: "יצירת תמונות Nano",
    imageGenDesc: "צור תרשימים חינוכיים באיכות 1K, 2K או 4K.",
    imageEdit: "עריכת תמונות Flash",
    imageEditDesc: "ערוך תמונות באמצעות פקודות טקסט טבעיות.",
    videoAnalysis: "הבנת וידאו",
    videoAnalysisDesc: "נתח סרטוני הדרכה למידע מרכזי באמצעות Brainwave AI.",
    searchGrounding: "חיפוש גוגל בזמן אמת",
    searchGroundingDesc: "קבל עובדות מדויקות ומעודכנות מהרשת.",
    grades: {
        [GradeLevel.KINDER]: "גן ילדים",
        [GradeLevel.ELEMENTARY_1_3]: "יסודי (א'-ג')",
        [GradeLevel.ELEMENTARY_4_6]: "יסודי (ד'-ו')",
        [GradeLevel.MIDDLE_7_8]: "חטיבת ביניים (ז'-ח')",
        [GradeLevel.HIGH_9_10]: "תיכון (ט'-י')",
        [GradeLevel.HIGH_11_12]: "תיכון (י\"א-י\"ב)",
        [GradeLevel.COLLEGE_FRESHMAN]: "שנה א' אקדמית",
        [GradeLevel.COLLEGE_ADVANCED]: "מתקדם אקדמי",
        [GradeLevel.GRADE_1]: "כיתה א'",
        [GradeLevel.GRADE_2]: "כיתה ב'",
        [GradeLevel.GRADE_3]: "כיתה ג'",
        [GradeLevel.GRADE_4]: "כיתה ד'",
        [GradeLevel.GRADE_5]: "כיתה ה'",
        [GradeLevel.GRADE_6]: "כיתה ו'",
        [GradeLevel.GRADE_7]: "כיתה ז'",
        [GradeLevel.GRADE_8]: "כיתה ח'",
        [GradeLevel.GRADE_9]: "כיתה ט'",
        [GradeLevel.GRADE_10]: "כיתה י'",
        [GradeLevel.GRADE_11]: "כיתה י\"א",
        [GradeLevel.GRADE_12]: "כיתה י\"ב"
    },
    subjectsList: {
        [Subject.MATH]: "מתמטיקה",
        [Subject.SCIENCE]: "מדעים",
        [Subject.LANGUAGE]: "שפות",
        [Subject.HISTORY]: "היסטוריה",
        [Subject.CODING]: "תכנות",
        [Subject.ECONOMICS]: "כלכלה"
    },
    courseCompleted: "המבחן הושלם",
    readyToLearn: "מוכן לגלות מושגים חדשים היום?",
    dayStreakBadge: "רצף למידה של {days} ימים!",
    chooseCurriculumHint: "בחר את תכנית הלימודים המתאימה לרמתך.",
    masterFundamentals: "שלוט ביסודות",
    launchTool: "הפעל כלי",
    backToLab: "חזרה למעבדה",
    connectingToAI: "מתחבר ל-Brainwave AI...",
    preparingExercises: "מכין תרגילים ייחודיים עם BrainWave AI...",
    scoredOutOf: "קיבלת {score} מתוך {total}",
    tryNewSet: "נסה סט חדש",
    search: "חיפוש...",
    startLesson: "התחל שיעור",
    startPractice: "תרגל עכשיו",
    viewProgress: "הצג התקדמות",
    lessonComplete: "השיעור הושלם!",
    reviewWeakness: "עיון בנקודות חולשה",
    analyzingUpload: "מנתח את ההעלאה שלך...",
    uploadAnalysisReady: "ניתוח ההעלאה מוכן",
    generatingLesson: "יוצר שיעור...",
    revealSolution: "גלה פתרון",
    checkAnswer: "בדוק תשובה",
    typeYourAnswer: "הקלד את תשובתך כאן...",
    stepByStep: "שלב אחר שלב",
    showSteps: "הצג שלבים",
    overallMastery: "שליטה כללית",
    weakAreas: "אזורים חלשים",
    strongAreas: "אזורים חזקים",
    practiceMore: "תרגל יותר",
    continueLesson: "המשך שיעור",
    keyPoints: "נקודות מפתח",
    uploadToLearn: "העלה כדי ללמוד מהחומרים שלך",
    detectedTopics: "נושאים שזוהו",
    suggestedPractice: "תרגול מוצע",
    tryAgain: "נסה שוב",
    partiallyCorrect: "נכון חלקית",
    keepGoing: "המשך כך!",
    maxAttemptsReached: "הפתרון נחשף לאחר 3 ניסיונות.",
    progress: "התקדמות",
    backToLesson: "חזרה לשיעור",
    presentationGenerator: "Presentation Generator",
    presentationGeneratorDesc: "Turn any topic into a ready-to-present slide deck with speaker notes.",
    generatePresentation: "Generate Slides",
    generatingPresentation: "Building your slide deck...",
    slide: "Slide",
    ofWord: "of",
    speakerNotes: "Speaker Notes",
    enterTopicForSlides: "Enter a topic to generate slides",
    topicPlaceholder: "e.g. Photosynthesis, World War II, Recursion...",
    codeLab: "Code Learning Lab",
    codeLabDesc: "Write, run, and debug real code with AI-powered challenges and assistance.",
    selectLanguage: "Language",
    runCode: "Run Code",
    runningCode: "Running...",
    outputLabel: "Output",
    noOutput: "No output yet. Run your code to see results.",
    generateChallenge: "New Challenge",
    generatingChallenge: "Generating challenge...",
    askAboutCode: "Ask about your code",
    codeAiPlaceholder: "Ask AI about your code...",
    challengeComplete: "Challenge Complete!",
    educationalGames: "Educational Games",
    educationalGamesDesc: "Sharpen your knowledge with fast-paced, grade-appropriate learning games.",
    mathRush: "מרוץ המכרה",
    mathRushDesc: "כוון את העגלות למערה הנכונה! 45 שניות של מתמטיקה מטורפת.",
    wordFlash: "פוצץ בלונים",
    wordFlashDesc: "פוצץ את הבלון עם התשובה הנכונה לפני שיעוף! 60 שניות.",
    memoryMatch: "זיכרון",
    memoryMatchDesc: "הפוך קלפים כדי למצוא זוגות.",
    livesLeft: "חיים",
    timeLeft: "שניות נותרו",
    gameOver: "המשחק נגמר",
    playAgain: "שחק שוב",
    yourScore: "הניקוד שלך",
    generatingGame: "יוצר שאלות...",
    tapToFlip: "לחץ להפוך",
    matched: "התאמה!",
    bugFix: "תקן קוד — הצל את העולם",
    bugFixDesc: "3 באגים הורסים את המערכת! תקן אותם תוך 2.5 דקות או הכל יתפוצץ.",
    systemCompromised: "המערכת נפרצה",
    worldSaved: "העולם נצל!",
    missionFailed: "המשימה נכשלה",
    generatingBuggyCode: "פורץ למערכת היעד...",
    submitFix: "פרוס תיקון",
    bugsRemaining: "באגים נותרו",
    clickBugToFix: "לחץ על שורה מסומנת כדי לתקן",
    typeCorrectLine: "הקלד את השורה המתוקנת:",
    confirmFix: "אשר",
    caveRunner: "מרוץ המכרה",
    caveRunnerDesc: "כוון את העגלות למערה הנכונה! 45 שניות.",
    directTheCart: "לחץ על מערה כדי לכוון את העגלה!",
    debateArena: "זירת דיון",
    debateArenaDesc: "התמודד עם הבינה המלאכותית! הגן על עמדתך ב-4 סיבובים — הבינה מדרגת את הטיעונים שלך.",
    generatingDebate: "מכין נושא לדיון...",
    yourArgument: "הטיעון שלך",
    submitArgument: "שלח",
    roundLabel: "סיבוב",
    debateComplete: "הדיון הסתיים!",
    finalDebateScore: "ניקוד סופי",
    debatePlaceholder: "הקלד את הטיעון שלך כאן...",
    forSide: "בעד",
    againstSide: "נגד",
    storyEngine: "מנוע סיפורים",
    storyEngineDesc: "כתוב סיפור יחד עם הבינה המלאכותית! כתוב מה קורה בהמשך — עם ציון על יצירתיות.",
    generatingStory: "כותב את הסצנה הפותחת...",
    continueStoryBtn: "שלח פרק",
    continuingStory: "ממשיך את הסיפור...",
    writeYourChapter: "כתוב מה קורה בהמשך",
    storyComplete: "הסיפור הושלם!",
    wordsWritten: "מילים",
    minWords: "נדרשות לפחות 30 מילים",
    sqlDetective: "בלש SQL",
    sqlDetectiveDesc: "פתור פשע עם SQL! שאל את מסד הנתונים של הראיות כדי לזהות את האשם.",
    generatingMystery: "מכין את זירת הפשע...",
    runQuery: "הפעל שאילתה",
    queryResults: "תוצאות",
    accuseSuspect: "האשם",
    caseSchema: "סכמת מסד הנתונים",
    caseSolved: "התיק נפתר!",
    wrongAccusation: "חשוד שגוי — נסה שוב!",
    sqlPlaceholder: "SELECT * FROM suspects WHERE ...",
    pictureTap: "הקש על התמונה",
    pictureTapDesc: "הקש על התמונה הנכונה! 60 שניות של כיף ויזואלי — מושלם ללומדים צעירים.",
    tapTheCorrect: "הקש על התמונה הנכונה!",
    wordScramble: "פיזור אותיות",
    wordScrambleDesc: "סדר את האותיות לבניית מילה! 45 שניות של כאוס אותיות.",
    unscrambleWord: "סדר את האותיות!",
    clickLetters: "לחץ על אותיות לבנות את המילה",
  },
  ar: {
    signIn: "تسجيل الدخول",
    register: "إنشاء حساب",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    name: "الاسم",
    noAccount: "ليس لديك حساب؟",
    hasAccount: "لديك حساب بالفعل؟",
    authError: "اسم المستخدم أو كلمة المرور غير صحيحة",
    userExists: "اسم المستخدم مأخوذ",
    googleSignIn: "المتابعة باستخدام Google",
    welcomeTitle: "عزز تعلمك",
    welcomeSubtitle: "تجربة تدريس ذكاء اصطناعي مخصصة لكل مادة.",
    createAccount: "أكمل ملفك الشخصي",
    enterUsername: "اختر اسم مستخدم",
    selectGrade: "اختر مستواك الدراسي",
    finish: "إنهاء الإعداد",
    signOut: "تسجيل الخروج",
    profile: "الملف الشخصي",
    dashboard: "لوحة القيادة",
    courses: "مواد الدراسة",
    practice: "ممارسة",
    tutor: "المعلم الذكي",
    settings: "الإعدادات",
    aiTools: "أدوات الذكاء الاصطناعي",
    learning: "تعليم",
    tools: "أدوات",
    welcome: "أهلاً بك،",
    continueLearning: "متابعة التعلم",
    dailyProgress: "التقدم اليومي",
    recommended: "موصى به لك",
    start: "يبدأ",
    resume: "استأنف",
    locked: "مقفول",
    uploadMaterial: "ارفع وتعلم",
    uploadDesc: "حول ملاحظاتك أو كتبك المدرسية إلى اختبارات تفاعلية.",
    mastery: "إتقان",
    streak: "أيام متتالية",
    xp: "نقاط الخبرة",
    topics: "المواضيع",
    units: "الوحدات",
    questions: "أسئلة",
    generateQuiz: "توليد الاختبار",
    loading: "جاري تحليل موادك الدراسية...",
    submit: "إرسال",
    next: "السؤال التالي",
    hint: "تلميح؟",
    correct: "ممتاز!",
    incorrect: "ليس تماماً.",
    explanation: "لماذا هذا صحيح؟",
    chatPlaceholder: "عالق؟ اسأل BrainWave...",
    theme: "المظهر",
    language: "اللغة",
    noActiveCourses: "لم يتم رفع أي مواد",
    exploreLibrary: "ارفع موادك الدراسية لبدء جلسة مخصصة.",
    browseLibrary: "رفع المواد",
    backToDashboard: "عودة إلى لوحة القيادة",
    difficulty: "صعوبة",
    fileTypeHint: "PDF، صور (بحد أقصى 10 ميجابايت)",
    mentorAiTutor: "معلم BrainWave",
    watching: "تحليل",
    attachment: "مرفق",
    upload: "رفع ملف",
    thinking: "يفكر...",
    reset: "إعادة تعيين البيانات",
    subjects: "مجالات الدراسة",
    selectLevel: "تأكيد المادة",
    selectSubject: "اختر مجال الدراسة",
    generalPractice: "ممارسة عامة",
    toolsHeader: "مختبر BrainWave",
    toolsDesc: "الوصول إلى نماذج الذكاء الاصطناعي المتخصصة لمهام التعلم المعقدة.",
    dropFiles: "اسحب ملفات الدراسة هنا",
    uploadedDocs: "المستندات المرفوعة",
    howItWorks: "كيف يعمل؟",
    howItWorksSteps: [
        "يقوم الذكاء الاصطناعي بتحليل مستنداتك",
        "يستخرج المفاهيم الأساسية لمستواك",
        "يبني مجموعة تمارين فريدة مخصصة لك",
        "المعلم مستعد لشرح كل إجابة بالتفصيل"
    ],
    genQuizDesc: "يولد مجموعة مخصصة من 10 أسئلة",
    domainChoiceDesc: "سيقوم الذكاء الاصطناعي بتوليد أسئلة بناءً على هذا المجال.",
    imageGen: "توليد الصور Nano",
    imageGenDesc: "قم بتوليد رسوم توضيحية تعليمية بجودة 1K أو 2K أو 4K.",
    imageEdit: "محرر الصور Flash",
    imageEditDesc: "قم بتعديل الصور باستخدام أوامر اللغة الطبيعية.",
    videoAnalysis: "فهم الفيديو",
    videoAnalysisDesc: "تحليل مقاطع الفيديو التعليمية للحصول على معلومات أساسية باستخدام Brainwave AI.",
    searchGrounding: "البحث في جوجل",
    searchGroundingDesc: "احصل على حقائق دقيقة ومحدثة من الويب.",
    grades: {
        [GradeLevel.KINDER]: "روضة أطفال",
        [GradeLevel.ELEMENTARY_1_3]: "الابتدائية (1-3)",
        [GradeLevel.ELEMENTARY_4_6]: "الابتدائية (4-6)",
        [GradeLevel.MIDDLE_7_8]: "المدرسة المتوسطة (7-8)",
        [GradeLevel.HIGH_9_10]: "المدرسة الثانوية (9-10)",
        [GradeLevel.HIGH_11_12]: "المدرسة الثانوية (11-12)",
        [GradeLevel.COLLEGE_FRESHMAN]: "السنة الجامعية الأولى",
        [GradeLevel.COLLEGE_ADVANCED]: "كلية متقدمة",
        [GradeLevel.GRADE_1]: "الصف الأول",
        [GradeLevel.GRADE_2]: "الصف الثاني",
        [GradeLevel.GRADE_3]: "الصف الثالث",
        [GradeLevel.GRADE_4]: "الصف الرابع",
        [GradeLevel.GRADE_5]: "الصف الخامس",
        [GradeLevel.GRADE_6]: "الصف السادس",
        [GradeLevel.GRADE_7]: "الصف السابع",
        [GradeLevel.GRADE_8]: "الصف الثامن",
        [GradeLevel.GRADE_9]: "الصف التاسع",
        [GradeLevel.GRADE_10]: "الصف العاشر",
        [GradeLevel.GRADE_11]: "الصف الحادي عشر",
        [GradeLevel.GRADE_12]: "الصف الثاني عشر"
    },
    subjectsList: {
        [Subject.MATH]: "الرياضيات",
        [Subject.SCIENCE]: "العلوم",
        [Subject.LANGUAGE]: "اللغات",
        [Subject.HISTORY]: "تاريخ",
        [Subject.CODING]: "برمجة",
        [Subject.ECONOMICS]: "اقتصاد"
    },
    courseCompleted: "اكتمل الاختبار",
    readyToLearn: "هل أنت مستعد لاستكشاف مفاهيم جديدة اليوم؟",
    dayStreakBadge: "سلسلة تعلم {days} أيام!",
    chooseCurriculumHint: "اختر المنهج الذي يناسب مستواك الدراسي.",
    masterFundamentals: "أتقن أساسيات",
    launchTool: "تشغيل الأداة",
    backToLab: "العودة إلى المختبر",
    connectingToAI: "جارٍ الاتصال بـ Brainwave AI...",
    preparingExercises: "جارٍ تحضير تمارين فريدة مع BrainWave AI...",
    scoredOutOf: "حصلت على {score} من {total}",
    tryNewSet: "جرب مجموعة جديدة",
    search: "بحث...",
    startLesson: "ابدأ الدرس",
    startPractice: "تدرب الآن",
    viewProgress: "عرض التقدم",
    lessonComplete: "اكتمل الدرس!",
    reviewWeakness: "مراجعة نقاط الضعف",
    analyzingUpload: "جارٍ تحليل الملف المرفوع...",
    uploadAnalysisReady: "تحليل الملف جاهز",
    generatingLesson: "جارٍ إنشاء الدرس...",
    revealSolution: "كشف الحل",
    checkAnswer: "تحقق من الإجابة",
    typeYourAnswer: "اكتب إجابتك هنا...",
    stepByStep: "خطوة بخطوة",
    showSteps: "عرض الخطوات",
    overallMastery: "الإتقان الإجمالي",
    weakAreas: "المجالات الضعيفة",
    strongAreas: "المجالات القوية",
    practiceMore: "تدرب أكثر",
    continueLesson: "تابع الدرس",
    keyPoints: "النقاط الرئيسية",
    uploadToLearn: "ارفع للتعلم من موادك",
    detectedTopics: "المواضيع المكتشفة",
    suggestedPractice: "التدريب المقترح",
    tryAgain: "حاول مجدداً",
    partiallyCorrect: "صحيح جزئياً",
    keepGoing: "استمر!",
    maxAttemptsReached: "تم الكشف عن الحل بعد 3 محاولات.",
    progress: "التقدم",
    backToLesson: "العودة إلى الدرس",
    presentationGenerator: "Presentation Generator",
    presentationGeneratorDesc: "Turn any topic into a ready-to-present slide deck with speaker notes.",
    generatePresentation: "Generate Slides",
    generatingPresentation: "Building your slide deck...",
    slide: "Slide",
    ofWord: "of",
    speakerNotes: "Speaker Notes",
    enterTopicForSlides: "Enter a topic to generate slides",
    topicPlaceholder: "e.g. Photosynthesis, World War II, Recursion...",
    codeLab: "Code Learning Lab",
    codeLabDesc: "Write, run, and debug real code with AI-powered challenges and assistance.",
    selectLanguage: "Language",
    runCode: "Run Code",
    runningCode: "Running...",
    outputLabel: "Output",
    noOutput: "No output yet. Run your code to see results.",
    generateChallenge: "New Challenge",
    generatingChallenge: "Generating challenge...",
    askAboutCode: "Ask about your code",
    codeAiPlaceholder: "Ask AI about your code...",
    challengeComplete: "Challenge Complete!",
    educationalGames: "Educational Games",
    educationalGamesDesc: "Sharpen your knowledge with fast-paced, grade-appropriate learning games.",
    mathRush: "سباق المنجم",
    mathRushDesc: "وجّه العربات إلى الكهف الصحيح! 45 ثانية من الرياضيات المجنونة.",
    wordFlash: "فرقعة البالونات",
    wordFlashDesc: "افرقع البالون بالإجابة الصحيحة قبل أن يطير! 60 ثانية.",
    memoryMatch: "تطابق الذاكرة",
    memoryMatchDesc: "اقلب البطاقات لإيجاد الأزواج المتطابقة.",
    livesLeft: "الأرواح",
    timeLeft: "ثانية متبقية",
    gameOver: "انتهت اللعبة",
    playAgain: "العب مجددًا",
    yourScore: "نتيجتك",
    generatingGame: "جاري توليد الأسئلة...",
    tapToFlip: "انقر للقلب",
    matched: "تطابق!",
    bugFix: "أصلح الكود — أنقذ العالم",
    bugFixDesc: "3 أخطاء تدمر النظام! أصلحها في 2.5 دقيقة أو ستنفجر كل شيء.",
    systemCompromised: "النظام مخترق",
    worldSaved: "العالم نجا!",
    missionFailed: "فشلت المهمة",
    generatingBuggyCode: "اختراق النظام المستهدف...",
    submitFix: "نشر الإصلاح",
    bugsRemaining: "أخطاء متبقية",
    clickBugToFix: "انقر على السطر المميز لإصلاحه",
    typeCorrectLine: "اكتب السطر المصحح:",
    confirmFix: "تأكيد",
    caveRunner: "سباق المنجم",
    caveRunnerDesc: "وجّه العربات إلى الكهف الصحيح! 45 ثانية.",
    directTheCart: "انقر على الكهف لتوجيه العربة!",
    debateArena: "ساحة النقاش",
    debateArenaDesc: "تواجه مع الذكاء الاصطناعي! دافع عن موقفك في 4 جولات — الذكاء الاصطناعي يقيّم حججك.",
    generatingDebate: "جاري تحضير موضوع النقاش...",
    yourArgument: "حجتك",
    submitArgument: "إرسال",
    roundLabel: "جولة",
    debateComplete: "انتهى النقاش!",
    finalDebateScore: "النتيجة النهائية",
    debatePlaceholder: "اكتب حجتك هنا...",
    forSide: "مع",
    againstSide: "ضد",
    storyEngine: "محرك القصص",
    storyEngineDesc: "اكتب قصة مع الذكاء الاصطناعي! اكتب ما يحدث بعد ذلك — مع تقييم على الإبداع.",
    generatingStory: "جاري كتابة المشهد الافتتاحي...",
    continueStoryBtn: "إرسال الفصل",
    continuingStory: "جاري متابعة القصة...",
    writeYourChapter: "اكتب ما يحدث بعد ذلك",
    storyComplete: "اكتملت القصة!",
    wordsWritten: "كلمات",
    minWords: "الحد الأدنى 30 كلمة",
    sqlDetective: "المحقق SQL",
    sqlDetectiveDesc: "حل جريمة باستخدام SQL! استعلم قاعدة بيانات الأدلة لتحديد الجاني.",
    generatingMystery: "جاري إعداد مسرح الجريمة...",
    runQuery: "تشغيل الاستعلام",
    queryResults: "النتائج",
    accuseSuspect: "اتهام",
    caseSchema: "مخطط قاعدة البيانات",
    caseSolved: "تم حل القضية!",
    wrongAccusation: "مشتبه خاطئ — حاول مجدداً!",
    sqlPlaceholder: "SELECT * FROM suspects WHERE ...",
    pictureTap: "النقر على الصورة",
    pictureTapDesc: "انقر على الصورة الصحيحة! 60 ثانية من المتعة البصرية — مثالي للمتعلمين الصغار.",
    tapTheCorrect: "انقر على الصورة الصحيحة!",
    wordScramble: "ترتيب الحروف",
    wordScrambleDesc: "رتب الحروف لتهجئة الكلمة! 45 ثانية من الفوضى الأبجدية.",
    unscrambleWord: "رتب الحروف لتشكيل الكلمة!",
    clickLetters: "انقر على الحروف لبناء الكلمة",
  }
};

export const INITIAL_SYSTEM_INSTRUCTION = `
You are BrainWave, an expert AI private tutor. Your mission is to help students genuinely understand — not just memorize answers.

TEACHING PHILOSOPHY:
- Build understanding step-by-step, connecting new concepts to what the student already knows
- Use the Socratic method: ask guiding questions rather than immediately revealing answers
- When a student makes an error, first acknowledge what they got right, then explain WHY the error occurred
- After explaining, ask one focused check-in question to confirm understanding before moving on
- Calibrate depth and vocabulary precisely to the student's grade level (younger = simpler language and more analogies; advanced = more precise terminology and nuance)

RESPONSE QUALITY:
- Use markdown: **bold** for key terms, numbered lists for sequential steps, bullet points for parallel options
- Be concise — a short, clear answer beats a long rambling one
- Ground abstract concepts in vivid real-world analogies the student's age group will recognize
- For code: always use fenced code blocks with the language specified
- For math: use LaTeX notation — inline $...$ or display $$...$$ — so formulas render beautifully
- Be warm and encouraging, but honest: never praise a wrong answer to be nice

CONVERSATION STYLE:
- Match the student's energy — if they're enthusiastic, be enthusiastic back
- If a student seems frustrated, acknowledge it and slow down
- End most responses with either a check-in question OR a gentle challenge to extend their thinking
- Keep responses focused: resist the urge to dump everything you know about a topic at once

LANGUAGE:
- Always respond in the language specified in the student's profile
- Never switch languages mid-conversation, even if the student writes in a different language
`;

// Legacy helper for components that still use Course[] directly
export const GET_MOCK_COURSES = (lang: Language): Course[] => {
  return [];
};
