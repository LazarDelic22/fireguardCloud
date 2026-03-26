import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fireguard: {
          50: "#f4f7f7",
          100: "#d9e7e5",
          500: "#2f7d78",
          700: "#185350",
          900: "#0b2f2d",
        },
      },
    },
  },
  plugins: [],
};

export default config;

