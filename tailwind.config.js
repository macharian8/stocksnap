/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        inventory: {
          primary: '#2563EB',
          background: '#EFF6FF',
          accent: '#1D4ED8',
        },
        pos: {
          primary: '#16A34A',
          background: '#F0FDF4',
          accent: '#15803D',
        },
      },
    },
  },
  plugins: [],
};
