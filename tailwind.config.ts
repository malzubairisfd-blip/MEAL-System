import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./src/components/**/*.{ts,tsx,js,jsx}",
    "./src/**/*.{ts,tsx,js,jsx,html}",
  ],
  darkMode: ["class", '[data-theme="dark"]'], // prefer toggling class or data-theme attr
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-600": "var(--primary-600)",
        surface: "var(--surface)",
        muted: "var(--muted)",
        text: "var(--text)",
        background: "var(--bg)",
      },
      borderRadius: {
        lg: "var(--card-radius)",
      },
      boxShadow: {
        card: "var(--card-shadow)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo"],
      },
      maxWidth: {
        layout: "var(--layout-max)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
  ],
};
export default config;
