/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // ===== BRAND COLORS =====
        brand: {
          50: '#f0fafa',
          100: '#ccf2f2',
          200: '#99e5e5',
          300: '#66d9d9',
          400: '#33cccc',
          500: '#49B2B2', // Votre couleur principale
          600: '#3a8f8f',
          700: '#2b6b6b',
          800: '#1c4848',
          900: '#0d2424',
          primary: '#49B2B2', // Alias pour faciliter la migration
        },

        // ===== SEMANTIC COLORS =====
        success: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#66bb6a', // Votre vert actuel
          600: '#4ade80',
          700: '#22c55e',
          800: '#16a34a',
          900: '#15803d',
        },
        
        warning: {
          50: '#fefce8',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#ffee58', // Votre jaune actuel
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#f44336', // Votre rouge actuel
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },

        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#4285F4', // Votre bleu actuel
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // ===== INTERFACE COLORS =====
        interface: {
          'bg-primary': '#ffffff',
          'bg-secondary': '#f8f9fa',
          'bg-tertiary': '#f3f4f6',
          'bg-overlay': 'rgba(255, 255, 255, 0.95)',
          'border-primary': '#e2e8f0',
          'border-secondary': '#d1d5db',
          'text-primary': 'rgba(0, 0, 0, 0.87)',
          'text-secondary': 'rgba(0, 0, 0, 0.6)',
          'text-muted': '#6b7280',
          'text-disabled': 'rgba(0, 0, 0, 0.38)',
        },

        // ===== SEARCH SPECIFIC =====
        search: {
          icon: '#9AA0A6',
          shadow: 'rgba(32, 33, 36, 0.28)',
          'shadow-hover': 'rgba(32, 33, 36, 0.45)',
        },

        // ===== LOADER COLORS =====
        loader: {
          1: '#4285F4', // info
          2: '#EA4335', // rouge Google
          3: '#FBBC05', // jaune Google
          4: '#34A853', // vert Google
        },
      },

      // ===== TYPOGRAPHY =====
      fontFamily: {
        primary: ['Source Sans Pro', 'sans-serif'],
        heading: ['Nunito', 'sans-serif'],
      },

      // ===== SPACING & LAYOUT =====
      spacing: {
        'header': '3.5rem',
        'header-mobile': '3rem',
      },

      // ===== SHADOWS =====
      boxShadow: {
        'search': '0 1px 6px rgba(32, 33, 36, 0.28)',
        'search-hover': '0 1px 10px rgba(32, 33, 36, 0.45)',
        'card-hover': '0 4px 6px rgba(0, 0, 0, 0.1)',
      },

      // ===== ANIMATIONS =====
      keyframes: {
        'loader-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'slide-in-from-top': {
          'from': { opacity: '0', transform: 'translateY(-4px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'loader-bounce': 'loader-bounce 1.4s ease infinite',
        'slide-in': 'slide-in-from-top 0.2s ease-out'
      },

      // ===== BORDER RADIUS =====
      borderRadius: {
        'search': '24px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}