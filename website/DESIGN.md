# Mirrly — Landing Page Design System

The site follows the "dot." template structure: fixed pill navbar, full-screen video
hero with serif display type, Nokia-screen typing messages, and Apple-style liquid
glass for every card and pill. Restrained, hand-crafted, no generic AI-generated
layout patterns (no emoji grids, no gradient text, no three-column icon spam).

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4 (CSS-first config via `@theme` in `src/index.css`)
- `motion/react` for all animation

## Typography

| Role | Font | Usage |
|---|---|---|
| Display | **Instrument Serif** (400, italic 400) | headlines, logo wordmark, card titles |
| Body / UI | **Inter** (100–900) | everything else, root default |
| Phone screen | **Nokia Cellphone FC Small** | typing messages over the video's phone |

Scale: hero `text-[38px] md:text-[56px] lg:text-[72px]`, `leading-[0.85]`,
`tracking-tight`. Section titles `34/48px`. Body `16–18px`, `text-[#1a1a1a]/70`.

## Color

| Token | Value | Usage |
|---|---|---|
| Page | `#F3F4ED` | hero + section background (template's warm off-white) |
| Ink | `#1a1a1a` | all text (opacity variants for hierarchy) |
| CTA blue | `#0871E7` | primary buttons |
| CTA glint | `#DEF0FC` | top-edge glint gradient inside buttons |
| Nokia ink | `#2A3616` | typing text on the phone LCD |
| Brand gradient | `#8B5CF6 → #3C83F5 → #22D3EE` | logo tile only |

## Liquid glass recipe

`.liquid-glass` (cards) and `.liquid-glass-strong` (download pills), defined in
`src/index.css`:

- White-gradient fill: `rgba(255,255,255,0.72) → 0.48` (strong: `0.85 → 0.6`)
- `backdrop-filter: blur(24px) saturate(1.6)`
- 1px near-white border (`rgba(255,255,255,0.85)`)
- Specular top edge: `inset 0 1px 0 rgba(255,255,255,0.95)`
- Grounding: `0 12px 32px rgba(26,26,26,0.08)`
- **Subtle corner glow:** `0 0 28px rgba(96,140,255,0.10)` — barely-there cool halo

## Motion

Single easing everywhere: `cubic-bezier(0.16, 1, 0.3, 1)`.

- Headline: `opacity 0 → 1`, `scale 0.95 → 1`, 1.5s
- Sub-headline: `opacity 0 → 1`, `y 20 → 0`, 1.2s, delay 0.3
- Download pills: same as sub, delay 0.55
- Scroll sections: `whileInView`, `y 24–28 → 0`, once, staggered 0.12s
- Typing cursor: opacity `0 → 1 → 0`, 0.8s, linear, infinite
- Typing cadence: 100ms type, 50ms delete, 2000ms hold

## Components (src/App.tsx)

- **Navbar** — fixed `top-6`, centered, `w-[95%] max-w-5xl`, blur pill,
  `border-black/10`. Logo mark + Instrument Serif wordmark. Links: Features,
  Privacy, Download, About. CTA "Get Mirrly" with inset shadow + glint bar that
  widens on hover (`group-hover:scale-x-105`).
- **Hero** — full-screen video (template CloudFront URL), `bg-white/5` tint,
  headline "Stays with you. / Gets your world.", sub-copy, two glass download
  pills (macOS / Windows glyphs).
- **TypingMessages** — absolutely positioned on the phone LCD
  (`left-[48.5%] bottom-[32%]`), cycles "Stuck on this?" / "I got you." / "On it."
- **WhatIsMirrly** — three glass cards (sees / hears / remembers) + a wide
  "Yours, locally" privacy card with a second CTA.
- **Footer** — logo, one-line license/platform note.

## Logo

Rounded-square glass tile (`rx=13/48`), iridescent violet→blue→cyan diagonal
gradient, top specular stroke, white "M" ribbon with a faint reflection arc
beneath it (M + mirror → Mirrly). Same SVG used in the desktop app
(`renderer/icons.js`), the installer icon (`build/icon.png`), `public/mirrly.svg`,
and the inline `<Logo />` component.
