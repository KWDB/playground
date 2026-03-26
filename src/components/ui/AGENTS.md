# UI Component Library

**Generated:** 2026-03-26
**Path:** src/components/ui/

## OVERVIEW

Reusable UI primitives (~300 lines) built on Tailwind CSS with CSS variable theming. Components use `clsx` + `tailwind-merge` for className merging and support controlled/uncontrolled patterns.

## STRUCTURE

```
ui/
├── Button.tsx           # Button + Dialog + AlertDialog + Spinner
├── ConfirmDialog.tsx    # Confirmation modal with portal
├── DropdownMenu.tsx     # Dropdown + Trigger + Content + Item
├── Empty.tsx            # Empty state placeholder
├── ScrollReveal.tsx     # Intersection observer animation
├── StatusIndicator.tsx  # Status badge with animated dot
└── TourTooltip.tsx      # Guided tour tooltip system
```

## CONVENTIONS

- **ClassName merging**: `cn()` helper via `clsx` + `twMerge`
- **Context pattern**: Compound components use React Context (Dialog, Dropdown)
- **Portal rendering**: Modals render via `createPortal` to `document.body`
- **CSS variables**: Theme tokens via `var(--color-*)` pattern
- **Animation**: Tailwind classes + keyframe animations (`animate-fade-in`, `animate-scale-in`)
- **Accessibility**: ARIA attributes, keyboard navigation, reduced motion support

## KEY COMPONENTS

| Component | Type | Purpose |
|----------|------|---------|
| Button | export | Variants: primary/secondary/ghost/danger, sizes: sm/md/lg, loading state |
| Dialog | compound | Context-based modal with Trigger/Content/Title/Description/Close |
| AlertDialog | export | Confirmation dialog wrapping Dialog |
| ConfirmDialog | standalone | Warning/danger/info variants with icon and portal |
| Dropdown | compound | Controlled/uncontrolled with Trigger/Content/Item/Separator/Label |
| StatusIndicator | export | Animated dot + label for running/stopped/paused/error states |
| ScrollReveal | export | IntersectionObserver-based fade-in animation |
| TourTooltip | export | Multi-step guided tour with smart positioning |
| Spinner | export | SVG loading spinner |
| Empty | export | Empty state placeholder |

## ANTI-PATTERNS

- Inconsistent `cn()` import: Some files re-export from `@/lib/utils`, others define locally
- Dialog and Dropdown define local `cn()` instead of importing shared utility
- No index.ts barrel export for the directory
