/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#36abf8',
          500: '#0c90ea',
          600: '#0072c7',
          700: '#015ba1',
          800: '#064d84',
          900: '#0b426d',
          950: '#072a49',
        },
      },
    },
  },
  plugins: [],
}
