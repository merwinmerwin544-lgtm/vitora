/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vitora: {
          bg: '#F5FFF7',
          primary: '#22C55E',
          secondary: '#10B981',
          accent: '#34D399',
          text: '#1F2937',
          glass: 'rgba(255, 255, 255, 0.45)',
          border: 'rgba(255, 255, 255, 0.60)',
        }
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        glass: '24px',
      }
    },
  },
  plugins: [],
}
