/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          primary: '#245C4F',
          accent: '#934A2F',
        },
        surface: {
          page: '#F7F6F2',
          card: '#FFFFFF',
        },
        text: {
          primary: '#1D2926',
          muted: '#53615C',
        },
        type: {
          feature: '#6F42A1',
          bug: '#B42318',
        },
        due: {
          safe: '#246B53',
          warning: '#91600B',
          overdue: '#B42318',
          neutral: '#667085',
        },
      },
    },
  },
  plugins: [],
};
