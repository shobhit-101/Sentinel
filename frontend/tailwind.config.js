/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // True-black base, vibrant violet, cyan as the secondary accent.
        // Red / amber are reserved for failure and in-progress states.
        background: '#000000',
        surface: '#111113',
        elevated: '#18181b',
        border: '#27272a',
        textMain: '#fafafa',
        textMuted: '#a1a1aa',
        textFaint: '#52525b',
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
