import { useEffect, useRef, useState } from 'react';
import { Bug, Sparkles, User } from 'lucide-react';
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
 * @property {string} context
 * @property {string|null} contextTool
 * @property {string|null} contextUpdatedAt
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

const TASK_FIELDS = [
  'id',
  'title',
  'description',
  'type',
  'status',
  'assignee',
  'dueDate',
  'createdDate',
  'context',
  'contextTool',
  'contextUpdatedAt',
];

const TASK_TYPE_DETAILS = {
  feature: {
    label: 'Feature',
    Icon: Sparkles,
    badgeClassName: 'border-type-feature/30 bg-type-feature/10 text-type-feature',
    stripeClassName: 'border-l-type-feature',
  },
  bug: {
    label: 'Bug',
    Icon: Bug,
    badgeClassName: 'border-type-bug/30 bg-type-bug/10 text-type-bug',
    stripeClassName: 'border-l-type-bug',
  },
};

function TaskTypeBadge({ type }) {
  const { label, Icon, badgeClassName } = TASK_TYPE_DETAILS[type];

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-medium ${badgeClassName}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      {label}
    </span>
  );
}

function AssigneeBadge({ assignee }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary">
      <User aria-hidden="true" size={14} strokeWidth={2} />
      <span className="truncate">{assignee}</span>
    </span>
  );
}

function formatDueDate(dueDate) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dueDate}T00:00:00Z`));
}

function getLocalDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTaskId(value) {
  return typeof value === 'string'
    && (/^\d+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function isValidTask(task) {
  if (!task || typeof task !== 'object') return false;

  const keys = Object.keys(task).sort();
  const fields = [...TASK_FIELDS].sort();

  return keys.length === fields.length
    && keys.every((key, index) => key === fields[index])
    && isTaskId(task.id)
    && typeof task.title === 'string'
    && typeof task.description === 'string'
    && ['feature', 'bug'].includes(task.type)
    && STAGES.some((stage) => stage.id === task.status)
    && TEAM.includes(task.assignee)
    && (task.dueDate === null || isIsoDate(task.dueDate))
    && isIsoDate(task.createdDate)
    && typeof task.context === 'string'
    && (task.contextTool === null || typeof task.contextTool === 'string')
    && (task.contextUpdatedAt === null || typeof task.contextUpdatedAt === 'string');
}

function createEmptyForm() {
  return {
    title: '',
    description: '',
    type: 'feature',
    status: 'todo',
    assignee: TEAM[0],
    dueDate: '',
  };
}

/**
 * A tiny localStorage hook — survives reloads, no library needed.
 *
 * Usage:
 *   const [tasks, setTasks] = useLocalStorage('vibetracker.tasks', []);
 */
export function useLocalStorage(key, initialValue, isValidValue = () => true) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;

      const parsed = JSON.parse(raw);
      return isValidValue(parsed) ? parsed : initialValue;
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
  const [tasks, setTasks] = useLocalStorage(
    'vibetracker.tasks',
    MOCK_TASKS,
    (value) => Array.isArray(value) && value.every(isValidTask),
  );
  const [editingTask, setEditingTask] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(createEmptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const titleInputRef = useRef(null);
  const assigneeSelectRef = useRef(null);
  const triggerRef = useRef(null);
  const isModalOpen = isCreating || editingTask !== null;

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeModal();
    };

    document.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => titleInputRef.current?.focus());

    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isModalOpen]);

  function closeModal() {
    setEditingTask(null);
    setIsCreating(false);
    setErrors({});
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openCreate(event) {
    triggerRef.current = event.currentTarget;
    setForm(createEmptyForm());
    setErrors({});
    setEditingTask(null);
    setIsCreating(true);
  }

  function openEdit(task, event) {
    triggerRef.current = event.currentTarget;
    setForm({
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      assignee: task.assignee,
      dueDate: task.dueDate ?? '',
    });
    setErrors({});
    setIsCreating(false);
    setEditingTask(task);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  }

  function saveTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setErrors({ title: 'Enter a task title.' });
      titleInputRef.current?.focus();
      return;
    }

    if (!TEAM.includes(form.assignee)) {
      setErrors({ assignee: 'Select a team member.' });
      assigneeSelectRef.current?.focus();
      return;
    }

    const editableFields = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      status: form.status,
      assignee: form.assignee,
      dueDate: form.dueDate || null,
    };

    if (editingTask) {
      setTasks((current) => current.map((task) => (
        task.id === editingTask.id ? { ...task, ...editableFields } : task
      )));
      setNotice(
        editingTask.assignee === form.assignee
          ? 'Task updated.'
          : `Assigned to ${form.assignee}.`,
      );
    } else {
      setTasks((current) => [
        ...current,
        {
          id: createTaskId(),
          ...editableFields,
          createdDate: getLocalDate(),
          context: '',
          contextTool: null,
          contextUpdatedAt: null,
        },
      ]);
      setNotice('Task created.');
    }

    closeModal();
  }

  function deleteTask() {
    if (!editingTask || !window.confirm('Delete this task? This action cannot be undone.')) {
      return;
    }

    setTasks((current) => current.filter((task) => task.id !== editingTask.id));
    setNotice('Task deleted.');
    closeModal();
  }

  return (
    <div className="min-h-screen bg-surface-page px-4 py-6 sm:px-6 lg:px-8">
      <header className="mx-auto mb-8 flex max-w-screen-2xl items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
            Vibecoding project tracker
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-primary">
            Anchor
          </h1>
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={openCreate}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card shadow-sm transition-colors hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
        >
          + New task
        </button>
      </header>

      {notice && (
        <p className="mx-auto mb-4 max-w-screen-2xl text-sm text-brand-primary" role="status">
          {notice}
        </p>
      )}

      {/* TODO M11 anchors: render the Anchor Board (Presentation / Demo / Report / Documentation) above the board. */}

      <main className="mx-auto max-w-screen-2xl" aria-label="Kanban board">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const stageTasks = tasks.filter((task) => task.status === stage.id);

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
                    <button
                      key={task.id}
                      type="button"
                      onClick={(event) => openEdit(task, event)}
                      aria-label={`Edit ${task.title}`}
                      className={`block w-full rounded-md border border-brand-primary/15 border-l-4 bg-surface-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${TASK_TYPE_DETAILS[task.type].stripeClassName}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium leading-5 text-text-primary">
                          {task.title}
                        </h3>
                        <TaskTypeBadge type={task.type} />
                      </div>
                      <p className="mt-2 text-sm leading-5 text-text-muted">
                        {task.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-brand-primary/10 pt-3 text-xs text-text-muted">
                        <AssigneeBadge assignee={task.assignee} />
                        <span className="shrink-0">
                          Due{' '}
                          <span className="font-medium text-text-primary">
                            {task.dueDate ? (
                              <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
                            ) : 'No due date'}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                  {stageTasks.length === 0 && (
                    <p className="rounded-md border border-dashed border-brand-primary/20 px-3 py-6 text-center text-sm text-text-muted">
                      No tasks in this stage.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-[640px] overflow-y-auto rounded-lg bg-surface-card p-6 shadow-xl"
          >
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                {editingTask ? 'Update task' : 'Create task'}
              </p>
              <h2 id="task-modal-title" className="mt-1 text-xl font-semibold text-text-primary">
                {editingTask ? 'Edit task' : 'New task'}
              </h2>
            </div>

            <form noValidate onSubmit={saveTask}>
              <fieldset className="space-y-4">
                <legend className="sr-only">Task details</legend>
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-text-primary">
                    Title <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={titleInputRef}
                    id="title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={updateForm}
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? 'title-error' : undefined}
                    className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                  {errors.title && (
                    <p id="title-error" className="mt-1.5 text-sm text-type-bug" role="alert">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-text-primary">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows="3"
                    value={form.description}
                    onChange={updateForm}
                    className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-text-primary">
                      Type
                    </label>
                    <select
                      id="type"
                      name="type"
                      value={form.type}
                      onChange={updateForm}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    >
                      <option value="feature">Feature</option>
                      <option value="bug">Bug</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-text-primary">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={updateForm}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    >
                      {STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>{stage.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="assignee" className="block text-sm font-medium text-text-primary">
                      {editingTask ? 'Hand off to...' : 'Assignee'}
                    </label>
                    {editingTask && (
                      <p id="assignee-help" className="mt-1 text-xs text-text-muted">
                        Currently assigned to {editingTask.assignee}.
                      </p>
                    )}
                    <select
                      ref={assigneeSelectRef}
                      id="assignee"
                      name="assignee"
                      value={form.assignee}
                      onChange={updateForm}
                      aria-invalid={Boolean(errors.assignee)}
                      aria-describedby={editingTask ? 'assignee-help' : undefined}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    >
                      {TEAM.map((member) => <option key={member} value={member}>{member}</option>)}
                    </select>
                    {errors.assignee && (
                      <p className="mt-1.5 text-sm text-type-bug" role="alert">
                        {errors.assignee}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium text-text-primary">
                      Due date <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      value={form.dueDate}
                      onChange={updateForm}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </div>
                </div>
              </fieldset>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand-primary/10 pt-4">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={deleteTask}
                    className="rounded-md px-3 py-2 text-sm font-medium text-type-bug hover:bg-type-bug/10 focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                  >
                    Delete
                  </button>
                ) : <span />}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border border-brand-primary/20 px-4 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                  >
                    {editingTask ? 'Save changes' : 'Create task'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
