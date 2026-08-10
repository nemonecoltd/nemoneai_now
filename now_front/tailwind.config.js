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
        // shadcn/ui(Tailwind v4 기준 CLI)가 생성한 CSS 변수(globals.css :root/.dark)를
        // Tailwind v3 유틸(bg-background, border-border 등)로 쓸 수 있게 매핑 — v4는 이 매핑 없이도
        // 동작하지만 이 프로젝트는 v3.4.1이라 명시적으로 연결해줘야 함(2026-08-10, shadcn init 직후
        // `next build`에서 "The `border-border` class does not exist" 에러로 확인).
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
