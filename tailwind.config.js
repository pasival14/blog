/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': { 'raw': '(min-width: 430px) and (max-height: 932px)'},
        'ml': { 'raw': '(min-width: 1200px) and (max-height: 768px)' },
        'ma': { 'raw': '(width: 1280px) and (height: 800px)' },
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: ["light", "dark", "synthwave"],
  },
}

