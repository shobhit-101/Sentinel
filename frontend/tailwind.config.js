/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // We are adding a sleek, dark-mode inspired minimal color palette
        background: '#0a0a0a',
        surface: '#171717',
        primary: '#3b82f6', // A clean, professional blue
        textMain: '#f5f5f5',
        textMuted: '#a3a3a3',
        border: '#262626'
      }
    },
  },
  plugins: [],
}