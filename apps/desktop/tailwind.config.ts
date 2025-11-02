import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "ff-sky": {
          50: "#f5f9ff",
          100: "#dce9ff",
          200: "#b9d4ff",
          300: "#90baff",
          400: "#6b9cff",
          500: "#4c7dff",
          600: "#355ee6",
          700: "#2646b4",
          800: "#1f3a8a",
          900: "#1d3270"
        }
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 30px 60px -40px rgba(46,85,165,0.6)",
        glow: "0 0 60px rgba(76,125,255,0.4)"
      },
      blur: {
        xs: "2px"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
