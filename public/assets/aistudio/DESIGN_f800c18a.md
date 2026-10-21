---
name: Frosty Bite
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#564145'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#8a7175'
  outline-variant: '#ddbfc3'
  surface-tint: '#a83255'
  primary: '#a83255'
  on-primary: '#ffffff'
  primary-container: '#ff7597'
  on-primary-container: '#740430'
  inverse-primary: '#ffb1c0'
  secondary: '#795745'
  on-secondary: '#ffffff'
  secondary-container: '#fed1b9'
  on-secondary-container: '#795845'
  tertiary: '#904d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ef8820'
  on-tertiary-container: '#592d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9df'
  primary-fixed-dim: '#ffb1c0'
  on-primary-fixed: '#3f0016'
  on-primary-fixed-variant: '#88183e'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#e9bda7'
  on-secondary-fixed: '#2d1608'
  on-secondary-fixed-variant: '#5e402f'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  display:
    fontFamily: Epilogue
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Epilogue
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Epilogue
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Epilogue
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

The design system embodies an artisan luxury patisserie experience adapted for mobile-first commerce. The brand personality blends refined French confectionery elegance with warm, playful, and approachable charm—termed "cute-professional." 

Targeted toward discerning dessert enthusiasts, celebration planners, and gift buyers, the interface avoids sterile e-commerce conventions. Instead, it evokes tactile warmth, culinary indulgence, and sensory delight. The visual direction unifies modern minimalism with soft tactile styling: airy whipped cream canvases, glossy strawberry glaze highlights, rich ganache-toned text hierarchies, and subtle bakery-warm ambient glows.

## Colors

The palette is rooted in confectionery aesthetics, pairing high-contrast accessibility with warm, edible nuances:

- **Primary (`#FF7597`) — Strawberry Glaze:** Applied to primary calls-to-action, cart counts, active selection states, and brand signatures. Supported by tints `#FFD2DC` (strawberry milk) for container fills and `#FFF0F3` (rose water) for low-contrast backgrounds.
- **Secondary (`#3D2314`) — Roasted Cacao:** Serves as the primary anchor for headlines, key interactive states, and structural clarity. Supported by `#5C3826` for secondary typography and `#8C583E` for subtle iconography and borders.
- **Tertiary (`#D97706` / `#F59E0B`) — Golden Crust:** Accents bakery awards, star ratings, chef's specials, freshly baked notifications, and loyalty milestones.
- **Neutral (`#FDFBF7`) — Sweet Cream:** The canvas base, preventing cold clinical whites while enhancing food photography. Container card backgrounds shift to pure `#FFFFFF` for crisp elevation.

## Typography

The typographic pairing balances character and utility. **Epilogue** provides sculptural, contemporary display headers with balanced geometric curves that convey modern artisan confidence. **Plus Jakarta Sans** delivers humanist, readable letterforms that maintain high legibility across mobile displays, ingredient lists, and checkout flows. 

Numbers and currency symbols inherit `Epilogue` within pricing badges to reinforce premium bakery aesthetics, while product metadata remains set in `Plus Jakarta Sans` for quick scanning.

## Layout & Spacing

The layout utilizes a flexible 4-column system on mobile viewports (< 600px), transitioning to 8 columns on tablets (600px–1024px) and 12 columns on desktop web presentations. 

Grid alignment prioritizes generous breathing room around visual menu showcases. The spatial rhythm relies on an 8pt base grid (`0.5rem` increments) to maintain structural cadence across dense commerce cards, ingredient accordions, and sticky delivery drawers. Tap targets strictly adhere to a minimum size of 44x44px.

## Elevation & Depth

Visual depth is achieved through ambient confectionery lighting rather than stark dropshadows:

- **Level 1 (Cards, Menus):** `0px 4px 20px rgba(61, 35, 20, 0.04), 0px 1px 3px rgba(61, 35, 20, 0.02)`. Tinted with roasted cacao to prevent murky grays on cream backgrounds.
- **Level 2 (Floating Cart Bar, Sticky Navs):** `0px 8px 30px rgba(61, 35, 20, 0.08), 0px 2px 6px rgba(61, 35, 20, 0.04)`.
- **Level 3 (Modal Sheets, Pastry Customizer Drawer):** `0px 16px 40px rgba(61, 35, 20, 0.12), 0px 4px 12px rgba(61, 35, 20, 0.06)`.
- **Backdrop Frosting:** Sheet overlays utilize `backdrop-filter: blur(12px)` over a warm tint (`rgba(253, 251, 247, 0.85)`).
- **Outlines:** Low-contrast borders (`1px solid rgba(92, 56, 38, 0.08)`) frame white surface cards on sweet-cream surfaces.

## Shapes

The shape system employs generous, soft-radii geometry to evoke smooth frostings, proofed doughs, and organic baker’s tools. Base cards, dialogue boxes, and image thumbnails utilize `1rem` (16px) corners. Elevated sheets, hero showcases, and primary interactive buttons adopt `1.5rem` (24px). Fully pill-shaped geometry (`9999px`) is reserved exclusively for micro-tags, filter chips, item counter steppers, and notification badges.

## Components

### Buttons
- **Primary:** Filled with `#FF7597` (Strawberry Glaze), text in `#FFFFFF`, with `1.5rem` corner radius and `0.75rem 1.5rem` padding. Active state scales slightly to `0.98` with a deepened `#E05A7E` surface.
- **Secondary:** Surface of `#FFF0F3`, text in `#3D2314`, with a `1px solid rgba(255, 117, 151, 0.25)` border.
- **Luxury / Reserve:** Deep `#3D2314` fill with `#FDFBF7` text and `#D97706` amber micro-accents for celebratory cakes and bespoke bookings.

### Chips & Tags
- **Filter Chips:** Pill-shaped (`rounded-full`), `#FFFFFF` surface with `#5C3826` text and subtle `1px solid rgba(92, 56, 38, 0.1)`. Selected state transitions to `#FF7597` background with white text and no border.
- **Dietary Badges:** Eggless, Gluten-Free, and Vegan chips use a `#FFF9F5` base, `#8C583E` border, and an icon paired with 11px uppercase bold labels.

### Item Quantity Stepper
- Compact pill-shaped module (`#FFF0F3`) featuring `#FF7597` circular plus/minus icon buttons and an centered bold tabular numeral set in `#3D2314`.

### Cards
- **Product Card:** Pure `#FFFFFF` background, `1rem` border radius, soft Level 1 cacao shadow. Includes a high-aspect ratio top photo, floating heart wish-list action in the upper-right, price in `Epilogue 18px #3D2314`, and a quick "+ Add" pill button in `#FFF0F3` tint.
- **Bespoke Review Card:** Tinted `#FFF9F5` background, golden star rating (`#F59E0B`), and brief testimonial typography.

### Input Fields & Controls
- **Text Inputs:** Soft `#FFFFFF` container with `0.75rem` radius, `1px solid rgba(92, 56, 38, 0.15)`, and placeholder text in `#8C583E` at 50% opacity. Focused states shift border to `#FF7597` with a soft 3px `#FFD2DC` outer aura.
- **Checkboxes & Radios:** Circular or rounded squares in `#FF7597` when active, with smooth stroke animation. Inactive states feature `#3D2314` borders at 20% opacity.

### Bottom Sheet Drawer
- Rounded top corners at `1.75rem`, anchored by a soft cacao drag-handle (`#3D2314` at 15% opacity, 36px wide). Designed for customization options (e.g., eggless substitutions, custom cake messages, candle counts).