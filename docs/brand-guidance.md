# Hammielion Design & Brand Guidance

This document outlines the visual identity and design system for the Hammielion project, ensuring consistency across all modules (Dashboard, POS, and future applications).

## 1. Visual Aesthetic
The Hammielion interface uses a **Modern Premium Dark** aesthetic. It focuses on high contrast, depth through subtle transparency, and a "built-for-speed" industrial feel optimized for professional environments.

- **Background Strategy**: Layered depths of charcoal and deep black.
- **Surface Depth**: Use of glassmorphism (transparency + background blurring) rather than heavy borders or drop shadows.
- **Corner Radii**: Consistent use of rounded corners to soften the dark theme.
  - `rounded-xl` (12px) for general buttons and inputs.
  - `rounded-2xl` (16px) for cards and prominent panels.
  - `rounded-3xl` (24px) for major hero actions and large UI containers.

## 2. Global Color Palette
These colors are defined in the `tailwind.config.js` and should be used consistently.

### Primary Branding
- **Brand (Amber/Gold)**: `brand-500` (#f59e0b)
  - Primary CTA buttons.
  - Active navigation states.
  - Highlights and hero text.

### Semantic Status Colors
- **Success**: `emerald-500` (Online status, valid inputs, successful actions).
- **Error/Danger**: `red-500` (Damaged goods, destructive actions, offline states).
- **Secondary**: `amber-500` (PO Requests, warnings).

### Neutral Palette
- **Base BG**: `#0a0a0a`
- **Surface BG**: `#0d0d0d`
- **Component BG**: `#111` or `#161616`
- **Borders**: `white/5` (subtle) or `white/10` (active).

## 3. Typography
The system uses modular typography with distinct weights for hierarchy.

- **Headlines**: Use **900 (Black)** weight for maximum impact (`font-black`).
- **Body & Subtitles**: Use **700 (Bold)** or **500 (Medium)** weights.
- **Numeric Data**: Always use **Monospaced** fonts (`font-mono`) for currency, quantities, and clock displays to ensure tabular alignment.
- **Labeling**: Meta-data and system labels should use **UPPERCASE** with **wide tracking** (`tracking-widest`).

## 4. Interaction Patterns
- **Hover Transitions**: Interactive elements (cards, buttons) should have a subtle scale-up effect (`hover:scale-[1.02]`) and transition duration (e.g., `transition-all duration-300`).
- **Active State**: Use `active:scale-[0.98]` for tactile feedback on click.
- **Visual Feedback**: Use background glow effects (`blur-[80px]`) for featured items or active focus areas.

## 5. Module Layout Standards

### Launchpad / Dashboard
- **Grid**: Responsive card grid (1 column mobile, 2 columns tablet, 3 columns desktop).
- **Hero**: Clear personalization and immediate status visibility (Shift info, branch ID).

### Task-Oriented (POS / Inventory)
- **Split View**: Fixed sidebars (typically 420px for POS cart) combined with flexible main content areas.
- **Modals**: Consistent use of overlays (`bg-black/80`) and centered dialogs for critical inputs like PIN challenges or price overrides.

---

*Last Updated: 2026-04-21*
