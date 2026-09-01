import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        island: {
          soil: '#6B4226',
          soilWet: '#3E2723',
          grass: '#4CAF50',
          water: '#29B6F6',
          gold: '#FFD700',
        },
      },
      fontFamily: {
        game: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
