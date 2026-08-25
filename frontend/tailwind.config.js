/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12141a",
        graph: {
          50: "#eef4ff",
          100: "#d9e6ff",
          400: "#5b7fff",
          500: "#3b5cff",
          600: "#2c47db",
          700: "#2438ad",
        },
      },
    },
  },
  plugins: [],
};
