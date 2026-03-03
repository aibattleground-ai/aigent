/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'ai-cyan': '#00f0ff',
                'ai-purple': '#a855f7',
                'ai-pink': '#f059da',
                'ai-bg': '#04040a',
                'ai-card': '#0b0b14',
                'ai-border': 'rgba(255,255,255,0.07)',
            },
            fontFamily: {
                sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
                display: ['Syne', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'float': 'float 8s ease-in-out infinite',
                'spin-slow': 'spin-slow 20s linear infinite',
                'spin-slower': 'spin-slow 30s linear infinite reverse',
                'pulse-ring': 'pulse-ring 2s ease-out infinite',
                'shimmer': 'shimmer 3s linear infinite',
                'slide-up': 'slide-up 0.6s ease-out forwards',
                'orb-pulse': 'orb-pulse 4s ease-in-out infinite',
                'grid-move': 'grid-move 8s linear infinite',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
            },
        },
    },
    plugins: [],
};
