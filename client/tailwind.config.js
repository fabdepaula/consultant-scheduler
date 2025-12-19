/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NGR Global brand colors
        'ngr-primary': '#003366',
        'ngr-secondary': '#0066CC',
        'ngr-light': '#E6F0FA',
        'ngr-accent': '#0099FF',
        // Status colors conforme especificação
        'status-confirmado-presencial': '#FFFF00',
        'status-confirmado-remoto': '#4472C4',
        'status-a-confirmar': '#70AD47',
        'status-livre': '#C6EFCE',
        'status-bloqueado': '#808080',
        'status-conflito': '#FF0000',
        'status-ponte': '#BFBFBF',
        'status-feriado': '#A6A6A6',
        'status-fim-semana': '#D9D9D9',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
