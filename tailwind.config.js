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
          primary: 'rgb(var(--color-brand-primary) / <alpha-value>)',
          accent: 'rgb(var(--color-brand-accent) / <alpha-value>)',
        },
        surface: {
          page: 'rgb(var(--color-surface-page) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },
        type: {
          feature: 'rgb(var(--color-type-feature) / <alpha-value>)',
          bug: 'rgb(var(--color-type-bug) / <alpha-value>)',
        },
        due: {
          safe: 'rgb(var(--color-due-safe) / <alpha-value>)',
          warning: 'rgb(var(--color-due-warning) / <alpha-value>)',
          overdue: 'rgb(var(--color-due-overdue) / <alpha-value>)',
          neutral: 'rgb(var(--color-due-neutral) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
