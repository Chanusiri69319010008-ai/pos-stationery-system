# UI/UX Design System — Stationery Shop POS System

You are responsible for designing and implementing the UI/UX of this POS system.

Your goal is NOT simply to make the website "look beautiful".

The goal is to create an interface that is:

- Modern
- Clean
- Professional
- Friendly
- Organized
- Easy to scan
- Easy to learn
- Fast to use
- Consistent
- Suitable for daily POS operation

The interface must feel like a real commercial stationery shop POS system.

It should look like a professional business application,
not a generic dashboard template, portfolio website,
landing page, or overly decorative UI.

## 1. Core UI/UX Principles

Always prioritize:

1. Usability
2. Information hierarchy
3. Clarity
4. Consistency
5. Speed of operation
6. Accessibility
7. Visual quality

Do not sacrifice usability just to make the interface visually impressive.

Every visual decision must have a reason.

When deciding between:

- beautiful but confusing
- simple but easy to use

Choose the option that is easier to use while still maintaining a polished visual design.

## 2. Visual Style

Use a modern business application style.

The visual language should feel:

- Professional
- Calm
- Friendly
- Reliable
- Clean
- Structured

Use visual hierarchy through: spacing, typography, size, weight, alignment, color, grouping, borders, subtle shadows.

Avoid excessive decoration.

DO NOT use: excessive gradients, excessive shadows, excessive rounded cards, excessive animations, excessive icons, unnecessary illustrations, decorative elements that do not improve usability, random colors, random font sizes, random border radius, excessive glassmorphism, overly colorful dashboard layouts.

## 3. Color System

**PRIMARY — ROYAL `#162660`** — Primary buttons, active navigation, selected navigation, important headings, selected states, important actions, brand identity.

**SECONDARY — POWDER BLUE `#D0E6FD`** — Soft backgrounds, secondary highlights, hover surfaces, selected surfaces, supporting UI areas.

**ACCENT — BONE `#F1E4D1`** — Warm supporting areas, decorative but functional highlights, non-critical emphasis, supporting visual sections.

**BACKGROUND** — White / very light neutral backgrounds. Main content area should remain visually clean.

**TEXT** — Dark neutral for primary text.

**MUTED TEXT** — Medium gray for secondary information, helper text, metadata, less important labels.

**SEMANTIC COLORS** — Success = Green, Warning = Amber, Error/Danger = Red. Only use when their meaning is relevant — never for decoration.

Do not use all brand colors everywhere. Royal is the main visual anchor, Powder Blue supports it, Bone is used sparingly.

## 4. Design Tokens

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (px). Prefer these values whenever possible.

Border radius: small controls 6px; inputs/buttons 8px; cards/modals 12px; large containers 16px. Do not make every element extremely rounded.

Shadow: subtle only, when necessary to establish hierarchy. Avoid heavy shadows.

Border: subtle neutral borders for inputs, tables, cards, separators, containers.

## 5. Typography

One primary font family throughout, must support Thai and English clearly.

- Page Title: 24–28px / 700
- Section Heading: 18–20px / 600
- Component Title: 16px / 600
- Body: 14–16px / 400
- Table text: 14px
- Input text: 14–16px
- Button text: 14px / 500–600
- Caption/helper: 12–13px

Do not randomly change font sizes between pages.

## 6. Application Layout

Consistent shell: Header + Sidebar + Main Content, throughout the app. User should always understand where they are, what page they're viewing, what they can do, what action is most important. Main content: clear page title, appropriate spacing, clear section hierarchy, consistent content width, logical grouping. Avoid overcrowding.

## 7. Component System

Reusable components: Button (variants: Primary/Secondary/Outline/Ghost/Danger; states: Default/Hover/Active/Focus/Disabled/Loading), Input (Label/Input/Placeholder/Helper/Error; states: Default/Focus/Filled/Error/Disabled), Select, Search, DatePicker, Checkbox, Radio, Switch, Card, Table, Badge, Modal, Dropdown, Tabs, Pagination, Toast, Alert, Tooltip, Breadcrumb.

## 8. Component Composition

Break the interface into logical components with ONE clear responsibility each. Do not put everything into one large component, but don't create unnecessary components just to grow the folder structure.

## 9. Page Composition

General structure: Page Header → Primary Actions/Filters → Main Content → Supporting Information. Do not force every page into the exact same layout — layout depends on the page's purpose.

## 10. Dashboard

Page Title → Important KPI/Summary → Sales/Business Overview → Alerts/Important Information → Detailed Information. Every card must provide useful information. Avoid creating charts simply because dashboards commonly contain charts.

## 11. Product Management

Page Header → Search/Filters/Main Action → Product Table → Pagination. Table must be easy to scan; important info has stronger visual hierarchy; actions easy to find without overwhelming the table.

## 12. Inventory

Prioritize: current stock, low stock, product identification, stock movement, stock adjustment actions. Low-stock info should be noticeable without making the whole page feel alarming.

## 13. POS

Most important operational interface — prioritize SPEED and CLARITY.

Product Search/Barcode → Product Selection → Shopping Cart → Quantity/Price → Promotion → VAT → Total → Payment → Confirm Sale.

Total must have strong visual hierarchy. Primary actions (Add product, Checkout, Confirm payment) must be easy to locate — never hidden behind unnecessary menus. Avoid excessive decoration.

## 14. Table Design

Use: clear column headings, consistent row height, appropriate spacing, readable text, aligned numerical values, clear action placement. Avoid: excessive borders, excessive colors, extremely dense rows, unnecessary icons. Semantic colors only when they communicate status.

## 15. Forms

Each input: Label, Input, optional helper text, error message when necessary. Group related fields together in logical visual sections. Required fields must be clear. Validation errors appear close to the relevant field.

## 16. Modals

Use only when the action requires focused attention (delete confirmation, void transaction, important confirmation, short focused form). Don't put entire complex workflows inside a modal if a dedicated page would be better.

## 17. Icons

Must support understanding, used consistently, never just to decorate empty space. Actions should remain understandable even without relying only on icons. For important actions, prefer Icon + Text over icon-only. Icon-only buttons must have accessible labels/tooltips.

## 18. Interaction States

Every interactive component must consider: Default, Hover, Active, Focus, Disabled, Loading, Success, Error. Users must receive visual feedback when interacting with controls.

## 19. Data States

Data-driven pages must support: Loading, Empty, No search results, Error, Success. Empty state should explain what is empty, why (if useful), and what the user can do next. No-search-result state should clearly say so and offer an easy way to change the search/filter.

## 20. Responsive Design

Primarily a desktop POS system, but must remain usable at smaller screen sizes. Avoid horizontal overflow, clipped text, overlapping elements, inaccessible buttons, broken tables, buttons extending outside containers. For tables, use appropriate responsive behavior rather than shrinking everything until unreadable.

## 21. Accessibility

Use semantic HTML, proper labels, keyboard-accessible controls, visible focus states, sufficient contrast, meaningful button text, accessible form errors. Do not communicate meaning using color alone — use color + text + appropriate icon when useful.

## 22. Visual Hierarchy Rule

Every page must clearly communicate: (1) what page am I on, (2) what is the most important information, (3) what is the primary action, (4) what information is secondary, (5) what can I interact with. If everything looks equally important, the hierarchy is wrong.

## 23. Card Usage

Do not put every section inside a Card. Use cards only when they help group related information, establish hierarchy, separate independent content, or highlight important information. Avoid a page consisting of dozens of identical cards.

## 24. Consistency Rule

The same UI pattern must look and behave consistently everywhere (same button color/radius/text-size/weight/padding pattern used throughout) unless there's a clear UX reason for a difference.

## 25. Do Not Invent UI

Do not add unnecessary pages, sections, cards, charts, buttons, animations, decorative elements, or features not specified by the requirements. Wireframe defines page structure; this design system defines the visual language; business rules define behavior. Your job is to implement and improve presentation without changing intended functionality.

## 26. Design Decision Rule

You MAY improve: spacing, typography, alignment, component structure, visual hierarchy, color application, component consistency, responsive behavior, accessibility, interaction feedback.

You MUST NOT silently change: business logic, user flow, page purpose, navigation hierarchy, role permissions, required functionality, data structure, API behavior.

If a visual improvement would change functionality or page structure: STOP. Explain (1) current design, (2) proposed change, (3) why it improves UX, (4) possible impact. Wait for approval before implementing.

## 27. Implementation Principle

Before creating a new component: (1) check whether a reusable component already exists, (2) reuse it if appropriate, (3) extend it only when necessary, (4) create new only when it has a clear responsibility. Do not duplicate components representing the same UI pattern (e.g. Button.tsx / PrimaryButton.tsx / BlueButton.tsx / MainButton.tsx) — use one reusable Button with variants instead.

## 28. Final UI Quality Check

Before considering a page complete, check: layout clarity, visual hierarchy clarity, logical component organization, color consistency, typography consistency, spacing consistency, identifiable buttons, easy-to-find important actions, understandable forms, scannable tables, interactive states present, loading/empty/error states where needed, safe responsive behavior, accessibility basics covered, no unnecessary decoration, no duplicated UI patterns, no unnecessary cards, no random colors/spacing, no unnecessary animations, existing functionality preserved.

The final result should feel like a polished, real-world stationery shop POS application.
