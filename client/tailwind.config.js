/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4361EE',       // Primary Indigo
          dark: '#1A1F36',          // Base background/nav
          light: '#EDF2FA',         // Card/hover
          accent: '#00B894',        // Success Teal
          alert: '#FFCB05',         // Warning Yellow
          error: '#FF6B6B',         // Fail states
        },
        gray: {
          900: '#1A1F36',           // Heavy text
          700: '#5A5E6B',           // Secondary text
          500: '#AAB0C0',           // Borders, subtle text
          300: '#E4E7ED',           // Dividers, outlines
          100: '#F7F9FC',           // Background
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.06)',
        input: '0 0 0 1px #AAB0C0',
      },
    },
  },
  plugins: [],
}