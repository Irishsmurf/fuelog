# Brand Identity Audit & Evolution Plan

## Current Brand State (Audit)
Fuelog currently utilizes a functional but generic "utility-first" aesthetic, heavily reliant on default Tailwind CSS v4 scales.

### 1. Colors
- **Primary:** `indigo-600` (#4f46e5) - Used for primary buttons, links, and accents.
- **Surface (Light):** `gray-50` (background), `white` (cards/header).
- **Surface (Dark):** `gray-900` (background), `gray-800` (cards/header).
- **Accents:** `amber-600` (warnings), `red-600` (errors), `green-600` (success).
- **Assessment:** Consistent but lacks a unique "ownable" color. Indigo is the default Vite/Tailwind primary.

### 2. Typography
- **Font Face:** Default Sans Serif stack (Inter/System Sans).
- **Styling:** Bold headers, regular body text.
- **Assessment:** Highly readable but lacks personality. It feels like a "dashboard template".

### 3. Iconography
- **Set:** Mix of `lucide-react` and manual SVGs.
- **Style:** Thin-stroke (2px), modern outline icons.
- **Assessment:** Generally good, but some inconsistency between the Google SVG logo and Lucide icons.

### 4. Layout & Shape
- **Corner Radius:** `rounded-xl` (12px) and `rounded-2xl` (16px).
- **Shadows:** `shadow-md` and `shadow-lg`.
- **Assessment:** Modern and "soft," fitting the mobile-first goal.

---

## Proposed Brand Evolution

### 1. Color Palette: "Fuelog Electric"
Move away from generic Indigo toward a more "Electric/Fuel" inspired palette.
- **Brand Primary:** `Electric Violet` (#6366f1) - Slightly more vibrant than default indigo.
- **Secondary Accent:** `Cyber Green` (#10b981) - Represents efficiency and "go".
- **Dark Mode Deep:** `Slate-950` (#020617) - Moving from generic gray to a deeper, more premium slate blue-black.

### 2. Typography: "The Precision Pair"
- **Headings:** **Inter Tight** or **Geist Sans**. High-precision, modern look that suggests "data and accuracy".
- **Data/Metrics:** **Geist Mono** or **JetBrains Mono**. Use monospaced fonts for MPG, cost, and distance values to emphasize the "logger/spreadsheet replacement" nature.

### 3. Iconography: "Rounded Precision"
- Standardize all icons to `lucide-react` with a consistent `strokeWidth={1.75}`.
- Use "Duotone" effects for active states in the bottom navigation (e.g., solid fill with 20% opacity background).

### 4. Layout: "Layered Glass"
- **Glassmorphism:** Use more `backdrop-blur` effects on the `BottomNav` and `Header` to give a native iOS/Android feel.
- **Micro-interactions:** Add "Squish" effects on buttons (scale-down on click) to make the app feel "alive".

---

## Visual Identity Roadmap

### Short Term (Low Effort)
- [ ] Update `tailwind.config.js` with a custom `brand` color scale.
- [ ] Implement monospaced fonts for numeric data in `LogCard` and `HistoryPage`.
- [ ] Standardize corner radius to a consistent `1rem` across all cards.

### Medium Term (Design Change)
- [ ] Redesign the `Login` page with a unique "Fuelog" logotype instead of plain text.
- [ ] Implement `backdrop-blur` on fixed navigation elements.
- [ ] Add a unique "empty state" illustration for new users.

### Long Term (Brand Maturity)
- [ ] Create a custom "Fuelog" icon/logo (e.g., a fuel pump nozzle merging with a chart line).
- [ ] Design custom "Achievement" badges for fuel efficiency milestones.
