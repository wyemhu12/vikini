import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class" as const,
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        body: ["Inter", "sans-serif"],
        headline: ["Inter", "sans-serif"],
        code: ["monospace"],
      },
      colors: {
        background: "var(--surface)",
        foreground: "var(--text-primary)",
        card: {
          DEFAULT: "var(--surface-elevated)",
          foreground: "var(--text-primary)",
        },
        popover: {
          DEFAULT: "var(--surface-elevated)",
          foreground: "var(--text-primary)",
        },
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        secondary: {
          DEFAULT: "var(--control-bg)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--text-secondary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "var(--danger-foreground)",
        },
        border: "var(--border)",
        input: "var(--control-border)",
        ring: "var(--accent)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
