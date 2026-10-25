import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6d28d9", fg: "#ffffff", soft: "#ede9fe" },
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.6)", opacity: "0" }, "60%": { transform: "scale(1.05)", opacity: "1" }, "100%": { transform: "scale(1)" } },
      },
      animation: { pop: "pop .5s ease-out" },
    },
  },
  plugins: [],
} satisfies Config;
