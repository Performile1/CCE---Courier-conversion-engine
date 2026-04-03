/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.tsx",
    "./*.jsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./mobile/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DHL Brand Colors
        'dhl-yellow': '#FFCC00',
        'dhl-red': '#D00000',
        'dhl-black': '#333333',
        'dhl-gray-light': '#F5F5F5',
        'dhl-gray-medium': '#E0E0E0',
        'dhl-gray-dark': '#666666',
      },
      borderRadius: {
        'none': '0px',
        'sm': '2px',
        'md': '4px',
      },
      zIndex: {
        'base': '0',
        'banner': '20',
        'sticky': '30',
        'dropdown': '40',
        'modal': '100',
        'critical': '120',
      },
    },
  },
  plugins: [],
}
