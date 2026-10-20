import { useState, useEffect } from 'react';
import { MOCK_TASKS } from './mockTasks';

/**
 * Vibecoding Project Tracker — starter scaffold.
 *
 * This file is intentionally almost empty. The boilerplate (Vite, React,
 * Tailwind) is configured for you, plus a few shared constants and a
 * localStorage helper. Everything visible on screen, you build.
 *
 * Where to start (build sequence in Phase 3):
 *   - M4  data-model    : render the four columns and the task cards below.
 *   - M5  crud-modal    : add the "+" button modal and the edit-on-click modal.
 *   - M6  tag-style     : feature vs. bug color coding (uses DESIGN.md §2 colors).
 *   - M7  task-owner    : assignee badge + "Hand off to..." dropdown.
 *   - M8  due-tint      : color cards by due date (uses DESIGN.md §2 due-state colors).
 *   - M9  context       : a curated Context briefing field on the modal.
 *   - M10 copy-prompt   : a "Copy as Prompt Context" button that serializes the task + context.
 *   - M11 anchors       : the Anchor Board above the Kanban.
 *   - M12 secret-sauce  : the one open-ended thing that makes your tracker yours.
 *
 * Search the file for `TODO M<n>` to find the right hook for each milestone.
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {'feature'|'bug'} type
 * @property {'todo'|'in-progress'|'review'|'done'} status
 * @property {string} assignee
 * @property {string|null} dueDate     ISO 'YYYY-MM-DD'
 * @property {string} createdDate      ISO 'YYYY-MM-DD'
 */

// The four columns of the board, in render order.
// Use these IDs everywhere — do not invent new ones.
export const STAGES = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'In Review' },
  { id: 'done',        label: 'Done' },
];

// Replace these placeholders with the three names from PRD §8 before M4.
// They become the only valid values for `Task.assignee`.
export const TEAM = ['Teammate A', 'Teammate B', 'Teammate C'];

const TYPE_STYLES = {
  feature: 'border-type-feature text-type-feature',
  bug: 'border-type-bug text-type-bug',
};

function formatDueDate(dueDate) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dueDate}T00:00:00Z`));
}

/**
 * A tiny localStorage hook — survives reloads, no library needed.
 *
 * Usage:
 *   const [tasks, setTasks] = useLocalStorage('vibetracker.tasks', []);
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private-mode error — silently ignore for hackathon */
    }
  }, [key, value]);

  return [value, setValue];
}

export default function App() {
  // TODO M4 data-model:
  //   const [tasks, setTasks] = useLocalStorage('vibetracker.tasks', [/* 3-4 seed tasks */]);
  //
  // TODO M5 crud-modal:
  //   const [editing, setEditing] = useState(null);
  //
  // TODO M11 anchors:
  //   const [anchors, setAnchors] = useLocalStorage('vibetracker.anchors', [...]);

  return (
    <div className="min-h-screen bg-surface-page px-4 py-6 sm:px-6 lg:px-8">
      <header className="mx-auto mb-8 max-w-screen-2xl">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
            Vibecoding project tracker
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-primary">
            Anchor
          </h1>
        </div>
      </header>

      {/* TODO M11 anchors: render the Anchor Board (Presentation / Demo / Report / Documentation) above the board. */}

      <main className="mx-auto max-w-screen-2xl" aria-label="Kanban board">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const stageTasks = MOCK_TASKS.filter((task) => task.status === stage.id);

            return (
              <section
                key={stage.id}
                aria-labelledby={`${stage.id}-heading`}
                className="rounded-lg border border-brand-primary/15 bg-surface-card/50 p-4"
              >
                <header className="mb-4 flex items-center justify-between">
                  <h2
                    id={`${stage.id}-heading`}
                    className="text-sm font-semibold uppercase tracking-wide text-text-primary"
                  >
                    {stage.label}
                  </h2>
                  <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary">
                    {stageTasks.length} {stageTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </header>

                <div className="space-y-3">
                  {stageTasks.map((task) => (
                    <article
                      key={task.id}
                      className={`rounded-md border border-brand-primary/15 border-l-4 bg-surface-card p-4 shadow-sm ${
                        task.type === 'feature' ? 'border-l-type-feature' : 'border-l-type-bug'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium leading-5 text-text-primary">
                          {task.title}
                        </h3>
                        <span
                          className={`shrink-0 rounded border px-2 py-0.5 font-mono text-xs font-medium capitalize ${TYPE_STYLES[task.type]}`}
                        >
                          {task.type}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-text-muted">
                        {task.description}
                      </p>
                      <dl className="mt-4 space-y-1.5 border-t border-brand-primary/10 pt-3 text-xs text-text-muted">
                        <div className="flex justify-between gap-3">
                          <dt>Assigned to</dt>
                          <dd className="font-medium text-text-primary">{task.assignee}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Due</dt>
                          <dd className="font-medium text-text-primary">
                            <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
