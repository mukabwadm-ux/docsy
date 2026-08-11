import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // src/lib holds class-name lookup tables (status colours, badge tints).
    // Leaving it out silently drops those classes from the build — the styles
    // never render, with no error anywhere.
    './src/lib/**/*.{js,ts}',
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /**
         * The Docsy palette, straight from the conversion reference.
         * Exposed as literal hexes (not HSL vars) so the values in the build
         * spec and the values in the markup are the same string — one place to
         * check when a colour looks off.
         */
        brand: {
          cta: '#EB2437',
          accent: '#E4340C',
          tan: '#F6E3BB',
          cream: '#FFF6DB',
          heading: '#151515',
          body: '#373737',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: ['var(--font-oswald)', 'Arial Narrow', 'sans-serif'],
        body: ['var(--font-lora)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(21 21 21 / 0.04), 0 1px 3px 0 rgb(21 21 21 / 0.06)',
        'card-hover': '0 12px 28px -8px rgb(21 21 21 / 0.16), 0 4px 8px -4px rgb(21 21 21 / 0.08)',
        cta: '0 8px 20px -6px rgb(235 36 55 / 0.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out both',
        marquee: 'marquee 22s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
