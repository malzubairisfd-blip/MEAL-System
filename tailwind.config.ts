import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        bg: 'hsl(var(--background))',
        text: 'hsl(var(--foreground))',
        surface: 'hsl(var(--card))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        muted: 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        destructive: 'hsl(var(--destructive))',
      },
    },
  },
  plugins: [],
};
export default config;
