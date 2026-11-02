// English is the source of truth: every other language must match this shape.
export const en = {
  app: { name: 'BrainWave', tagline: 'Your AI study partner' },
  nav: {
    home: 'Home', learn: 'Learn', lectures: 'Lectures', videos: 'Video lessons',
    podcasts: 'Podcasts', settings: 'Settings', signOut: 'Sign out', menu: 'Menu', account: 'Account',
  },
  common: {
    loading: 'Loading…', save: 'Save', saving: 'Saving…', saved: 'Saved', cancel: 'Cancel',
    continue: 'Continue', back: 'Back', tryAgain: 'Try again', comingSoon: 'Coming soon',
    close: 'Close', or: 'or', open: 'Open',
  },
  auth: {
    welcomeTitle: 'Learn anything, your way.',
    welcomeBody: 'Lessons that adapt to you, lecture notes written for you, and video lessons and podcasts made from anything you study.',
    signInTitle: 'Sign in',
    signUpTitle: 'Create your account',
    email: 'Email', password: 'Password',
    passwordHint: 'At least 8 characters',
    signIn: 'Sign in', signUp: 'Create account',
    google: 'Continue with Google',
    haveAccount: 'Already have an account?', noAccount: 'New to BrainWave?',
    switchToSignIn: 'Sign in', switchToSignUp: 'Create an account',
    checkEmail: 'Check your inbox to confirm your email, then sign in.',
    forgot: 'Forgot password?',
    resetSent: 'If that email has an account, a reset link is on its way.',
    demoTitle: 'Demo mode',
    demoBody: 'Accounts are not set up on this server yet, so your progress will be saved in this browser only.',
    demoStart: 'Try BrainWave',
    errors: {
      generic: 'Something went wrong. Please try again.',
      invalid: 'Email or password is incorrect.',
      weakPassword: 'Use at least 8 characters.',
      emailTaken: 'An account with this email already exists.',
    },
  },
  onboarding: {
    title: "Let's set you up",
    subtitle: 'This helps BrainWave explain things at the right level.',
    name: 'What should we call you?', namePlaceholder: 'Your first name',
    grade: 'What are you studying?', language: 'App language',
    finish: 'Start learning',
  },
  grades: {
    k: 'Kindergarten', '1': 'Grade 1', '2': 'Grade 2', '3': 'Grade 3', '4': 'Grade 4', '5': 'Grade 5',
    '6': 'Grade 6', '7': 'Grade 7', '8': 'Grade 8', '9': 'Grade 9', '10': 'Grade 10', '11': 'Grade 11',
    '12': 'Grade 12', college: 'College / university',
  },
  languages: { en: 'English', he: 'עברית (Hebrew)' },
  home: {
    greeting: (name: string) => (name ? `Hi, ${name}` : 'Hi there'),
    subtitle: 'What do you want to work on today?',
    learnTitle: 'Learn', learnBody: 'Courses from kindergarten to college, with a tutor that guides you step by step.',
    lecturesTitle: 'Lectures', lecturesBody: 'Record or upload a class and get a transcript, notes, a quiz and flashcards.',
    videosTitle: 'Video lessons', videosBody: 'Turn any topic or lecture into a short animated, narrated lesson.',
    podcastsTitle: 'Podcasts', podcastsBody: 'Listen to two hosts talk through any topic — great for revision on the go.',
  },
  settings: {
    title: 'Settings',
    profile: 'Profile', appearance: 'Appearance', theme: 'Theme',
    themeLight: 'Light', themeDark: 'Dark', themeSystem: 'Match my device',
    account: 'Account', signedInAs: (email: string) => `Signed in as ${email}`,
    demoNote: 'Demo mode: progress is saved in this browser only.',
  },
  notFound: { title: 'Page not found', body: "We couldn't find that page.", home: 'Go home' },
  errors: { boundary: 'Something went wrong on this page.', reload: 'Reload' },
};

export type Dict = typeof en;
