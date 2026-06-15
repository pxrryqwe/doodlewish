import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dw: {
          bg: "#faf8f6",
          fg: "#232220",
          card: "#f3efeb",
          tray: "#e9e1da",
          gray: "#6e6b66",
        },
      },
      fontFamily: {
        figtree: ["var(--font-figtree)", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        pill: "1000px",
      },
    },
  },
  plugins: [],
};

export default config;
