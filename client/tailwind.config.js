export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
          500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
      },
      boxShadow: { card: '0 1px 2px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.4)' },
      keyframes: {
        // Beam wrapper is h-20 (~27% of the frame). Starting/ending past the
        // frame edges makes the beam fully enter and exit on each sweep
        // (down, then back up) instead of bouncing mid-frame.
        'scan-line': {
          '0%, 100%': { top: '-30%' },
          '50%': { top: '110%' },
        },
      },
      animation: { 'scan-line': 'scan-line 2.4s ease-in-out infinite' },
    },
  },
  plugins: [],
};
