/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f6f8fa",
          100: "#eef1f5",
          200: "#dde3ea",
          300: "#c3ccd7",
          400: "#8d99a8",
          500: "#647183",
          600: "#4a5566",
          700: "#364050",
          800: "#232b37",
          900: "#141a23",
        },
        brand: {
          50: "#ecfeff",
          100: "#cff8fe",
          200: "#a3eefb",
          300: "#64dcf4",
          400: "#22c0e3",
          500: "#08a2c6",
          600: "#0a81a6",
          700: "#106886",
          800: "#15556e",
          900: "#16475d",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,26,35,.06), 0 4px 16px rgba(20,26,35,.06)",
        float: "0 2px 6px rgba(20,26,35,.08), 0 12px 32px rgba(20,26,35,.14)",
      },
    },
  },
  plugins: [],
};
