import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6d28d9", fg: "#ffffff", soft: "#ede9fe" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0) rotate(var(--r,0deg))" }, "50%": { transform: "translateY(-10px) rotate(var(--r,0deg))" } },
        wiggle: { "0%,100%": { transform: "rotate(-6deg)" }, "50%": { transform: "rotate(6deg)" } },
        rise: { from: { transform: "translateY(16px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".25" } },
        pop: { "0%": { transform: "scale(.6)", opacity: "0" }, "60%": { transform: "scale(1.05)", opacity: "1" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        pop: "pop .5s ease-out",
        marquee: "marquee 28s linear infinite",
        float: "float 6s ease-in-out infinite",
        wiggle: "wiggle 1.2s ease-in-out infinite",
        rise: "rise .6s cubic-bezier(.2,.8,.2,1) both",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
