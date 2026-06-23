# Hammielion Backoffice Design System

## 1. Atmosphere & Identity

Hammielion Backoffice feels like a compact operations console for retail teams: clear, durable, and fast to scan under time pressure. The signature is amber-led action hierarchy on quiet neutral surfaces, where transactional work stays dense but primary actions remain easy to find.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/base | `--background` | `#f9fafb` | `#030712` | Page background |
| Surface/card | `--card` | `#ffffff` | `#111827` | Panels, headers, cards |
| Surface/muted | `--muted` | `#f3f4f6` | `#1f2937` | Secondary fills, hover backgrounds |
| Text/primary | `--foreground` | `#111827` | `#f9fafb` | Main text |
| Text/muted | `--muted-foreground` | `#6b7280` | `#9ca3af` | Captions, metadata, inactive nav |
| Border/default | `--border` | `#e5e7eb` | `#1f2937` | Dividers, outlines |
| Accent/primary | `--primary` | `#d97706` | `#f59e0b` | Primary actions, active navigation, focus |
| Accent/foreground | `--primary-foreground` | `#ffffff` | `#030712` | Text/icons on primary surfaces |
| Status/error | `--destructive` | `#ef4444` | `#7f1d1d` | Destructive actions and warnings |

### Rules

- Use Tailwind theme tokens such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, and `text-primary`.
- Accent amber is reserved for active state, primary commands, and focus treatment.
- Do not add raw colors in component code. Add a semantic token first if a new color role is required.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| H1 | `text-xl` | 700 | tight | 0 | Compact page titles |
| H2 | `text-lg` | 700 | tight | 0 | Section titles |
| Body | `text-base` | 400-700 | normal | 0 | Primary UI text |
| Body/sm | `text-sm` | 400-600 | normal | 0 | Navigation, buttons, metadata |
| Caption | `text-xs` | 500-600 | normal | 0 | Compact labels and badges |

### Font Stack

- Primary: Geist Sans via `--font-geist-sans`, falling back to Arial, Helvetica, sans-serif.
- Mono: Geist Mono via `--font-geist-mono`.

### Rules

- POS surfaces favor `text-sm` and `text-base` for density.
- Use `font-semibold` for active navigation and important operational values.
- Keep letter spacing at `0` unless a true overline pattern is introduced.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base unit.

| Token | Tailwind | Value | Usage |
|-------|----------|-------|-------|
| Space/1 | `1` | 4px | Tight icon-to-text gaps |
| Space/2 | `2` | 8px | Compact inline groups |
| Space/3 | `3` | 12px | Button padding and small panels |
| Space/4 | `4` | 16px | Standard page padding |
| Space/6 | `6` | 24px | Larger panel rhythm |

### Grid

- POS layout uses flex columns with `min-h-0` for scroll-safe work areas.
- Mobile keeps critical actions thumb-accessible and horizontally scroll-safe.
- Desktop may show fuller labels while preserving the same route model.

### Rules

- Avoid fixed viewport math when flex layout can own height.
- Fixed-format controls such as nav items need stable min heights and no layout shift between active/inactive states.

## 5. Components

### POS Navigation

- **Structure**: semantic `nav` containing route links generated from a typed item list.
- **Variants**: visible item set depends on role; `KASIR` does not see Transfer Masuk.
- **Spacing**: mobile links use compact icon + label blocks; desktop links expand into icon + full label rows.
- **States**: active, hover, focus-visible, and pressed states must be visible.
- **Accessibility**: current route uses `aria-current="page"`; nav has `aria-label="Navigasi POS"`.
- **Motion**: only color and transform transitions, 150-200ms.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150ms | ease-out | Hover, active press |
| Standard | 200ms | ease-in-out | Tab color changes |

### Rules

- Every interactive item has hover, active, and focus-visible treatment.
- Animate `transform`, `opacity`, and colors only.
- Respect dense workflow: no decorative motion that slows repeated cashier actions.

## 7. Depth & Surface

### Strategy

Mixed but restrained: borders define operational layout, tonal fills clarify active or hover states.

| Type | Value | Usage |
|------|-------|-------|
| Border/default | `border border-border` | POS headers, nav containers, card outlines |
| Tonal/subtle | `bg-muted` or `bg-muted/50` | Hover and low-emphasis states |
| Tonal/accent | `bg-primary/10` | Active navigation and selected states |

### Rules

- Avoid decorative shadows on dense POS surfaces.
- Use border and tonal shift before elevation.
