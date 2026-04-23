import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'mlb-navy': '#001f5b',
        'mlb-red': '#b8001a',
        'mlb-cream': '#f3f0e8',
      },
      fontFamily: {
        sans: ["'Barlow'", 'system-ui', 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
        serif: ["'Barlow Condensed'", 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
