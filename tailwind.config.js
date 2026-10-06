import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        /* ─────────────────────────────
           BioBridge Enterprise Palette
        ───────────────────────────── */

        workspace: "#f7f8f5",
        sidebar: "#eef1ec",

        forest: "#315c4b",
        "forest-dark": "#264b3c",

        sage: {
          50: "#f1f5f1",
          100: "#e4ece5",
          200: "#cbdacf",
        },

        ink: {
          text: "#202622",
          secondary: "#4f5a53",
          muted: "#707a73",
          faint: "#9aa29c",
        },

        hairline: "#dce1dc",

        danger: "#a33a32",

        /* ─────────────────────────────
           Legacy compatibility
           Keeps older components stable
        ───────────────────────────── */

        ink: "#101411",
        panel: "#171b18",
        content: "#e9eee9",
        muted: "#9aa39c",
        teal: "#5c9b87",
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],

        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },

      boxShadow: {
        subtle: "0 1px 2px rgba(32, 38, 34, 0.04)",
        card: "0 2px 8px rgba(32, 38, 34, 0.06)",
      },

      borderRadius: {
        enterprise: "8px",
      },
    },
  },

  plugins: [
    typography,
  ],
};