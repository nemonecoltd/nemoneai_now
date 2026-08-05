/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // PACE 브랜드 컬러(Jeju Blue). 600 = 원본 스펙값 #35577A 그대로.
        pace: {
          50: "#F0F5F9",
          100: "#DDE8F3",
          200: "#C0D4E7",
          300: "#9AB8D6",
          400: "#6D96C0",
          500: "#4675A4",
          600: "#35577A",
          700: "#284462",
          800: "#1C314A",
          900: "#132235",
          950: "#0B1622",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 55s linear infinite",
      },
    },
  },
  plugins: [],
};
