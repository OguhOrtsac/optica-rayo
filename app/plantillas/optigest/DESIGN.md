---
name: OptiGest
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#434653'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#737784'
  outline-variant: '#c3c6d5'
  surface-tint: '#215abd'
  primary: '#00357f'
  on-primary: '#ffffff'
  primary-container: '#004aad'
  on-primary-container: '#a9c1ff'
  inverse-primary: '#b0c6ff'
  secondary: '#00668a'
  on-secondary: '#ffffff'
  secondary-container: '#40c2fd'
  on-secondary-container: '#004d6a'
  tertiary: '#00422b'
  on-tertiary: '#ffffff'
  tertiary-container: '#005c3e'
  on-tertiary-container: '#49da9f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00429b'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style
The design system is engineered for the clinical and administrative precision required in optical management. It balances a professional medical ethos with the efficiency of a modern SaaS platform. 

The aesthetic is rooted in **Modern Minimalism** with a focus on high-utility interfaces. It utilizes generous white space, a controlled color palette, and subtle depth to reduce cognitive load during repetitive administrative tasks. The emotional response is one of reliability, clarity, and sterile organization, ensuring that practitioners can focus on patient care without visual distraction.

## Colors
The palette is designed to instill trust and ensure legibility. 
- **Primary (Deep Blue):** Used for core branding, primary actions, and active navigation states. 
- **Secondary (Sky Blue):** Utilized for information highlights, badges, and secondary interactive elements to provide a softer visual alternative to the primary blue.
- **Success (Mint Green):** Reserved for health-related confirmations, positive patient outcomes, and successful system operations.
- **Surface & Background:** A clear distinction is made between the "Medical White" surface (used for cards and inputs) and the "Soft Gray" background to create a structured layered effect.
- **Text:** Headers use "Dark Slate" (#1E293B) for maximum contrast, while body text uses a muted slate variant to soften the reading experience.

## Typography
This design system utilizes **Inter** for its systematic, utilitarian nature. The typeface is chosen for its exceptional legibility in data-heavy environments. 

- **Weight Strategy:** Use Bold/Semi-Bold (600/700) exclusively for headers and primary navigation. Regular (400) is used for all patient records and administrative body text to maintain a clean, airy feel.
- **Scale:** A tight typographic scale ensures that complex forms and tables remain compact yet readable.
- **Labels:** Small caps or medium-weight labels are used for form field headers and metadata to differentiate from user-inputted data.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a maximum container width for desktop viewing to prevent line lengths from becoming unreadable.

- **Grid System:** A 12-column grid is used for desktop, 8-column for tablet, and 4-column for mobile.
- **Rhythm:** An 8px linear scale governs all spacing (margins, padding, gutters). 
- **Application:** Use 24px (lg) for major component separation and 16px (md) for internal card padding. This generous spacing helps organize dense information like lens prescriptions or inventory lists.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Ambient Shadows**. The interface relies on a "Card-on-Canvas" metaphor.

- **Elevation 0 (Background):** #F8FAFC. Used for the main application canvas.
- **Elevation 1 (Surface):** White cards with a subtle 1px border (#E2E8F0) and a soft, highly diffused shadow (Offset: 0, 4px; Blur: 12px; Opacity: 4% Black).
- **Elevation 2 (Active/Hover):** Increased shadow depth (Offset: 0, 8px; Blur: 24px; Opacity: 8% Black) to indicate interactivity or modal overlays.
- **Dividers:** Use hairline 1px strokes in #F1F5F9 to separate list items without adding visual bulk.

## Shapes
The shape language is approachable yet structured. A standard **12px (rounded-lg)** corner radius is the default for primary containers and cards, providing a soft, modern medical feel.

- **Small Components:** Checkboxes and small tags use a 4px radius.
- **Standard Components:** Buttons and Input fields use an 8px radius.
- **Large Components:** Main content cards and modals use the 12px to 16px (rounded-xl) radius.
- **Patient Avatars:** Use full circles (pill-shaped) to distinguish human elements from data containers.

## Components
- **Buttons:** Primary buttons are solid Deep Blue with white text. Secondary buttons use a Sky Blue ghost style (outline) or a subtle gray background. 
- **Input Fields:** White backgrounds with a 1px border. On focus, the border transitions to Deep Blue with a 2px soft outer glow.
- **Data Tables:** High-density rows with 12px vertical padding. Use alternating row stripes (Zebra striping) using #F8FAFC for better scanability of patient records.
- **Status Chips:** Use Success (Mint Green) for "Paid" or "Completed" statuses, and Secondary (Sky Blue) for "In Progress" or "Scheduled."
- **Cards:** The primary container for all data. Cards should always have a 1px #E2E8F0 border to ensure they don't wash out against the medical white background.
- **Prescription Widget:** A specialized component with high-contrast numerical inputs specifically for Diopter, Cylinder, and Axis values, utilizing the monospaced stylistic sets of Inter for alignment.