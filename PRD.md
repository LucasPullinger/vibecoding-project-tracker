# Vibecoding Project Tracker — PRD

**Status:** Hackathon starter PRD · review and fill in the **`<TODO>`** sections before you tag `prd-done`.

---

## 1. Problem

Vibecoding teams have two recurring pains with large projects:

1. **They lose track of tasks.** Three teammates, a hundred small things, no shared view. Nothing tells them what state each task is actually in.
2. **They lose track of prompts.** The AI gave them working code two days ago but no one remembers the prompt that produced it. When they need to iterate, they start from scratch.

A spreadsheet doesn't solve this. A real project tool (Linear, Jira, Notion) is overkill, doesn't know about prompts, and takes hours to set up.

## 2. Target users

- **Primary:** the team members, for the remaining weeks of the summer semester.
- **Secondary:** future cohorts of vibecoders taking the same class.

We are designing the tool we ourselves will use. The pitch demo is also our first real user test.

## 3. Product overview

A single-page web app with two persistent surfaces:

- A **Kanban board** where vibecoding tasks move through four states.
- An **Anchor Board** above it that pins the four final-project deliverables (Presentation, Demo, Report, Documentation).

Each task carries the prompt context that produced it, so any teammate can click a button and copy the task + prompt history back into an AI chat to continue work.

## Functional requirements

What the system must do.

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| FR1 | Users can create, edit, and delete tasks. | Must |
| FR2 | Users can view tasks on a four-column Kanban board. | Must |
| FR3 | Users can move tasks between To Do, In Progress, Review, and Done. | Must |
| FR4 | Users can categorise tasks as features or bugs. | Must |
| FR5 | Users can assign tasks to team members and transfer ownership. | Must |
| FR6 | Users can set due dates and view deadline indicators. | Must |
| FR7 | Users can store technical context and AI prompts within tasks. | Must |
| FR8 | Users can record which AI tool they used for a task. | Must |
| FR9 | Users can copy task context as a formatted AI prompt. | Must |
| FR10 | Users can link project deliverables through an Anchor Board. | Must |
| FR11 | Users can create and edit tasks through a modal. | Must |
| FR12 | Users can view task counts for each Kanban column. | Must |
| FR13 | Users can filter tasks by type, status, or owner. | Should |
| FR14 | Users can view overall project progress. | Could |

## Non-functional requirements

How well the system must operate.

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| NFR1 | The interface must use clear and consistent layouts. | Must |
| NFR2 | The application must support desktop and mobile screen sizes. | Should |
| NFR3 | Common actions should complete within 2 seconds under normal conditions. | Should |
| NFR4 | The application must preserve task data after a page refresh. | Must |
| NFR5 | The application must validate user input and prevent invalid submissions. | Must |
| NFR6 | The application must display clear error and confirmation messages. | Must |
| NFR7 | The interface should follow WCAG 2.2 Level AA accessibility guidelines. | Should |
| NFR8 | Users must be able to operate essential controls using a keyboard. | Must |
| NFR9 | The team must maintain the project using Git and GitHub. | Must |
| NFR10 | Users must be able to access the application through a web browser. | Must |
| NFR11 | The application should use consistent typography, colours, and component styling. | Should |
| NFR12 | The application should minimise unnecessary user interactions and cognitive load. | Should |

## Data requirements

What information the system must store.

The application must follow the fixed data model from the PRD.

| ID | Entity | Required data |
| -- | ------ | ------------- |
| DR1 | Task identity | Unique ID, title, description |
| DR2 | Task classification | Type (`feature` or `bug`) |
| DR3 | Task status | `todo`, `in-progress`, `review`, `done` |
| DR4 | Task ownership | Assignee name |
| DR5 | Task dates | Due date, creation date |
| DR6 | AI context | Context text, AI tool, context update timestamp |
| DR7 | Deliverable | Anchor ID, label, URL |
| DR8 | Persistence | Store and retrieve task data using `localStorage` |

### Data constraints

- Every task must have a unique ID.
- Every task must have a non-empty title.
- Task types must be `feature` or `bug`.
- Task statuses must use one of the four predefined values.
- Assignees must match the three team members in PRD §8.
- Dates must use the specified ISO formats.
- Every task must contain all fields from the fixed `Task` model.
- Anchor IDs must be `presentation`, `demo`, `report`, or `documentation`.
- The system must preserve data after refreshing the browser.
- Deleting a task must remove its record from `localStorage`.

## 4. Primary user flow

1. Open the Webapp. The board loads from local storage.
2. Click "+" to add a task. Fill in title, type, assignee, due date, prompt context.
3. Move the task across columns as you work.
4. When stuck, click "Copy as Prompt Context" on a task and paste it into Claude/ChatGPT/Cursor to continue.
5. Hand off a task to a teammate with one dropdown.
6. Drop final deliverable links into the Anchor Board as you produce them.

## 5. Data model

Locked. Do not change without team agreement.

```js
// A single vibecoding task.
Task = {
  id: string,                    // uuid or timestamp string
  title: string,
  description: string,
  type: 'feature' | 'bug',       // visual color coding
  status: 'todo' | 'in-progress' | 'review' | 'done',
  assignee: string,              // one of the three teammate names from §8
  dueDate: string | null,        // ISO date 'YYYY-MM-DD'
  createdDate: string,           // ISO date 'YYYY-MM-DD'

  // Added in later milestones:
  context: string,               // M9 context — curated briefing for the next AI / teammate
  contextTool: string | null,    // M9 context — 'Claude' | 'ChatGPT' | 'Cursor' | 'Lovable' | 'Replit' | 'Other'
  contextUpdatedAt: string|null, // M9 context — ISO timestamp set automatically on save
}

// One of four pinned deliverable slots.
Anchor = {
  id: 'presentation' | 'demo' | 'report' | 'documentation',
  label: string,                 // human-readable
  url: string | null,            // the link the team pastes in
}
```

## 6. Tech stack

| Layer       | Choice                                          | Why                                                              |
| ----------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Framework   | React (via Vite)                                | What the scaffold ships with. Don't migrate.                     |
| Styling     | Tailwind                                        | Already configured. Use utility classes; no separate CSS files.  |
| State       | React `useState` + a `useLocalStorage` hook | Simple, no library needed.                                       |
| Persistence | **localStorage**                          | Zero infra. Pick this. Do not switch to a backend mid-hackathon. |
| Deploy      | Vercel                                          | One-click deploy from GitHub.                                    |

> **Decision:** localStorage, not a shared backend. If you want a shared backend later, that's M14 — out of scope for the hackathon.

## 7. Stage names

Four columns, in this order, with these exact labels in the UI:

1. **To Do**
2. **In Progress**
3. **Review**
4. **Done**

## 8. Team

Fill these in before tagging `prd-done`:

| Slot       | Name       | GitHub handle |
| ---------- | ---------- | ------------- |
| Teammate A | `<TODO>` | `<TODO>`    |
| Teammate B | `<TODO>` | `<TODO>`    |
| Teammate C | `<TODO>` | `<TODO>`    |

These three names become the **only** allowed values for `Task.assignee`. No auth — just a dropdown.

## 9. Milestone ownership

Fill in the owner column. Recommended default in **bold**; change if your team has different strengths.

| #  | Tag              | Title                             | Suggested owner   | Final owner |
| -- | ---------------- | --------------------------------- | ----------------- | ----------- |
| 3  | `design-done`  | Design system + voice (DESIGN.md) | **B**       | `<TODO>`  |
| 4  | `data-model`   | Task model + board view           | **A**       | `<TODO>`  |
| 5  | `crud-modal`   | Add / edit / delete modal         | **A**       | `<TODO>`  |
| 6  | `tag-style`    | Feature / bug colors              | **B**       | `<TODO>`  |
| 7  | `task-owner`   | Owner indicator + handoff         | **A**       | `<TODO>`  |
| 8  | `due-tint`     | Due-date color tinting            | **B**       | `<TODO>`  |
| 9  | `context`      | Context field on the task modal   | **C**       | `<TODO>`  |
| 10 | `copy-prompt`  | "Copy as Prompt Context" button   | **C**       | `<TODO>`  |
| 11 | `anchors`      | Deliverable Anchor Board          | **B**       | `<TODO>`  |
| 12 | `secret-sauce` | The one thing that makes it yours | **C / All** | `<TODO>`  |
| 13 | `pitch-ready`  | Demo + pitch rehearsal            | **All**     | `<TODO>`  |

Track A owns the state model and task ownership. Track B owns the visuals (and design — M3 runs parallel to M2 so the team starts Phase 3 with the palette already chosen). Track C owns the differentiator features (M9 + M10 — the context field and the Copy-as-Prompt button) and usually leads on M12 secret-sauce. Put your strongest prompter on Track C.

**Dependency note.** M3 (`design-done`) runs **in parallel with M2** — Person B drafts DESIGN.md and pastes the colors into `tailwind.config.js` while the rest of the team reviews the PRD. M6 / M7 / M8 / M11 all depend on M4 + M5 being done first. While Person A builds M4+M5 (first ~60 min of Phase 3), Person C should draft the Markdown template for the "Copy as Prompt Context" output (M10). M12 `secret-sauce` is open-ended — pick whatever makes the tracker uniquely yours; constraint is "must be visible in the demo and must not break anything else."

## 10. AI / vibe coding angle

Where AI will be heavily used:

- M4, M5: scaffold the board and the modal from a single prompt each.
- M9, M10: write the Markdown serialization helper for the Context field.
- M7: animation polish for the handoff toast.

Where AI will **not** save you time:

- M2 (this PRD review) — read it yourself.
- M3 (DESIGN.md) — design taste is yours, not the model's.
- M12 (secret-sauce) — the whole point is that AI can't predict it.
- M13 (pitch) — write the script in your own voice.

Keep the Context field of each real task up to date as you work. By the end of the hackathon you should have a handful of curated context blocks — those become part of your Module 5 "Vibe Coding History" deliverable.

## 11. Team identity

Fill in:

- **Team name:** `<TODO>`
- **Tagline (one sentence):** `<TODO>`
- **Tracker URL after deploy:** `<TODO>` (Vercel will give it to you)

## 12. Out of scope (do not build)

- Authentication / accounts.
- Real GitHub integration.
- A real backend / shared database.
- Native mobile apps or mobile-specific feature work.
- Multi-team support.
- Real-time collaboration.

## 13. Definition of done

The hackathon is "done" when all 13 milestone tags are pushed to your repo and visible on the dashboard. The pitch is "done" when:

- The board loads on Vercel without errors.
- The "Copy as Prompt Context" demo works on stage.
- 5 min pitch is rehearsed.

---

*PRD version: hackathon-starter v1 · maintained by Prof. Dr. Ignacio Alvarez*
