/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f5f4ee',
        surface: '#FFFFFF',
        line: '#e3e1d4',
        ink: '#101b19',
        muted: '#5b6660',
        faint: '#8a9089',
        zen: {
          DEFAULT: '#b7d52d',
          dark: '#4a5c1a',
          soft: '#eef4d6',
          ink: '#101b19',
        },
        status: {
          new: '#3B6FA0',
          newSoft: '#E9EFF6',
          progress: '#B8862B',
          progressSoft: '#F5EEDD',
          resolved: '#4a5c1a',
          resolvedSoft: '#eef4d6',
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