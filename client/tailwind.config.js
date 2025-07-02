/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Main brand blue
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Secondary brand colors (indigo)
        secondary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Neutral colors
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Success colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Warning colors
        warning: {
          50: '#fefce8',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Error colors
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Surface colors
        surface: {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          elevated: 'rgba(255, 255, 255, 0.9)',
          glass: 'rgba(255, 255, 255, 0.25)',
        },
        // Text colors
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          tertiary: '#64748b',
          inverse: '#ffffff',
          muted: '#94a3b8',
        },
        // Border colors
        border: {
          primary: '#e2e8f0',
          secondary: '#cbd5e1',
          focus: '#3b82f6',
          error: '#fecaca',
          success: '#bbf7d0',
          warning: '#fde68a',
        },
        // Background gradients
        gradient: {
          primary: {
            from: '#3b82f6',
            to: '#6366f1',
          },
          secondary: {
            from: '#f8fafc',
            to: '#e0f2fe',
          },
          hero: {
            from: '#f1f5f9',
            via: '#eff6ff',
            to: '#e0e7ff',
          },
        },
      },
      // Custom animations
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in-scale': 'fadeInScale 0.5s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'float-horizontal': 'float-horizontal 8s ease-in-out infinite',
        'float-diagonal': 'float-diagonal 12s ease-in-out infinite',
        'float-circular': 'float-circular 15s linear infinite',
        'float-gentle': 'float-gentle 10s ease-in-out infinite',
        'float-wave': 'float-wave 6s ease-in-out infinite',
        'float-vertical': 'float-vertical 7s ease-in-out infinite',
        'float-swing': 'float-swing 9s ease-in-out infinite',
      },
      // Custom keyframes
      keyframes: {
        fadeInUp: {
          from: {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeInScale: {
          from: {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-10px)',
          },
        },
        'float-horizontal': {
          '0%, 100%': {
            transform: 'translateX(0px) translateY(0px)',
          },
          '25%': {
            transform: 'translateX(30px) translateY(-15px)',
          },
          '50%': {
            transform: 'translateX(60px) translateY(0px)',
          },
          '75%': {
            transform: 'translateX(30px) translateY(15px)',
          },
        },
        'float-diagonal': {
          '0%, 100%': {
            transform: 'translateX(0px) translateY(0px)',
          },
          '25%': {
            transform: 'translateX(40px) translateY(-30px)',
          },
          '50%': {
            transform: 'translateX(80px) translateY(-60px)',
          },
          '75%': {
            transform: 'translateX(40px) translateY(-30px)',
          },
        },
        'float-circular': {
          '0%': {
            transform: 'translateX(0px) translateY(0px)',
          },
          '25%': {
            transform: 'translateX(50px) translateY(-50px)',
          },
          '50%': {
            transform: 'translateX(0px) translateY(-100px)',
          },
          '75%': {
            transform: 'translateX(-50px) translateY(-50px)',
          },
          '100%': {
            transform: 'translateX(0px) translateY(0px)',
          },
        },
        'float-gentle': {
          '0%, 100%': {
            transform: 'translateX(0px) translateY(0px) rotate(0deg)',
          },
          '33%': {
            transform: 'translateX(20px) translateY(-25px) rotate(120deg)',
          },
          '66%': {
            transform: 'translateX(-15px) translateY(-40px) rotate(240deg)',
          },
        },
        'float-wave': {
          '0%, 100%': {
            transform: 'translateY(0px) translateX(0px)',
          },
          '25%': {
            transform: 'translateY(-20px) translateX(15px)',
          },
          '50%': {
            transform: 'translateY(0px) translateX(30px)',
          },
          '75%': {
            transform: 'translateY(20px) translateX(15px)',
          },
        },
        'float-vertical': {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '25%': {
            transform: 'translateY(-40px)',
          },
          '50%': {
            transform: 'translateY(-80px)',
          },
          '75%': {
            transform: 'translateY(-40px)',
          },
        },
        'float-swing': {
          '0%, 100%': {
            transform: 'translateX(0px) translateY(0px) rotate(0deg)',
          },
          '25%': {
            transform: 'translateX(-25px) translateY(-20px) rotate(-10deg)',
          },
          '50%': {
            transform: 'translateX(0px) translateY(-40px) rotate(0deg)',
          },
          '75%': {
            transform: 'translateX(25px) translateY(-20px) rotate(10deg)',
          },
        },
      },
    },
  },
  plugins: [],
}