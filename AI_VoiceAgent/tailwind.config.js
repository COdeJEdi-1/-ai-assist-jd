/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#A61D3A',
          hover: '#8F1832',
          dark: '#5E1124',
        },
        surface: {
          bg: '#F8F9FA',
          card: '#FFFFFF',
        },
        grey: {
          secondary: '#5C6166',
          border: '#E5E7EB',
        },
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#DC2626',
          info: '#2563EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        heading: '700',
        body: '400',
        button: '600',
      },
      maxWidth: {
        layout: '1440px',
      },
      spacing: {
        sidebar: '280px',
        header: '72px',
      },
      borderRadius: {
        card: '16px',
        button: '10px',
        input: '10px',
        popup: '20px',
      },
      boxShadow: {
        card: '0px 4px 20px rgba(0,0,0,0.08)',
        'card-hover': '0px 10px 35px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'progress': 'progress 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        progress: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
}
