module.exports = {
  content: ['./index.html', './*.tsx', './components/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  ...{
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
              display: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
              mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
            },
            colors: {
              cream: {
                50:  '#FBFAF6',
                100: '#F7F5EE',
                200: '#EFEBDD',
                300: '#E5DFC8',
                400: '#D4CDB0',
              },
              ink: {
                50:  '#F5F4F1',
                100: '#E8E6E0',
                200: '#C9C6BC',
                300: '#928D7E',
                400: '#5C594F',
                500: '#3A3833',
                600: '#28261F',
                700: '#1A1815',
                800: '#0F0E0C',
                900: '#080706',
              },
              moss: {
                50:  '#F0F4F0',
                100: '#DCE6DD',
                200: '#B6CABA',
                300: '#7FA890',
                400: '#508A6C',
                500: '#2D6A4F',
                600: '#1F4D38',
                700: '#163829',
                800: '#0E251B',
              },
              clay: {
                50:  '#FBF1EC',
                100: '#F5DDD0',
                200: '#EDC2AC',
                300: '#E29D7F',
                400: '#D4754F',
                500: '#B85A35',
              },
              sun: {
                50:  '#FDF6E0',
                100: '#FAEAB0',
                200: '#F5D870',
                300: '#EFC233',
                400: '#D9A813',
                500: '#A87E0A',
              },
            },
            borderRadius: {
              'xl':  '14px',
              '2xl': '20px',
              '3xl': '28px',
              '4xl': '36px',
            },
            boxShadow: {
              'paper':     '0 1px 0 rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.04)',
              'paper-hover':'0 8px 24px rgba(0,0,0,0.08)',
              'lift':      '0 12px 32px rgba(0,0,0,0.08)',
              'moss':      '0 4px 16px rgba(45,106,79,0.25)',
            },
            animation: {
              'spin-slow': 'spin 20s linear infinite',
            }
          }
        }
      }
};
