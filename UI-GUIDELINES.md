# UI Guidelines

> **Document purpose:** Define the UI technology choices, design-system conventions, component architecture, implementation rules, and non-negotiable constraints for this project.
>
> **Applies to:** Every UI implementation, refactor, bug fix, and visual change in this repository.
>
> **Precedence:** Follow this document together with the project `AGENTS.md`. If a rule appears to conflict with the existing codebase, inspect the implementation and configuration first, preserve established project conventions where intentional, and report the conflict instead of silently introducing a second pattern.

---

# 1. UI Technology Stack

The project UI stack is based on the following technologies:

| Area | Standard |
|---|---|
| Application framework | Next.js 16 App Router |
| UI library | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component foundation | shadcn/ui |
| Icons | Use the icon library already adopted by the project; prefer its existing conventions |
| Package manager | pnpm |

## 1.1 Verify before using

Before implementing or changing UI:

- Inspect `package.json`, lockfile, Tailwind configuration, global styles, component configuration, and existing components.
- Confirm the installed versions and actual project setup. Do not assume a package, API, or configuration exists solely because it is listed in this document.
- Reuse the project's installed libraries and existing utilities.
- Do not add another UI framework, component library, styling system, or icon library without a clear requirement and explicit justification.
- Do not upgrade dependencies as part of an unrelated UI task.

This document defines project conventions, not permission to ignore the actual repository configuration.

# 2. Design System

## 2.1 Single source of truth

The project must have a consistent design system.

- Reuse existing design tokens, CSS variables, theme configuration, and shared styles.
- Prefer semantic tokens such as background, foreground, primary, secondary, muted, accent, destructive, border, input, and ring where supported by the current setup.
- Use the existing light/dark theme strategy. Do not introduce a separate theme mechanism inside an individual feature.
- Define or update shared tokens centrally instead of scattering repeated raw values across components.
- Keep colors, typography, spacing, borders, radii, shadows, and interaction states visually consistent.
- If a required token does not exist, add it at the appropriate shared design-system layer rather than hardcoding it in multiple places.

## 2.2 Color

- Use the project's semantic color tokens for UI surfaces, text, borders, focus rings, and status states.
- Do not invent arbitrary colors for individual components when an existing token is appropriate.
- Do not use color as the only way to communicate status; pair it with text, an icon, or another meaningful cue.
- Maintain sufficient contrast for text, controls, focus indicators, and interactive states.
- Avoid unnecessary gradients, intense shadows, decorative borders, and excessive accent colors.
- Do not hardcode colors in feature components when the same intent can be expressed through a semantic token.

## 2.3 Typography

- Use the project's configured font family and typography scale.
- Establish hierarchy through a consistent combination of size, weight, line height, and spacing.
- Keep body text readable and labels concise.
- Avoid arbitrary font sizes and weights when existing typography utilities or tokens are available.
- Do not use typography alone to compensate for unclear information architecture.

## 2.4 Spacing, sizing, and shape

- Follow the spacing scale already used by the project.
- Use consistent gaps and padding between related elements.
- Prefer fluid sizing and layout constraints over arbitrary fixed widths and heights.
- Use consistent border-radius and shadow tokens.
- Fixed dimensions are acceptable only when the component has a clear size requirement; verify that they do not break responsive behavior.
- Avoid adding nested containers, cards, borders, or shadows without a clear information or interaction purpose.

## 2.5 Visual direction: Soft Premium

The default visual direction is **Soft Premium**: a calm, rounded, tactile interface with clear hierarchy, geometric typography, and deliberate layered depth.

Combine:
- Soft Modern SaaS as the primary visual language.
- Geometric typography for a contemporary, confident tone.
- Extra-rounded shapes for cards and major surfaces.
- Layered shadows for depth, not heavy outlines or exaggerated glow.
- Restrained accent colors and generous whitespace.

The interface should feel approachable and polished without becoming childish, overly decorative, or visually heavy. Use this direction consistently across pages, dialogs, forms, navigation, tables, and empty states.

## 2.6 Theme strategy: Light and Dark

Support both Light and Dark themes through the project's existing theme mechanism.

- Use semantic CSS variables and shadcn/ui tokens as the single source of truth.
- Components must consume semantic roles (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, and `ring`) rather than embedding theme-specific colors.
- Define separate Light and Dark token values centrally.
- Dark mode is not a simple inversion of Light mode: tune surface elevation, border visibility, text contrast, and shadow behavior independently.
- Avoid pure black backgrounds and pure white surfaces as the default large-area colors; prefer nuanced neutral surfaces.
- Keep accent colors recognizable in both themes, but adjust their lightness and saturation for contrast.
- Never use color alone to communicate status or selection.
- Theme switching must not cause layout shifts, unreadable text, invisible borders, or inconsistent component states.

Suggested color roles (adapt exact values to the existing brand and contrast requirements):

| Role | Light theme direction | Dark theme direction |
|---|---|---|
| App background | Soft cool/warm neutral | Deep charcoal with a slight hue |
| Main surface | White or near-white | Elevated charcoal |
| Secondary surface | Light neutral tint | Slightly lighter/darker neutral layer |
| Primary text | Deep slate | Near-white |
| Secondary text | Muted slate | Muted cool gray |
| Border | Low-contrast neutral | Subtle light neutral with sufficient visibility |
| Primary accent | Indigo, blue-violet, or brand color | Adjusted brighter brand accent |
| Focus ring | Clearly visible accent | Clearly visible adjusted accent |
| Success / warning / destructive | Semantic, restrained colors | Theme-adjusted semantic colors |

Do not introduce a new palette or change brand colors without checking the existing project tokens and product identity first.

## 2.7 Geometric typography

Use a geometric or modern sans-serif typeface with clear letterforms and strong readability.

Preferred selection order:
1. Reuse the font already configured in the project if it already fits the intended direction.
2. Prefer Geist Sans when it is installed or can be adopted consistently through the project's existing Next.js font setup.
3. Consider Plus Jakarta Sans as an alternative when its character better fits the product.
4. Do not load multiple competing font families without a clear typographic role.

Typography rules:
- Use a consistent type scale and a limited set of weights.
- Use 700–800 for page titles and high-level headings where appropriate.
- Use 600–700 for card titles, section headings, and primary button labels.
- Use 500–600 for navigation, form labels, table headers, and emphasized metadata.
- Use 400–500 for body text, descriptions, helper text, and secondary information.
- Do not make every text element bold. Preserve hierarchy by varying size, weight, color, and line height.
- Prefer readable line heights and avoid overly tight tracking in body text.
- Use tabular numerals for financial figures, metrics, dates, and aligned numeric columns where supported.
- Avoid excessively large headings in data-dense application screens.
- Check Vietnamese diacritics, punctuation, numerals, and mixed-language labels after changing fonts.

Suggested hierarchy (adjust to the actual product density and responsive needs):

| Element | Suggested size | Weight |
|---|---:|---:|
| Page title | 28–36px | 700–800 |
| Section title | 20–24px | 700 |
| Card title | 16–20px | 600–700 |
| Body | 14–16px | 400–500 |
| Form label | 13–14px | 600 |
| Helper / metadata | 12–13px | 400–500 |
| Button | 14–15px | 600–700 |

These are design references, not permission to hardcode arbitrary font sizes in every component. Prefer the project's typography tokens and responsive utilities.

## 2.8 Extra-rounded shape language

Use an extra-rounded shape language for major surfaces while keeping controls practical.

| Component | Suggested radius |
|---|---:|
| Large page panel / hero surface | 28–32px |
| Card / dashboard panel | 24–28px |
| Dialog / sheet | 24–28px |
| Input / select / textarea | 14–16px |
| Standard button | 14–16px |
| Compact icon button | 12–14px |
| Badge / chip | Pill or 9999px when semantically appropriate |
| Avatar | 50% |

Rules:
- Centralize radii through CSS variables or Tailwind theme tokens.
- Use a small, consistent radius scale; do not assign unrelated radii to every component.
- Keep nested surfaces visually coherent. Inner elements may use a slightly smaller radius than their parent.
- Use pill shapes for chips, tags, and compact status labels—not automatically for every button or input.
- Do not make every container excessively rounded if it reduces usable space or makes dense interfaces look inflated.
- Preserve the existing shadcn/ui radius contract when updating the shared radius token.

## 2.9 Layered depth and shadow system

Use **Layered Shadow** to establish elevation and focus. Shadows should be soft, broad, and subtle, with multiple low-opacity layers rather than one dark, hard shadow.

Apply depth intentionally:
- Base page: no decorative shadow.
- Standard card: very light ambient shadow or border separation.
- Elevated card / popover: stronger layered shadow.
- Dialog / command surface: highest elevation with a clear backdrop.
- Hoverable card: a small increase in elevation, not a large jump.
- Focused control: use a visible focus ring; do not rely on shadow alone.

Rules:
- Define shared shadow tokens for card, hover, dropdown/popover, and dialog elevation.
- Tune Light and Dark shadows separately. Dark mode may need subtle borders and surface contrast because black shadows are less visible.
- Use colored shadow only as a restrained accent around a primary action or a deliberately highlighted surface.
- Do not apply strong glow to every card, button, or input.
- Avoid nested shadows on every child inside an already elevated card.
- Prefer a subtle border plus a soft shadow when the surface needs clearer separation.
- Do not use shadow as a substitute for accessible focus indicators.

## 2.10 Interaction and control sizing

Make the interface easy to understand and easy to operate.

- Standard buttons and form controls should generally be around 44–48px high.
- Compact controls may be smaller only when the context remains comfortably usable.
- Icon-only actions need an accessible name and a sufficiently large interactive hit area; target approximately 40–44px where practical.
- Use clear visual hierarchy for primary, secondary, outline, ghost, and destructive actions.
- Keep primary actions visually prominent without making every action compete for attention.
- Provide distinct hover, active, focus-visible, disabled, loading, and selected states.
- Use pointer cursors only for genuinely interactive elements.
- Do not rely on hover to reveal essential actions; support touch and keyboard access.
- Keep labels and action text explicit. Avoid ambiguous icon-only controls for unfamiliar actions.
- Prevent duplicate submissions and provide immediate, understandable feedback.

## 2.11 Soft Premium component patterns

Apply the visual direction through shared patterns rather than one-off styling.

- **Cards:** generous but controlled padding, 24–28px radius, subtle border, and low-elevation shadow. Use card nesting only when it expresses a real hierarchy.
- **Buttons:** 14–16px radius, medium-to-bold label, clear contrast, restrained hover elevation. Avoid excessive gradients and permanent glow.
- **Inputs:** 14–16px radius, consistent height, visible label, clear focus ring, and readable placeholder contrast.
- **Dialogs and sheets:** 24–28px radius, deliberate spacing, clear title and action hierarchy, predictable focus behavior.
- **Navigation:** clear active state, adequate spacing, consistent icon sizing, and restrained accent treatment.
- **Tables:** prioritize scanability and alignment over decorative card treatment. Use subtle row separation and clear headers.
- **Badges:** compact semantic labels with restrained colors. Avoid using badges as decoration.
- **Empty states:** concise explanation and one clear next action where applicable.
- **Dashboard metrics:** strong numeric hierarchy, tabular numerals, clear labels, and restrained accent usage.

Do not force every component into a card. Use flat layout, dividers, and whitespace when they communicate structure more clearly.

## 2.12 Motion and visual restraint

- Use short, purposeful transitions for hover, focus, expansion, and state changes.
- Prefer opacity, color, and small transform changes over large movement.
- Keep hover elevation subtle and consistent.
- Avoid continuous animation, pulsing glow, parallax, or decorative motion in routine admin workflows.
- Respect `prefers-reduced-motion`.
- Ensure the interface remains clear and responsive when motion is disabled.

# 3. Component Architecture

Organize components by responsibility and reuse scope. Adapt the exact folder structure to the repository's existing architecture.

A recommended structure is:

```text
components/
├── ui/                  # shadcn/ui primitives and low-level UI building blocks
├── shared/              # Reusable application-wide components
└── features/
    ├── feature-a/       # Components specific to one feature
    └── feature-b/
```

Some projects may place feature components under `features/<feature>/components`. Follow the existing project convention rather than creating parallel structures.

## 3.1 Component categories

### UI primitives

Examples: Button, Input, Label, Select, Dialog, Dropdown Menu, Tooltip, Tabs, Table.

- Keep low-level primitives generic and reusable.
- Avoid placing business rules, API calls, or feature-specific assumptions inside generic UI primitives.
- Preserve the API and behavior expected by existing consumers when modifying a shared primitive.
- Keep accessibility behavior and keyboard interactions intact.

### Shared application components

Examples: PageHeader, EmptyState, ConfirmDialog, SearchInput, DataTableToolbar, LoadingState.

- Place components here only when they are genuinely reused across multiple features or represent an application-wide pattern.
- Keep props explicit and focused.
- Avoid making a component configurable for hypothetical use cases that do not exist.

### Feature components

Examples: ProductForm, OrderStatusBadge, UserFilters, InvoiceSummary.

- Keep feature-specific presentation and composition close to the feature that owns it.
- Do not move a component into a global shared directory merely because it is used more than once within one feature.
- Extract shared components when reuse is real and the abstraction is stable.

## 3.2 Component boundaries

- A component should have one clear responsibility.
- Separate presentation from data fetching and business logic when doing so improves clarity and testability.
- Keep server-side data access on the server where appropriate.
- Add a Client Component boundary only when browser-side interactivity, state, effects, or browser APIs require it.
- Do not add `"use client"` to a component by default.
- Avoid oversized components that combine page layout, data access, validation, business rules, and many unrelated interactions.
- Avoid excessive fragmentation into tiny components that make the UI harder to follow.

# 4. Component Conventions

## 4.1 Naming

- Use PascalCase for React component names and component files when consistent with the repository.
- Use descriptive names based on UI responsibility or domain meaning.
- Use camelCase for functions, variables, and event handlers.
- Use names that communicate intent; avoid vague names such as `Box1`, `Wrapper2`, or `Thing`.
- Follow the established naming style for route files and framework-specific files.

## 4.2 Props and types

- Define explicit prop types with TypeScript.
- Prefer a named props type or interface when it improves readability or is reused.
- Keep the public component API small and purposeful.
- Avoid `any`; use appropriate domain types, unions, generics, or `unknown` with narrowing.
- Avoid boolean-prop proliferation when a variant or composition pattern is clearer.
- Provide sensible defaults only when they are unambiguous.
- Do not expose internal implementation details as public props without a real use case.

## 4.3 Variants and composition

- Use the project's established variant utility or pattern for components with meaningful visual variants.
- Keep variants finite, named, and semantically meaningful (for example: `default`, `secondary`, `destructive`, `outline`, `ghost`).
- Reuse existing Button, Badge, Input, and other primitives rather than recreating their styling in each feature.
- Prefer composition and slots/children when they produce a clearer API than many configuration props.
- Avoid creating one-off variants that duplicate an existing style with only a trivial difference.
- Do not build a custom abstraction around a primitive unless it removes meaningful duplication or captures a stable product pattern.

## 4.4 Events and state

- Use clear event handler names such as `handleSubmit`, `handleOpenChange`, and `handleDelete`.
- Keep state as close as practical to the component or feature that owns it.
- Avoid duplicating derived state; compute values from their source when possible.
- Use controlled or uncontrolled behavior consistently and document it when the component is shared.
- Prevent duplicate submissions and provide appropriate pending, success, and error states.
- Do not hide important state transitions behind unclear side effects.

# 5. shadcn/ui Conventions

shadcn/ui is the project's component foundation. Treat its components as project-owned source code that must be maintained consistently.

- Before adding a component, check whether it already exists in `components/ui/` or the configured components directory.
- Use the project's configured shadcn/ui style, aliases, CSS variables, and utility conventions.
- Add components using the project's established CLI/configuration workflow when applicable; do not manually copy arbitrary versions from unrelated projects.
- Customize a shadcn/ui component only when the product requires it.
- Keep customizations aligned with the shared design tokens and existing component API.
- Do not replace an existing shadcn/ui primitive with a different library for convenience.
- Do not overwrite or regenerate a customized component without inspecting its local changes and downstream usage.
- When updating a primitive, check all affected call sites and preserve required behavior.
- Prefer composing shadcn/ui primitives into application components over duplicating their low-level behavior.
- Keep accessibility, focus management, keyboard navigation, and dialog/menu semantics intact.

# 6. Tailwind CSS and Styling Rules

- Use the project's configured Tailwind CSS version and conventions.
- Prefer utility classes for component-level styling when that is the established project approach.
- Use shared CSS variables and semantic tokens for design-system values.
- Use the project's class-merging helper (such as the existing `cn` utility) when available and appropriate.
- Keep class lists readable; extract a component or shared style when a long class list represents a reusable pattern.
- Avoid duplicating large class strings across multiple components.
- Avoid arbitrary values when an existing spacing, sizing, color, or typography token is suitable.
- Use arbitrary values only when the design requires a specific value that cannot reasonably be represented by existing tokens.
- Do not mix Tailwind, CSS Modules, global CSS, inline styles, and other styling approaches without a clear architectural reason.
- Keep global CSS focused on resets, fonts, tokens, theme definitions, and genuinely global behavior.
- Avoid broad selectors that unintentionally affect unrelated components.
- Do not use inline styles for static styling. They may be appropriate for truly dynamic values that cannot be expressed cleanly through the project's styling system.
- Avoid `!important`; resolve specificity and component-boundary problems instead.

# 7. Icons and Image Assets

## 7.1 Icon sources

- Reuse existing project icons and assets before introducing new ones.
- Flaticon may be used as a source for icons and illustrations when appropriate.
- Maintain a consistent visual style across the interface.
- Do not mix outline, filled, 3D, flat, and illustration styles without a deliberate design decision.
- Check the license, attribution, and usage requirements for each downloaded asset before using it.
- Do not download duplicate assets or replace existing icons without a clear reason.
- Do not assume that an asset is free for every use merely because it can be downloaded.

## 7.2 Next.js Image usage

- Use Next.js `Image` for raster or image-based visual assets when appropriate.
- Provide explicit dimensions or an appropriate responsive sizing strategy to prevent layout shift.
- Preserve the asset's original aspect ratio; do not stretch or distort icons.
- Use `object-fit` intentionally when an image needs to fit a defined container.
- Provide meaningful `alt` text when an image conveys information.
- Use `alt=""` when an image is purely decorative or its meaning is already conveyed by adjacent text.
- Prefer local assets stored in `public/` when the project owns and serves the downloaded files.
- When using a remote source with `next/image`, verify that the host is permitted by the project's `images.remotePatterns` or other applicable Next.js image configuration.
- Do not add a remote host to the image configuration unless the feature requires it and the host is trusted.
- Do not use `Image` merely to render a UI icon if an existing icon component is more appropriate.

## 7.3 Choosing the right rendering method

| Asset type | Preferred approach |
|---|---|
| Flaticon PNG, WebP, or other raster asset | Next.js `Image` |
| Flaticon SVG file | Use `Image` when appropriate, or an approved SVG rendering approach already used by the project |
| Lucide or another installed icon component | Use the existing icon component |
| Brand logo | Use `Image` or SVG according to the asset format and project convention |
| Large illustration or banner | Next.js `Image` with an appropriate responsive sizing strategy |

Do not introduce a new icon library or SVG rendering dependency just to display a small number of downloaded assets.

## 7.4 Asset organization

A suggested structure is:

```text
public/
└── images/
    ├── icons/
    │   ├── dashboard/
    │   ├── products/
    │   └── users/
    ├── illustrations/
    └── banners/
```

- Follow the repository's existing public asset structure if one already exists.
- Group assets by purpose or feature when the collection becomes large.
- Use descriptive, consistent, lowercase filenames.
- Avoid duplicate files, unclear names, and unnecessary nesting.
- Keep icons separate from general illustrations and banners when that improves discoverability.

## 7.5 Asset hard constraints

- Do not replace an existing project icon library or asset source without justification.
- Do not introduce another icon library when existing icons meet the requirement.
- Do not distort, stretch, or arbitrarily recolor downloaded assets.
- Do not use assets without checking their licensing and attribution requirements.
- Do not reference an external image host through `next/image` unless it is allowed by the project's Next.js image configuration.
- Do not use `next/image` for every icon by default; choose the rendering method based on the asset type and existing project conventions.

# 8. Layout and Page Composition

- Use the project's shared page layout, container, header, navigation, and content patterns.
- Maintain consistent page gutters, maximum content widths, section spacing, and alignment.
- Use CSS Grid or Flexbox according to the layout's actual structure.
- Keep related information and actions together.
- Establish a clear hierarchy between page title, description, primary action, filters, content, and secondary actions.
- Avoid unnecessary nesting of cards and containers.
- Avoid fixed page widths that cause overflow on smaller screens.
- For data-dense screens, preserve readability and task completion rather than shrinking every element to fit.
- Tables may use an intentional responsive strategy such as horizontal scrolling, column prioritization, or a mobile-specific presentation. Do not allow accidental page-level overflow.
- Keep empty, loading, error, and success states visually consistent across features.

# 9. Responsive Design — Mandatory

Responsive behavior is part of the initial implementation, not a later enhancement.

Every page, component, form, navigation pattern, dialog, table, and interaction must be considered across the project's supported viewport sizes.

## 8.1 Target environments

Design and verify for:

- Mobile phones.
- Tablets.
- Laptops.
- Desktop monitors.
- Intermediate viewport widths around layout breakpoints.
- Portrait and landscape orientations when relevant.

Do not assume that device categories map to one fixed width. Choose breakpoints based on content and layout requirements.

## 8.2 Responsive implementation

- Use a mobile-first or otherwise deliberate adaptive strategy.
- Prefer fluid widths, flexible Grid/Flexbox layouts, and sensible max-width constraints.
- Reflow, collapse, reorder, or stack content intentionally when space is limited.
- Keep primary actions and essential information available on small screens.
- Adapt sidebars, navigation, toolbars, filters, forms, tables, cards, and dialogs to the viewport.
- Ensure controls remain usable with touch input.
- Do not rely on hover as the only way to access important functionality.
- Prevent unintended horizontal scrolling, clipped content, overlapping elements, and inaccessible controls.
- Account for text scaling, browser zoom, safe-area insets, and orientation where relevant.
- Do not force desktop layouts onto mobile screens or simply scale everything down.

## 8.3 Responsive verification

For each UI change, test representative viewport widths:

- Narrow and typical mobile widths.
- Compact and wide tablet widths.
- Common laptop widths.
- Larger desktop widths.
- Widths immediately above and below relevant breakpoints.

Verify that navigation, forms, tables, dialogs, menus, and primary actions remain usable. Do not mechanically test every possible device size for every minor change; select representative sizes based on the affected components and risk.

# 10. Cross-Browser and Platform Compatibility

The UI must work in the browsers and operating systems supported by the project.

- Confirm the project's actual browser support policy before making compatibility claims.
- Consider current supported versions of Chrome, Edge, Firefox, and Safari.
- Consider Safari on iOS and Chrome on Android when mobile browsers are in scope.
- Prefer standards-based HTML, CSS, and browser APIs.
- Check browser support before relying on newer CSS properties, JavaScript APIs, or platform-specific behavior.
- Use feature detection or progressive enhancement when support may vary.
- Provide a usable fallback for essential functionality.
- Avoid browser-specific hacks unless a verified issue requires them; document and narrowly scope any workaround.
- Pay attention to differences in form controls, date/time inputs, file uploads, scrolling, sticky/fixed positioning, viewport units, fonts, and native dialogs when relevant.
- Verify critical flows on supported browser/device combinations.
- If real-device testing is unavailable, use browser emulation as an initial check and state what remains unverified.
- Do not claim compatibility with every browser or device unless the support scope has been defined and tested.

# 11. Accessibility and Interaction

- Use semantic HTML elements according to their meaning.
- Ensure interactive elements are keyboard accessible.
- Maintain visible focus indicators.
- Provide accessible names for controls, including icon-only buttons.
- Associate form labels and validation messages with their inputs.
- Use ARIA only when native HTML semantics are insufficient; do not add redundant or incorrect ARIA attributes.
- Ensure dialogs, menus, popovers, tabs, and other interactive patterns support expected keyboard behavior and focus management.
- Do not communicate status through color alone.
- Respect reduced-motion preferences when adding non-essential animation.
- Use practical touch target sizes and spacing.
- Ensure disabled, loading, error, and focus states are distinguishable.
- Do not remove browser-native accessibility behavior without a suitable replacement.

# 12. Forms and Data-Dense Interfaces

- Use consistent form controls and validation presentation.
- Provide clear labels, helper text, required indicators, and actionable error messages where appropriate.
- Keep validation behavior predictable and avoid showing errors before the user can reasonably understand them.
- Preserve user input when recoverable errors occur.
- Disable or otherwise protect submit actions while a request is pending when duplicate submission is possible.
- Use appropriate input types and autocomplete attributes.
- For tables and dense data views, maintain readable alignment, clear headers, and predictable action placement.
- Provide intentional empty, loading, error, and no-results states.
- Ensure forms and data tables remain usable on mobile and tablet; choose a deliberate responsive pattern rather than merely shrinking controls.

# 13. Animation and Motion

- Use animation only when it clarifies state changes, hierarchy, or interaction feedback.
- Keep transitions short, subtle, and consistent.
- Avoid decorative motion that distracts from the task or harms performance.
- Respect `prefers-reduced-motion`.
- Do not animate large layout regions unnecessarily.
- Ensure content remains understandable and usable when animation is disabled.

# 14. Performance

- Avoid unnecessary client-side JavaScript and unnecessary `"use client"` boundaries.
- Prefer server rendering and server-side data access when client interactivity is not required.
- Avoid expensive visual effects, oversized assets, and unnecessary animation.
- Use appropriate image optimization and dimensions to prevent layout shifts.
- Lazy-load non-critical content when it provides a measurable benefit.
- Avoid unnecessary re-renders and duplicated state.
- Do not sacrifice accessibility, responsiveness, or maintainability for premature micro-optimization.

# 15. Hard Constraints — Do Not Violate

The following constraints are mandatory unless the user explicitly approves an exception:

1. **Do not introduce a second UI framework or styling system** when the existing project stack already provides the required capability.
2. **Do not recreate existing primitives** when an appropriate component already exists in the project's UI component directory.
3. **Do not overwrite customized shared components** without inspecting their implementation and all relevant usages.
4. **Do not hardcode design-system values repeatedly** when shared tokens or utilities already exist.
5. **Do not introduce feature-specific business logic into generic UI primitives.**
6. **Do not add `"use client"` by default**; use the smallest client boundary required.
7. **Do not implement desktop-only layouts**; responsive behavior is mandatory from the start.
8. **Do not rely on hover alone** for essential actions.
9. **Do not create inaccessible controls**, remove focus indicators, or bypass keyboard interaction.
10. **Do not leave horizontal overflow, clipped content, overlapping controls, or broken responsive layouts** in the affected UI.
11. **Do not silently change shared component APIs or visual behavior** in ways that may break other features.
12. **Do not add dependencies for convenience** when existing project tools can solve the problem.
13. **Do not use arbitrary styling overrides or `!important`** to conceal an underlying design or architecture problem.
14. **Do not claim cross-browser or cross-device compatibility without checking the supported scope.**
15. **Do not make unrelated UI, theme, or design-system changes** as part of a narrowly scoped task.

If a requirement cannot be met without violating a hard constraint, explain the trade-off and ask for approval before proceeding.

# 16. Required Workflow for UI Changes

Before changing the UI:

1. Read this document and the relevant rules in project `AGENTS.md`.
2. Inspect the existing page, related components, design tokens, styles, and component configuration.
3. Identify existing components and patterns that should be reused.
4. Determine affected viewport sizes, browsers, interactions, and accessibility requirements.
5. Propose or follow the smallest consistent implementation.

During implementation:

1. Reuse existing tokens, primitives, and shared patterns.
2. Keep component boundaries and client/server responsibilities intentional.
3. Implement responsive behavior as part of the initial change.
4. Preserve existing behavior unless the requirement explicitly changes it.
5. Avoid unrelated refactors and dependency changes.

Before completion:

1. Check the affected UI at representative mobile, tablet, laptop, desktop, and intermediate widths.
2. Check supported browsers relevant to the change.
3. Verify keyboard, touch, and mouse interactions as applicable.
4. Verify loading, empty, error, success, and disabled states where relevant.
5. Check for overflow, clipping, overlap, focus visibility, and readable text.
6. Run the relevant project checks and tests.
7. Report any browser/device combinations or behaviors that could not be verified.

# 17. UI Completion Checklist

Use this checklist for every meaningful UI change:

- [ ] Existing components, styles, and design tokens were inspected before implementation.
- [ ] Existing primitives and shared components were reused where appropriate.
- [ ] Component responsibilities, props, and variants are clear and consistent.
- [ ] No unnecessary UI library, styling system, or dependency was introduced.
- [ ] Design tokens are used instead of repeated arbitrary values.
- [ ] The UI follows the project's typography, spacing, color, and layout conventions.
- [ ] Soft Premium visual direction is applied consistently without unnecessary decoration.
- [ ] Light and Dark themes use semantic tokens and remain readable in both modes.
- [ ] Geometric typography preserves a clear hierarchy and readable Vietnamese text.
- [ ] Extra-rounded radii and layered shadows are applied through shared tokens, not scattered one-off values.
- [ ] Hover, active, focus-visible, disabled, loading, and selected states are visually distinguishable.
- [ ] Mobile, tablet, laptop, desktop, and relevant intermediate widths were considered and checked.
- [ ] Supported browsers relevant to the change were checked.
- [ ] Touch, mouse, and keyboard interactions work where applicable.
- [ ] No unintended horizontal overflow, clipping, overlap, or inaccessible controls remain.
- [ ] Focus states, labels, and semantic structure are appropriate.
- [ ] Loading, empty, error, success, and disabled states are handled where relevant.
- [ ] No unrelated behavior or shared component API was changed unintentionally.
- [ ] Relevant tests, linting, type checks, and build checks were completed where applicable.
- [ ] Unverified limitations are clearly reported.

---

# Core Principle

**Build UI from the project's established design system—not from guesswork.**

Reuse before recreating. Inspect before modifying. Keep components purposeful. Make responsive behavior part of the initial implementation. Preserve accessibility and compatibility. Treat the hard constraints in this document as mandatory.
