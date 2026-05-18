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
          50:  '#f4f7eb',
          100: '#e3edd1',
          200: '#cbdda8',
          300: '#b1ca7d',
          400: '#93b558',
          500: '#6e9c3f', // olive sage
          600: '#587e32',
          700: '#426027',
          800: '#2e441b',
          900: '#1a2810',
        },

        warning: {
          50:  '#fdf8e7',
          100: '#faecb8',
          200: '#f5dc88',
          300: '#f0cd5e',
          400: '#ecc44f',
          500: '#e8b943', // or miel
          600: '#c69a30',
          700: '#997725',
          800: '#6e561a',
          900: '#423410',
        },

        error: {
          50:  '#fbeeec',
          100: '#f3dad6',
          200: '#e6b4ad',
          300: '#d98e85',
          400: '#cd685e',
          500: '#c43e3a', // brique
          600: '#a3322f',
          700: '#802824',
          800: '#5e1d1a',
          900: '#391010',
        },

        info: {
          50:  '#eef5fa',
          100: '#dceaf2',
          200: '#b6d2e1',
          300: '#8bb4cc',
          400: '#5e96b8',
          500: '#3a7ca5', // bleu pétrole
          600: '#2e6488',
          700: '#234d6a',
          800: '#18374c',
          900: '#0d212e',
        },

        // ===== ACCENT COLORS =====
        accent: {
          50:  '#fbf0eb',
          100: '#f8e5dc',
          200: '#f0c9b6',
          300: '#e8ad90',
          400: '#e0916a',
          500: '#d97757', // terracotta base
          600: '#b85d3f',
          700: '#964a32',
          800: '#743825',
          900: '#522518',
        },

        // ===== INTERFACE COLORS =====
        interface: {
          'bg-primary':   '#fefcf6',         // crème app
          'bg-secondary': '#faf6ea',         // cartes
          'bg-tertiary':  '#f5efe0',         // hover/zones douces
          'bg-white':     '#ffffff',         // zones éditoriales
          'bg-overlay':   'rgba(254, 252, 246, 0.95)',
          'border-primary':   '#ead9b8',     // beige chaud
          'border-secondary': '#e2d2af',     // beige fort
          'text-primary':   '#0d3c4d',       // pétrole
          'text-secondary': '#1f5566',       // pétrole médian
          'text-muted':     '#6b8893',       // ink-3
          'text-disabled':  '#a3b4bd',       // ink-4
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
        'card':         '0 2px 8px rgba(13, 60, 77, 0.08), 0 1px 2px rgba(13, 60, 77, 0.04)',
        'card-hover':   '0 8px 24px rgba(13, 60, 77, 0.10), 0 2px 6px rgba(13, 60, 77, 0.06)',
        'search':       '0 1px 6px rgba(32, 33, 36, 0.18)',
        'search-hover': '0 1px 10px rgba(32, 33, 36, 0.32)',
        'focus':        '0 0 0 3px rgba(73, 178, 178, 0.30)',
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
        'pill':   '999px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
