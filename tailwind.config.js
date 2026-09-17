/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F6F3',
        surface: '#FFFFFF',
        line: '#E1E0DA',
        ink: '#1C1E1B',
        muted: '#6B6E68',
        faint: '#9A9C95',
        zen: {
          DEFAULT: '#2E6B4F',
          dark: '#234F3B',
          soft: '#E7F0EA',
        },
        status: {
          new: '#3B6FA0',
          newSoft: '#E9EFF6',
          progress: '#B8862B',
          progressSoft: '#F5EEDD',
          resolved: '#2E6B4F',
          resolvedSoft: '#E7F0EA',
          escalated: '#B23A3A',
          escalatedSoft: '#F6E6E5',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};
