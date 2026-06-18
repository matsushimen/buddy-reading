import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#fbfaf7",
        line: "#e4e0d8",
        accent: "#2563eb"
      },
      boxShadow: {
        panel: "0 16px 40px rgb(23 32 51 / 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
