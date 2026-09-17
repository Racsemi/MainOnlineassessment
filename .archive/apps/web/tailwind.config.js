/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8ec1ff',
          400: '#599dff',
          500: '#3277fb',
          600: '#1d57f0',
          700: '#1541dd',
          800: '#1736b2',
          900: '#18318c',
          950: '#0f172a'
        },
        slate: {
          850: '#131c2e',
          900: '#0f172a',
          950: '#090d16'
        }
      }
    },
  },
  plugins: [],
};
