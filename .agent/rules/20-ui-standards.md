---
trigger: always_on
---

# UI & UX Standards (Vikini)

## Design Philosophy

- **Modern & Premium**: clean typography, strong whitespace discipline, subtle depth (no heavy skeuomorphism).
- **Interactive by default**: clear hover/active/focus states and micro-interactions where they improve comprehension.
- **Responsive**: mobile-first; handle narrow widths without layout breakage.
- **Accessibility**: target **WCAG 2.2 AA** baseline; AAA only when explicitly requested.

## Component Rules

1. **Shadcn/UI (Primary)**
   - Use shadcn/ui components when available.
   - Follow `components.json` for configuration (paths, style, tailwind config assumptions).
   - Do not re-implement primitives (Button, Dialog, Dropdown, Tabs, Toast, etc.) if shadcn provides them.

2. **Radix UI (Underlying Base)**
   - If shadcn doesn’t cover a needed primitive, use Radix UI primitives rather than building from scratch.

3. **Tailwind First**
   - Prefer utility classes.
   - Avoid custom CSS unless required for complex animation/visual effects that Tailwind cannot express cleanly.

4. **Icons**
   - Use `lucide-react` consistently for iconography.

## Visual/Interaction Standards

- **Spacing**: consistent vertical rhythm; avoid cramped clusters.
- **Typography**: clear hierarchy (title → section → body → muted meta).
- **Motion**: Framer Motion only where it clarifies state transitions; keep durations subtle.
- **States**: loading, empty, error states must be present for user-facing flows (chat, attachments, gem selection).

## File Structure (Conventions)

- `app/features/<feature>/components/`: feature-specific UI components (if you use this convention in the repo).
- `components/ui/`: shared/common UI components (shadcn atoms/molecules).
- Prefer colocating feature UI with its route when it reduces coupling.

## Theme File Structure

Themes are organized in `app/styles/themes/`:

app/styles/themes/ ├── \_shared/ │ ├── base.css # Root, html, body, scrollbar │ └── utilities.css # Markdown, chat styling, animations ├── focus/ │ ├── blueprint.css # Xanh dịu │ ├── amber.css # Cam-nâu │ ├── indigo.css # Tím-xanh │ ├── charcoal.css # Xám-đen │ ├── gold.css # Vàng ánh kim │ ├── red.css # Đỏ │ └── rose.css # Hồng nhạt ├── glassmorphism/ │ ├── nebula.css # Dark glass + cyan │ ├── aqua.css # Dark teal glass │ ├── holo.css # Rainbow corners │ ├── orchid.css # Light pastel glass (WCAG AA) │ └── sunset.css # Clay-neumo + glass-lite └── ra2/ ├── yuri.css # Purple (Red Alert 2) ├── allied.css # Blue (Red Alert 2) └── soviet.css # Red (Red Alert 2)

**Each theme file is self-contained** with its own:

- CSS variables
- Component rules
- Background
- Scrollbars

## “Do Not”

- No template-y layouts; avoid generic dashboard boilerplate unless requested.
- No redundant CSS that duplicates shadcn/tailwind patterns.
