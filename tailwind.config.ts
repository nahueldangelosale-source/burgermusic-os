import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/core/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/agents/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Base Canvas
                canvas: {
                    50: '#F8FAFC', // Slate-50
                    100: '#F1F5F9', // Slate-100
                    200: '#E2E8F0',
                    300: '#CBD5E1',
                    400: '#94A3B8',
                    500: '#64748B',
                    600: '#475569',
                    700: '#334155',
                    800: '#1E293B',
                    900: '#0F172A', // Slate-900
                    950: '#020617',
                },
                // Tinta (Texto)
                ink: {
                    900: '#0F172A', // Slate-900
                    500: '#64748B', // Slate-500
                },
                // Semántica de Negocio
                profit: '#10B981', // Emerald-500
                critical: '#E11D48', // Rose-600
                warning: '#F59E0B', // Amber-500
                brand: {
                    DEFAULT: '#2563EB', // Blue-600
                    glow: '#3B82F6', // Blue-500
                },
                // Legacy compat (if needed, map to new)
                coral: {
                    500: '#F43F5E',
                    600: '#E11D48',
                }
            },
            boxShadow: {
                'glass': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                'float': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
                'kitchen': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                // Legacy
                'levitate': '0 5px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
            backdropBlur: {
                xs: '2px',
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
        },
    },
    plugins: [],
};
export default config;
