/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Violet + near-black. Status accents use Tailwind's built-in
        // cyan / amber / red scales directly.
        background: '#09090b',
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
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
