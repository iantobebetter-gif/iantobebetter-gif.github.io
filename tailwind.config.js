module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#9f1239", // 玫瑰红/枣红
          600: "#881337",
          700: "#4c0519",
        },
        accent: {
          DEFAULT: "#f59e0b",
          500: "#d97706",
          600: "#b45309",
        },
        gold: {
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
      },
      backgroundImage: {
        "pattern-clouds":
          'url(\'data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23f59e0b" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\')',
      },
    },
  },
};
