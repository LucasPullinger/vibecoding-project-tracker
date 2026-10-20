# Vibecoding Project Tracker — Design

**Status:** Hackathon starter design doc · fill in the **`<TODO>`** sections before you tag `design-done`.

**Why this file exists.** This tracker is your tool. It should look like *your* tool — not a generic Kanban with default Tailwind blue. Twenty minutes of design decisions here will be visible on every screen for the next six weeks of Module 5.

**Who owns this.** Person B, during the same window the rest of the team is reviewing the PRD. By the time the team converges to start M4 (`data-model`), this file should be filled in and the colors should already be in `tailwind.config.js`.

---

## 1. Mood / vibe

One sentence that captures the feeling the tracker should leave you with.

A calm, minimal development workspace that prioritises clarity, efficiency, and accessibility while keeping tasks and AI context easy to manage.

Two or three references that capture the vibe (links to dribbble shots, screenshots of apps you admire, Pinterest boards — anything visual):

- [Linear](https://linear.app/) — Minimal interface, clear task organisation, consistent spacing, and visual hierarchy.
- [GitHub Projects](https://github.com/features/issues) — Familiar Kanban workflows, structured task information, and clear status indicators.
- [Notion](https://www.notion.com/product/projects) — Neutral backgrounds, readable typography, and organised information.

Anti-references — what we are explicitly **not** trying to look like:

- Cluttered dashboards, bright gradients, excessive animation, and interfaces that rely entirely on colour to communicate information.

## 2. Color palette

These are the colors the build milestones will reference. Once chosen, paste the hex values into `tailwind.config.js` so the rest of the team can use Tailwind utility classes (e.g. `bg-brand-primary`, `border-due-warning`).

### Brand

| Token             | Hex         | Where it shows up               |
| ----------------- | ----------- | ------------------------------- |
| `brand-primary` | `#245C4F` | Header, "+" button, focus rings |
| `brand-accent`  | `#934A2F` | Highlights, hover states, links |
| `surface-page`  | `#F7F6F2` | Page background                 |
| `surface-card`  | `#FFFFFF` | Card background                 |
| `text-primary`  | `#1D2926` | Body text                       |
| `text-muted`    | `#53615C` | Captions, dates, counts         |

### Task type (M6 `tag-style`)

| Token            | Hex         | When used                                       |
| ---------------- | ----------- | ----------------------------------------------- |
| `type-feature` | `#6F42A1` | Cards tagged `feature` (accent stripe + icon) |
| `type-bug`     | `#B42318` | Cards tagged `bug` (accent stripe + icon)     |

### Due-date states (M8 `due-tint`)

| Token           | Hex         | When used             |
| --------------- | ----------- | --------------------- |
| `due-safe`    | `#246B53` | More than 2 days out  |
| `due-warning` | `#91600B` | Less than 24 hours    |
| `due-overdue` | `#B42318` | Past due              |
| `due-neutral` | `#667085` | Done (overrides date) |

## 3. Typography

| Role                           | Font          | Why                                                                                                                   |
| ------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Heading                        | Inter         | Clear letterforms and consistent weights establish visual hierarchy, helping users distinguish important information. |
| Body                           | Inter         | Familiar sans-serif typography supports readability and reduces unnecessary cognitive effort.                         |
| Monospace (tags, badges, code) | IBM Plex Mono | Distinguishes technical information from ordinary text and makes code and identifiers easier to recognise.            |

Suggested sizes (override only if the design demands it):

- Page title: 24 px / semibold
- Section header: 16 px / semibold uppercase
- Card title: 14 px / medium
- Body: 14 px / regular
- Caption: 12 px / regular muted

## 4. Component principles

One short sentence per element. These set the tone for the build phase — Person A's modal and Person B's anchor board should both feel like they came from this doc.

- **Cards:** White backgrounds, subtle 1px borders, consistent spacing, and minimal shadows to support Gestalt's principles of proximity and common region.
- **Buttons:** Solid colours, clear labels, rounded corners, and generous padding to improve recognition and reduce interaction errors.
- **Modal:** Centred, maximum width of 640px, dimmed backdrop, and clearly grouped fields to support progressive disclosure and reduce cognitive load.
- **Empty states:** Dashed borders, muted text, and concise instructions to communicate system status without unnecessary visual distractions.
- **Drag affordance (if used):** Provide a status dropdown as an alternative to dragging, supporting keyboard navigation and users with limited motor control.

## 5. Voice / microcopy

Three lines of microcopy that capture the tone of the product. Keep it short — these are the words a stressed user reads at 11pm.

| Where                                | Text                                                |
| ------------------------------------ | --------------------------------------------------- |
| "+" button label                     | `+ New task`                                      |
| Empty column placeholder             | `No tasks in this stage.`                         |
| Toast after "Copy as Prompt Context" | `Prompt context copied.`                          |
| Confirm-delete message               | `Delete this task? This action cannot be undone.` |
| Handoff toast (M7 `task-owner`)    | `Assigned to {name}.`                             |

## 6. Logo / wordmark

The tracker probably doesn't need a logo, but it does need a name and a wordmark style.

- **Product name:** Anchor (provisional — confirm against PRD §11 team identity).
- **Wordmark style:** Text-only wordmark using Inter Semibold in the brand-primary colour, with no additional icon.

## 7. Out of scope (this hackathon)

To keep design tight, the following are explicitly not part of `design-done`:

- A dark mode toggle. Pick one mode and ship it.
- Multiple themes. One brand, applied consistently.
- Animations beyond a 200 ms fade on toast notifications.
- A custom icon set. Use [Lucide icons](https://lucide.dev) via Tailwind classes if you need any.

---

*DESIGN.md version: hackathon-starter v1*
