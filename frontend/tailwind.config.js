/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark fintech palette
        dark: {
          950: "#0f0f0f",
          900: "#1a1a1a",
          800: "#2a2a2a",
          700: "#3a3a3a",
        },
        // Neon accents
        neon: {
          cyan: "#00d9ff",
          green: "#00ff88",
          purple: "#b026ff",
          pink: "#ff006e",
        },
        // Chart colors
        chart: {
          bull: "#26a69a",
          bear: "#ef5350",
          neutral: "#666666",
        },
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "42px" }],
        "5xl": ["48px", { lineHeight: "54px" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Glassmorphism effect
        glass: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
      },
      backdropFilter: {
        glass: "blur(10px)",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        neon: "0 0 20px rgba(0, 217, 255, 0.3)",
        "neon-pink": "0 0 20px rgba(255, 0, 110, 0.3)",
      },
      animation: {
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        fadeIn: "fadeIn 0.5s ease-in",
        slideUp: "slideUp 0.5s ease-out",
        slideDown: "slideDown 0.5s ease-out",
        bounce: "bounce 1s infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".5" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        bounce: {
          "0%, 100%": {
            transform: "translateY(-25%)",
            animationTimingFunction: "cubic-bezier(0.8,0,1,1)",
          },
          "50%": {
            transform: "none",
            animationTimingFunction: "cubic-bezier(0,0,0.2,1)",
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss/plugin")],
};
