/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "rgb(var(--color-primary) / <alpha-value>)",
                background: "rgb(var(--color-background) / <alpha-value>)",
                surface: "rgb(var(--color-surface) / <alpha-value>)",
                "surface-hover": "rgb(var(--color-surface-hover) / <alpha-value>)",
                border: "rgb(var(--color-border) / <alpha-value>)",
                foreground: "rgb(var(--color-foreground) / <alpha-value>)",
            },
        },
    },
    plugins: [],
}
