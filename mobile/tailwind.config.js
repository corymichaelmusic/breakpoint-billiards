/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "#D4AF37",
                background: "#050505",
                surface: "#121212",
                "surface-hover": "#1e1e1e",
                border: "#333333",
                foreground: "#ffffff",
            },
        },
    },
    plugins: [],
}
