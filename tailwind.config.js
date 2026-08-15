// web-ui/tailwind.config.js
// Tailwind CSS v3 configuration for V2 Hexapod Web UI.
// Activated by: npm run tailwind:build (generates src/tailwind-output.css)
// Theme extends the existing CSS-var palette for consistency.
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
    theme: {
        extend: {
            colors: {
                "c0-dark-grey": "#222222",
                "c1-green": "#00ff41",
                "c2-pink": "#ff41b3",
                "c3-yellow": "#ffd700",
                "c4-blue": "#41b3ff",
                "c5-purple": "#b341ff",
                "c6-red": "#ff4133",
            },
        },
    },
    // Preflight off: don't let Tailwind's base reset disturb the existing
    // mithi pages (FK/IK/gaits are tested working — they stay untouched).
    corePlugins: {
        preflight: false,
    },
    plugins: [],
}