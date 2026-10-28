import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  BookOpen,
  Copy,
  ChevronDown,
  ExternalLink,
  FileText,
  Flag,
  GripVertical,
  ListChecks,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import {
  DEFAULT_ANCHORS,
  isValidAnchors,
  isValidDeliverableUrl,
} from './anchors';
import { getDeadlineState } from './deadline';
import { MOCK_TASKS } from './mockTasks';
import { formatTaskPrompt } from './prompt';
import { moveFilteredTask, moveTask } from './taskOrder';

const StatusPieChart = lazy(() => import('./StatusPieChart'));

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

export const TEAM = ['Teammate A', 'Teammate B', 'Teammate C'];
const UNASSIGNED = 'Unassigned';
const DEFAULT_PROJECT = { name: 'Anchor', team: TEAM };
const DEFAULT_MEMBERS = [
  { id: 'member-a', name: 'Teammate A', email: 'alex@anchor.local', role: 'Admin', avatar: '/member-a-sm.png' },
  { id: 'member-b', name: 'Teammate B', email: 'jamie@anchor.local', role: 'Member', avatar: '/member-b-sm.png' },
  { id: 'member-c', name: 'Teammate C', email: 'riley@anchor.local', role: 'Member', avatar: '/member-c-sm.png' },
];
const DEFAULT_WORKSPACE_TEAMS = [
  { id: 'product', name: 'Product' },
  { id: 'design', name: 'Design' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'operations', name: 'Operations' },
];
const EMPTY_WIP_LIMITS = Object.fromEntries(STAGES.map((stage) => [stage.id, null]));
const EMPTY_BOARD = {
  id: '',
  name: '',
  teamId: '',
  members: [],
  tasks: [],
  anchors: [],
  subtasks: {},
  deliverableTasks: {},
  taskPriorities: {},
  taskComments: {},
  archivedTaskIds: [],
  blockedTaskIds: [],
  activity: [],
  wipLimits: EMPTY_WIP_LIMITS,
};
const PRIORITY_DETAILS = {
  low: { label: 'Low', className: 'border-due-neutral/30 bg-due-neutral/10 text-due-neutral' },
  medium: { label: 'Medium', className: 'border-due-warning/30 bg-due-warning/10 text-due-warning' },
  high: { label: 'High', className: 'border-type-bug/30 bg-type-bug/10 text-type-bug' },
};
const BOARD_TEMPLATES = {
  empty: { label: 'Empty board', tasks: [] },
  product: {
    label: 'Product starter',
    tasks: [
      ['Define problem', 'Capture the user need and desired outcome.', 'feature', 'todo'],
      ['Write the brief', 'Agree scope, success measures, and next steps.', 'feature', 'in-progress'],
      ['Review launch plan', 'Confirm the work is ready to ship.', 'feature', 'review'],
    ],
  },
  design: {
    label: 'Design starter',
    tasks: [
      ['Collect references', 'Gather examples and constraints.', 'feature', 'todo'],
      ['Create first pass', 'Produce the core design direction.', 'feature', 'in-progress'],
      ['Prepare handoff', 'Package the approved design for build.', 'feature', 'review'],
    ],
  },
  engineering: {
    label: 'Engineering starter',
    tasks: [
      ['Plan implementation', 'Identify the approach and technical risks.', 'feature', 'todo'],
      ['Build the change', 'Implement the agreed solution.', 'feature', 'in-progress'],
      ['Test and review', 'Verify behaviour before release.', 'bug', 'review'],
    ],
  },
};

const AI_TOOLS = ['Claude', 'ChatGPT', 'Cursor', 'Lovable', 'Replit', 'Other'];

const CONTEXT_PLACEHOLDER = `Goal:
What are you trying to achieve?

Current implementation:
What has already been completed?

Technical context:
Relevant technologies, files, and dependencies.

Important decisions:
What decisions have been made and why?

Next steps:
What should the AI assistant or next developer do?

Constraints:
What must remain unchanged?`;

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

function isValidSubtasksByTask(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Object.values(value).every((subtasks) => Array.isArray(subtasks) && subtasks.every((subtask) => (
    subtask
    && typeof subtask === 'object'
    && typeof subtask.id === 'string'
    && typeof subtask.title === 'string'
    && typeof subtask.completed === 'boolean'
  )));
}

function isValidDeliverableTasks(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value).every((taskIds) => (
      Array.isArray(taskIds) && taskIds.every((taskId) => typeof taskId === 'string')
    ));
}

function isValidTaskPriorities(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value).every((priority) => ['low', 'medium', 'high'].includes(priority));
}

function isValidTaskComments(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value).every((comments) => Array.isArray(comments) && comments.every((comment) => (
      comment
      && typeof comment.id === 'string'
      && typeof comment.body === 'string'
      && typeof comment.timestamp === 'string'
      && (comment.authorId === undefined || typeof comment.authorId === 'string')
      && (comment.authorName === undefined || typeof comment.authorName === 'string')
    )));
}

function isValidArchivedTaskIds(value) {
  return Array.isArray(value) && value.every((taskId) => typeof taskId === 'string');
}

function isValidBlockedTaskIds(value) {
  return Array.isArray(value) && value.every((taskId) => typeof taskId === 'string');
}

function isValidProject(value) {
  return value
    && typeof value === 'object'
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && Array.isArray(value.team)
    && value.team.every((member) => typeof member === 'string' && member.trim().length > 0);
}

function isValidMembers(value) {
  return Array.isArray(value) && value.length > 0 && value.every((member) => (
    member
    && typeof member.id === 'string'
    && typeof member.name === 'string'
    && member.name.trim().length > 0
    && typeof member.email === 'string'
    && typeof member.role === 'string'
    && typeof member.avatar === 'string'
  ));
}

function isValidWorkspaceTeams(value) {
  return Array.isArray(value) && value.every((team) => (
    team
    && typeof team.id === 'string'
    && typeof team.name === 'string'
    && team.name.trim().length > 0
    && (team.memberIds === undefined || (Array.isArray(team.memberIds) && team.memberIds.every((id) => typeof id === 'string')))
  ));
}

function isValidBoards(value) {
  return Array.isArray(value) && value.every((board) => (
    board
    && typeof board.id === 'string'
    && typeof board.name === 'string'
    && board.name.trim().length > 0
    && typeof board.teamId === 'string'
    && (board.members === undefined || (Array.isArray(board.members) && board.members.every((member) => (
      typeof member === 'string' && member.trim().length > 0
    ))))
    && Array.isArray(board.tasks)
    && board.tasks.every(isValidTask)
    && isValidAnchors(board.anchors)
    && isValidSubtasksByTask(board.subtasks)
    && (board.deliverableTasks === undefined || isValidDeliverableTasks(board.deliverableTasks))
    && (board.taskPriorities === undefined || isValidTaskPriorities(board.taskPriorities))
    && (board.taskComments === undefined || isValidTaskComments(board.taskComments))
    && (board.archivedTaskIds === undefined || isValidArchivedTaskIds(board.archivedTaskIds))
    && (board.blockedTaskIds === undefined || isValidBlockedTaskIds(board.blockedTaskIds))
    && (board.activity === undefined || (Array.isArray(board.activity) && board.activity.every((entry) => (
      entry && typeof entry.id === 'string' && typeof entry.message === 'string' && typeof entry.timestamp === 'string'
    ))))
    && (board.wipLimits === undefined || (board.wipLimits && typeof board.wipLimits === 'object' && STAGES.every((stage) => (
      board.wipLimits[stage.id] === null || Number.isInteger(board.wipLimits[stage.id])
    ))))
  ));
}

const TASK_TYPE_DETAILS = {
  feature: {
    label: 'Feature',
    iconPath: '/feature-icon-sm.png',
    badgeClassName: 'border-type-feature/30 bg-type-feature/10 text-type-feature',
    stripeClassName: 'border-l-type-feature',
  },
  bug: {
    label: 'Bug',
    iconPath: '/bug-icon-sm.png',
    badgeClassName: 'border-type-bug/30 bg-type-bug/10 text-type-bug',
    stripeClassName: 'border-l-type-bug',
  },
};

const DEADLINE_DETAILS = {
  safe: {
    label: 'Due later',
    cardClassName: 'border-due-safe/40 bg-due-safe/5',
    badgeClassName: 'border-due-safe/30 bg-due-safe/10 text-due-safe',
  },
  warning: {
    label: 'Due soon',
    cardClassName: 'border-due-warning/40 bg-due-warning/10',
    badgeClassName: 'border-due-warning/30 bg-due-warning/10 text-due-warning',
  },
  overdue: {
    label: 'Overdue',
    cardClassName: 'border-due-overdue/40 bg-due-overdue/5',
    badgeClassName: 'border-due-overdue/30 bg-due-overdue/10 text-due-overdue',
  },
  neutral: {
    label: null,
    cardClassName: '',
    badgeClassName: '',
  },
};

const ANCHOR_DETAILS = {
  presentation: Presentation,
  demo: Monitor,
  report: FileText,
  documentation: BookOpen,
};

function TaskTypeBadge({ type }) {
  const { label, iconPath, badgeClassName } = TASK_TYPE_DETAILS[type];

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-xs font-medium ${badgeClassName}`}>
      <img src={iconPath} alt="" className="size-3.5 object-contain" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  if (!priority) return null;

  const details = PRIORITY_DETAILS[priority];

  return (
    <span className={`inline-flex shrink-0 rounded-sm border px-2 py-0.5 text-xs font-medium ${details.className}`}>
      {details.label}
    </span>
  );
}

function MemberAvatar({ member, size = 'size-6' }) {
  if (!member) return <span className={`${size} shrink-0 rounded-full bg-brand-primary/15`} aria-hidden="true" />;

  return member.avatar ? (
    <img src={member.avatar} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-brand-primary text-[10px] font-semibold text-surface-card`} aria-hidden="true">
      {member.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function AccessScreen({ members, mode, onModeChange, onSelectUser, onCreateUser, signupError, signupName, onSignupNameChange }) {
  const isSignup = mode === 'signup';

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-8 text-text-primary">
      <main className="w-full max-w-md rounded-md border border-brand-primary/15 bg-surface-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/anchor-logo-sm.png" alt="" className="size-12 object-contain" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Anchor</p>
              <span className="rounded-sm border border-due-warning/30 bg-due-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-due-warning">Dev</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{isSignup ? 'Create profile' : 'Login'}</h1>
          </div>
        </div>

        {isSignup ? (
          <form className="mt-8" onSubmit={onCreateUser}>
            <label htmlFor="signup-name" className="block text-sm font-medium">Your name</label>
            <input
              id="signup-name"
              value={signupName}
              onChange={(event) => onSignupNameChange(event.target.value)}
              placeholder="e.g. Taylor Morgan"
              className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              autoFocus
            />
            {signupError && <p className="mt-2 text-sm text-type-bug">{signupError}</p>}
            <button type="submit" className="mt-5 w-full rounded-sm bg-brand-primary px-4 py-2.5 text-sm font-medium text-surface-card hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page">
              Create profile
            </button>
            <button type="button" onClick={() => onModeChange('login')} className="mt-3 w-full rounded-sm px-4 py-2 text-sm font-medium text-text-muted hover:bg-brand-primary/5 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
              Back to login
            </button>
          </form>
        ) : (
          <>
            <p className="mt-7 text-sm text-text-muted">Demo credentials are shown for presentation purposes. Choose a profile below to enter the workspace.</p>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="text-sm font-medium">Username</span>
                <input
                  type="text"
                  placeholder="demo@anchor.local"
                  autoComplete="username"
                  className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </label>
              <label>
                <span className="text-sm font-medium">Password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </label>
            </div>
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Choose a demo profile</p>
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelectUser(member)}
                  className="flex w-full items-center gap-3 rounded-sm border border-brand-primary/15 px-3 py-3 text-left transition-colors hover:border-brand-primary/35 hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                >
                  <MemberAvatar member={member} size="size-9" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                  <span className="text-xs text-text-muted">{member.role}</span>
                </button>
              ))}
            </div>
            {members.length < 4 && (
              <button type="button" onClick={() => onModeChange('signup')} className="mt-5 w-full rounded-sm border border-dashed border-brand-primary/30 px-4 py-2.5 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                + Add a user
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AssigneeBadge({ assignee, assignees, members, isOpen, onToggle, onAssign }) {
  const isUnassigned = assignee === UNASSIGNED;
  const member = members.find((item) => item.name === assignee);

  return (
    <span data-assignee-picker className="relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        title={isUnassigned ? 'Assign task' : `Assigned to ${assignee}`}
        aria-label={isUnassigned ? 'Assign task' : `Change assignee, currently ${assignee}`}
        aria-expanded={isOpen}
        className={`flex size-7 items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
          isUnassigned
            ? 'border-dashed border-brand-primary/35 text-text-muted hover:bg-brand-primary/10'
            : 'border-brand-primary/25 hover:ring-2 hover:ring-brand-primary/20'
        }`}
      >
        {isUnassigned ? <span aria-hidden="true" className="text-base leading-none">+</span> : <MemberAvatar member={member} size="size-6" />}
      </button>
      {isOpen && (
        <span onClick={(event) => event.stopPropagation()} className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 w-48 rounded-sm border border-brand-primary/20 bg-surface-card p-2 text-left shadow-lg">
          <span className="mb-1 block px-2 pt-1 text-xs font-medium uppercase tracking-wide text-text-muted">Assign task</span>
          {assignees.map((name) => {
            const optionMember = members.find((item) => item.name === name);
            const selected = name === assignee;

            return (
              <button
                key={name}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAssign(name);
                }}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-brand-primary/10 ${selected ? 'bg-brand-primary/10 text-text-primary' : 'text-text-muted'}`}
              >
                {name === UNASSIGNED ? <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-brand-primary/35 text-xs">+</span> : <MemberAvatar member={optionMember} size="size-5" />}
                <span className="truncate">{name}</span>
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}

function DeadlineIndicator({ state }) {
  const { label, badgeClassName } = DEADLINE_DETAILS[state];

  if (!label) return null;

  return (
    <span className={`shrink-0 rounded-sm border px-2 py-0.5 text-xs font-medium ${badgeClassName}`}>
      {label}
    </span>
  );
}

function TaskCount({ count }) {
  return (
    <span className="rounded-sm border border-brand-primary/20 px-2 py-0.5 text-xs font-medium text-brand-primary">
      <span key={count} className="inline-block animate-task-count motion-reduce:animate-none">
        {count} {count === 1 ? 'task' : 'tasks'}
      </span>
    </span>
  );
}

function SubtaskProgress({ subtasks }) {
  if (subtasks.length === 0) return null;

  const completed = subtasks.filter((subtask) => subtask.completed).length;

  return (
    <div className="mt-4" aria-label={`${completed} of ${subtasks.length} subtasks complete`}>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <ListChecks aria-hidden="true" size={14} strokeWidth={2} />
          Subtasks
        </span>
        <span>{completed}/{subtasks.length}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-primary/10">
        <div
          className="h-full rounded-full bg-brand-primary transition-[width] duration-200"
          style={{ width: `${(completed / subtasks.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function BoardColumn({ children, className = '', provided, snapshot, stage }) {
  return (
    <section
      ref={provided.innerRef}
      {...provided.droppableProps}
      aria-labelledby={`${stage.id}-heading`}
      className={`rounded-sm border p-4 transition-colors duration-200 motion-reduce:transition-none sm:p-5 ${
        snapshot.isDraggingOver
          ? 'border-brand-primary/40 bg-brand-primary/5'
          : 'border-brand-primary/15 bg-surface-card/50'
      } ${className}`}
    >
      {children}
    </section>
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

function getCalendarDays(month) {
  const firstDay = new Date(`${month}-01T00:00:00Z`);
  const start = new Date(firstDay);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

function shiftCalendarMonth(month, amount) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

function formatCalendarMonth(month) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

function formatContextUpdatedAt(timestamp) {
  if (!timestamp) return 'Not yet saved';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getLocalDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function createTemplateTasks(template, members) {
  const assignee = members[0] ?? UNASSIGNED;

  return BOARD_TEMPLATES[template].tasks.map(([title, description, type, status]) => ({
    id: createTaskId(),
    title,
    description,
    type,
    status,
    assignee,
    dueDate: null,
    createdDate: getLocalDate(),
    context: '',
    contextTool: null,
    contextUpdatedAt: null,
  }));
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function createTeamId(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'team';

  return `${base}-${createTaskId().slice(0, 8)}`;
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
    && typeof task.assignee === 'string'
    && task.assignee.trim().length > 0
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
    assignee: UNASSIGNED,
    dueDate: '',
    deliverableId: '',
    priority: 'medium',
    isBlocked: false,
    context: '',
    contextTool: '',
    subtasks: [],
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
  const [legacyTasks] = useLocalStorage(
    'vibetracker.tasks',
    MOCK_TASKS,
    (value) => Array.isArray(value) && value.every(isValidTask),
  );
  const [legacyAnchors] = useLocalStorage(
    'vibetracker.anchors',
    DEFAULT_ANCHORS,
    isValidAnchors,
  );
  // Kept separately so the fixed Task schema remains compatible with saved boards.
  const [legacySubtasks] = useLocalStorage(
    'vibetracker.subtasks',
    {},
    isValidSubtasksByTask,
  );
  const [teams, setTeams] = useLocalStorage(
    'vibetracker.workspace-teams',
    DEFAULT_WORKSPACE_TEAMS,
    isValidWorkspaceTeams,
  );
  const [boards, setBoards] = useLocalStorage(
    'vibetracker.boards',
    [],
    isValidBoards,
  );
  const [activeBoardId, setActiveBoardId] = useLocalStorage(
    'vibetracker.active-board',
    'board-main',
    (value) => typeof value === 'string',
  );
  const [theme, setTheme] = useLocalStorage(
    'vibetracker.theme',
    'light',
    (value) => value === 'light' || value === 'dark',
  );
  const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage(
    'vibetracker.sidebar-open',
    true,
    (value) => typeof value === 'boolean',
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [project, setProject] = useLocalStorage(
    'vibetracker.project',
    DEFAULT_PROJECT,
    isValidProject,
  );
  const [members, setMembers] = useLocalStorage(
    'vibetracker.members',
    DEFAULT_MEMBERS,
    isValidMembers,
  );
  const [currentUserId, setCurrentUserId] = useLocalStorage(
    'vibetracker.current-user',
    DEFAULT_MEMBERS[0].id,
    (value) => typeof value === 'string',
  );
  const [signedInUserId, setSignedInUserId] = useLocalStorage(
    'vibetracker.signed-in-user',
    '',
    (value) => typeof value === 'string',
  );
  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? EMPTY_BOARD;
  const tasks = activeBoard.tasks;
  const anchors = activeBoard.anchors;
  const subtasksByTask = activeBoard.subtasks;
  const deliverableTasks = activeBoard.deliverableTasks ?? {};
  const taskPriorities = activeBoard.taskPriorities ?? {};
  const taskComments = activeBoard.taskComments ?? {};
  const archivedTaskIds = activeBoard.archivedTaskIds ?? [];
  const blockedTaskIds = activeBoard.blockedTaskIds ?? [];
  const activeTasks = tasks.filter((task) => !archivedTaskIds.includes(task.id));
  const archivedTasks = tasks.filter((task) => archivedTaskIds.includes(task.id));
  const [editingTask, setEditingTask] = useState(null);
  const [editingAnchorId, setEditingAnchorId] = useState(null);
  const [isCreatingAnchor, setIsCreatingAnchor] = useState(false);
  const [confirmingAnchorDeleteId, setConfirmingAnchorDeleteId] = useState(null);
  const [anchorUrl, setAnchorUrl] = useState('');
  const [anchorLabel, setAnchorLabel] = useState('');
  const [anchorError, setAnchorError] = useState('');
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [isConfirmingBoardDelete, setIsConfirmingBoardDelete] = useState(false);
  const [boardForm, setBoardForm] = useState({ name: '', teamId: 'product', members: [], wipLimits: EMPTY_WIP_LIMITS, template: 'empty' });
  const [boardError, setBoardError] = useState('');
  const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT);
  const [teamMemberDraft, setTeamMemberDraft] = useState('');
  const [teamForm, setTeamForm] = useState([]);
  const [teamSectionDraft, setTeamSectionDraft] = useState('');
  const [teamSectionError, setTeamSectionError] = useState('');
  const [projectError, setProjectError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirmingTaskDelete, setIsConfirmingTaskDelete] = useState(false);
  const [form, setForm] = useState(createEmptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [undoState, setUndoState] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('board');
  const [calendarMonth, setCalendarMonth] = useState(() => getLocalDate().slice(0, 7));
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentEditDraft, setCommentEditDraft] = useState('');
  const [confirmingCommentDeleteId, setConfirmingCommentDeleteId] = useState(null);
  const [assigneeMenuTaskId, setAssigneeMenuTaskId] = useState(null);
  const [isCopying, setIsCopying] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isOverviewVisible, setIsOverviewVisible] = useState(false);
  const [accessMode, setAccessMode] = useState('login');
  const [signupName, setSignupName] = useState('');
  const [signupError, setSignupError] = useState('');
  const titleInputRef = useRef(null);
  const taskSearchInputRef = useRef(null);
  const assigneeSelectRef = useRef(null);
  const anchorUrlInputRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const teamSectionInputRef = useRef(null);
  const teamSettingsHeadingRef = useRef(null);
  const boardNameInputRef = useRef(null);
  const filterDetailsRef = useRef(null);
  const userProfileRef = useRef(null);
  const triggerRef = useRef(null);
  const boardOverviewRef = useRef(null);
  const isModalOpen = isCreating || editingTask !== null;
  const isDark = theme === 'dark';
  const assignees = [UNASSIGNED, ...(activeBoard.members ?? project.team)];
  const currentUser = members.find((member) => member.id === currentUserId) ?? members[0];
  const activity = activeBoard.activity ?? [];
  const workspaceMemberNames = [...new Set([...project.team, ...members.map((member) => member.name)])];

  function memberNamesForTeam(teamId) {
    const team = teams.find((item) => item.id === teamId);
    const teamMembers = members.filter((member) => team?.memberIds?.includes(member.id));

    return teamMembers.length > 0 ? teamMembers.map((member) => member.name) : workspaceMemberNames;
  }

  function updateActiveBoard(field, value) {
    if (!activeBoard.id) return;

    setBoards((current) => current.map((board) => {
      if (board.id !== activeBoard.id) return board;

      return {
        ...board,
        [field]: typeof value === 'function' ? value(board[field]) : value,
      };
    }));
  }

  function setTasks(value) {
    updateActiveBoard('tasks', value);
  }

  function setAnchors(value) {
    updateActiveBoard('anchors', value);
  }

  function setSubtasksByTask(value) {
    updateActiveBoard('subtasks', value);
  }

  function setDeliverableTasks(value) {
    updateActiveBoard('deliverableTasks', value);
  }

  function setTaskPriorities(value) {
    updateActiveBoard('taskPriorities', value);
  }

  function setTaskComments(value) {
    updateActiveBoard('taskComments', value);
  }

  function setArchivedTaskIds(value) {
    updateActiveBoard('archivedTaskIds', value);
  }

  function setBlockedTaskIds(value) {
    updateActiveBoard('blockedTaskIds', value);
  }

  function assignTaskFromCard(task, assignee) {
    if (task.assignee === assignee) {
      setAssigneeMenuTaskId(null);
      return;
    }

    setTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, assignee } : item
    )));
    logActivity(`Assigned “${task.title}” to ${assignee}.`);
    setNotice(assignee === UNASSIGNED ? 'Task unassigned.' : `Assigned to ${assignee}.`);
    setAssigneeMenuTaskId(null);
  }

  function getTaskDeliverableId(taskId) {
    return Object.entries(deliverableTasks).find(([, taskIds]) => taskIds.includes(taskId))?.[0] ?? '';
  }

  function assignTaskToDeliverable(taskId, deliverableId) {
    setDeliverableTasks((current = {}) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([anchorId, taskIds]) => [
          anchorId,
          taskIds.filter((id) => id !== taskId),
        ]),
      );

      if (!deliverableId) return next;

      return {
        ...next,
        [deliverableId]: [...(next[deliverableId] ?? []), taskId],
      };
    });
  }

  function archiveTask(task) {
    if (task.status !== 'done') return;

    setArchivedTaskIds((current = []) => [...new Set([...current, task.id])]);
    logActivity(`Archived “${task.title}”.`);
    setNotice('Completed task archived.');
    closeModal();
  }

  function restoreTask(task) {
    setArchivedTaskIds((current = []) => current.filter((taskId) => taskId !== task.id));
    logActivity(`Restored “${task.title}”.`);
    setNotice('Task restored to the board.');
    closeModal();
  }

  function addComment() {
    const body = commentDraft.trim();
    if (!editingTask || !body) return;

    setTaskComments((current = {}) => ({
      ...current,
      [editingTask.id]: [
        {
          id: createTaskId(),
          body,
          timestamp: new Date().toISOString(),
          authorId: currentUser?.id,
          authorName: currentUser?.name,
        },
        ...(current[editingTask.id] ?? []),
      ],
    }));
    logActivity(`Commented on “${editingTask.title}”.`);
    setCommentDraft('');
  }

  function startCommentEdit(comment) {
    setEditingCommentId(comment.id);
    setCommentEditDraft(comment.body);
    setConfirmingCommentDeleteId(null);
  }

  function saveCommentEdit(comment) {
    const body = commentEditDraft.trim();
    if (!editingTask || !body) return;

    setTaskComments((current = {}) => ({
      ...current,
      [editingTask.id]: (current[editingTask.id] ?? []).map((item) => (
        item.id === comment.id ? { ...item, body } : item
      )),
    }));
    logActivity(`Edited a comment on “${editingTask.title}”.`);
    setNotice('Comment updated.');
    setEditingCommentId(null);
    setCommentEditDraft('');
  }

  function deleteComment(comment) {
    if (!editingTask) return;

    setTaskComments((current = {}) => ({
      ...current,
      [editingTask.id]: (current[editingTask.id] ?? []).filter((item) => item.id !== comment.id),
    }));
    logActivity(`Deleted a comment on “${editingTask.title}”.`);
    setNotice('Comment deleted.');
    setConfirmingCommentDeleteId(null);
  }

  function logActivity(message) {
    const actor = currentUser?.name ?? 'Someone';
    updateActiveBoard('activity', (current = []) => ([
      { id: createTaskId(), message: `${actor} ${message.charAt(0).toLowerCase()}${message.slice(1)}`, timestamp: new Date().toISOString() },
      ...current,
    ].slice(0, 30)));
  }

  function stageLabel(status) {
    return STAGES.find((stage) => stage.id === status)?.label ?? 'another stage';
  }

  function deliverableLabel(deliverableId) {
    return anchors.find((anchor) => anchor.id === deliverableId)?.label ?? 'a deliverable';
  }

  function describeTaskChanges(task, nextFields, details) {
    const taskTitle = `“${nextFields.title}”`;
    const changes = [];

    if (task.title !== nextFields.title) changes.push(`renamed “${task.title}” to ${taskTitle}`);
    if (task.status !== nextFields.status) changes.push(`moved ${taskTitle} from ${stageLabel(task.status)} to ${stageLabel(nextFields.status)}`);
    if (task.assignee !== nextFields.assignee) changes.push(`assigned ${taskTitle} to ${nextFields.assignee}`);
    if (task.type !== nextFields.type) changes.push(`changed ${taskTitle} to a ${nextFields.type}`);
    if (task.dueDate !== nextFields.dueDate) {
      changes.push(nextFields.dueDate
        ? `set ${taskTitle} due ${formatDueDate(nextFields.dueDate)}`
        : `removed the due date from ${taskTitle}`);
    }
    if ((taskPriorities[task.id] ?? 'medium') !== details.priority) changes.push(`set ${taskTitle} priority to ${details.priority}`);
    if (blockedTaskIds.includes(task.id) !== details.isBlocked) changes.push(`${details.isBlocked ? 'blocked' : 'unblocked'} ${taskTitle}`);
    if (getTaskDeliverableId(task.id) !== details.deliverableId) {
      changes.push(details.deliverableId
        ? `linked ${taskTitle} to ${deliverableLabel(details.deliverableId)}`
        : `unlinked ${taskTitle} from its deliverable`);
    }
    if (task.description !== nextFields.description) changes.push(`updated the description for ${taskTitle}`);
    if (details.contextChanged) changes.push(`updated the context for ${taskTitle}`);
    if (JSON.stringify(subtasksByTask[task.id] ?? []) !== JSON.stringify(details.subtasks)) changes.push(`updated subtasks for ${taskTitle}`);

    return changes.length > 0 ? changes.join(' · ') : `reviewed ${taskTitle} with no changes`;
  }

  function selectCurrentUser(member) {
    setCurrentUserId(member.id);
    setSignedInUserId(member.id);
    userProfileRef.current?.removeAttribute('open');
    setNotice(`You are now ${member.name}.`);
  }

  function signIn(member) {
    setCurrentUserId(member.id);
    setSignedInUserId(member.id);
    setAccessMode('login');
  }

  function createUser(event) {
    event.preventDefault();
    const name = signupName.trim();

    if (!name) {
      setSignupError('Enter a name to create a profile.');
      return;
    }
    if (members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
      setSignupError('That profile already exists.');
      return;
    }
    if (members.length >= 4) {
      setSignupError('This prototype supports up to four profiles.');
      return;
    }

    const member = {
      id: `member-${createTaskId()}`,
      name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'user'}@anchor.local`,
      role: 'Member',
      avatar: '',
    };

    setMembers((current) => [...current, member]);
    setSignupName('');
    setSignupError('');
    signIn(member);
  }

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setIsMobileSidebarOpen((current) => !current);
    } else {
      setIsSidebarOpen((current) => !current);
    }
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const migrationKey = 'vibetracker.workspace-teams-expanded';

    try {
      if (window.localStorage.getItem(migrationKey)) return;

      setTeams((current) => {
        const existingIds = new Set(current.map((team) => team.id));
        return [
          ...current,
          ...DEFAULT_WORKSPACE_TEAMS.filter((team) => !existingIds.has(team.id)),
        ];
      });
      window.localStorage.setItem(migrationKey, 'true');
    } catch {}
  }, [setTeams]);

  useEffect(() => {
    if (!isModalOpen && !isProjectSettingsOpen && !isTeamSettingsOpen && !isCreateBoardOpen && !isConfirmingTaskDelete) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        if (isConfirmingTaskDelete) setIsConfirmingTaskDelete(false);
        else if (isCreateBoardOpen) closeBoardCreator();
        else if (isTeamSettingsOpen) closeTeamSettings();
        else if (isProjectSettingsOpen) closeProjectSettings();
        else closeModal();
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => {
      if (isConfirmingTaskDelete) return;
      if (isCreateBoardOpen) boardNameInputRef.current?.focus();
      else if (isTeamSettingsOpen) teamSettingsHeadingRef.current?.focus();
      else if (isProjectSettingsOpen) projectNameInputRef.current?.focus();
      else titleInputRef.current?.focus();
    });

    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isModalOpen, isProjectSettingsOpen, isTeamSettingsOpen, isCreateBoardOpen, isConfirmingTaskDelete]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (activeWorkspaceTab !== 'board' || isOverviewVisible || !boardOverviewRef.current) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsOverviewVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });

    observer.observe(boardOverviewRef.current);
    return () => observer.disconnect();
  }, [activeWorkspaceTab, isOverviewVisible]);

  useEffect(() => {
    if (editingAnchorId) {
      window.requestAnimationFrame(() => anchorUrlInputRef.current?.focus());
    }
  }, [editingAnchorId]);

  useEffect(() => {
    if (!notice) return undefined;

    const timeoutId = window.setTimeout(() => {
      setNotice('');
      setUndoState(null);
    }, undoState ? 5000 : 2500);

    return () => window.clearTimeout(timeoutId);
  }, [notice, undoState]);

  useEffect(() => {
    const closeFilterOnOutsideClick = (event) => {
      const filterDetails = filterDetailsRef.current;
      if (filterDetails?.open && !filterDetails.contains(event.target)) {
        filterDetails.open = false;
      }
    };

    document.addEventListener('pointerdown', closeFilterOnOutsideClick, true);
    return () => document.removeEventListener('pointerdown', closeFilterOnOutsideClick, true);
  }, []);

  useEffect(() => {
    const closeAssigneePickerOnOutsideClick = (event) => {
      if (!event.target.closest('[data-assignee-picker]')) setAssigneeMenuTaskId(null);
    };

    document.addEventListener('pointerdown', closeAssigneePickerOnOutsideClick, true);
    return () => document.removeEventListener('pointerdown', closeAssigneePickerOnOutsideClick, true);
  }, []);

  useEffect(() => {
    const closeProfileOnOutsideClick = (event) => {
      const profileDetails = userProfileRef.current;
      if (profileDetails?.open && !profileDetails.contains(event.target)) profileDetails.open = false;
    };

    document.addEventListener('pointerdown', closeProfileOnOutsideClick, true);
    return () => document.removeEventListener('pointerdown', closeProfileOnOutsideClick, true);
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (isModalOpen || isProjectSettingsOpen || isTeamSettingsOpen || isCreateBoardOpen) return;

      if (event.key === '/') {
        event.preventDefault();
        setActiveWorkspaceTab('board');
        window.requestAnimationFrame(() => taskSearchInputRef.current?.focus());
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openCreate();
      } else if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [isModalOpen, isProjectSettingsOpen, isTeamSettingsOpen, isCreateBoardOpen]);

  function closeModal() {
    setEditingTask(null);
    setIsCreating(false);
    setIsConfirmingTaskDelete(false);
    setEditingCommentId(null);
    setCommentEditDraft('');
    setConfirmingCommentDeleteId(null);
    setErrors({});
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openProjectSettings(event) {
    triggerRef.current = event.currentTarget;
    setProjectForm({ name: project.name, team: [...project.team] });
    setTeamMemberDraft('');
    setProjectError('');
    setIsProjectSettingsOpen(true);
  }

  function closeProjectSettings() {
    setIsProjectSettingsOpen(false);
    setProjectError('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openTeamSettings(event) {
    triggerRef.current = event.currentTarget;
    setTeamForm(teams.map((team) => ({ ...team })));
    setTeamSectionDraft('');
    setTeamSectionError('');
    setIsTeamSettingsOpen(true);
  }

  function closeTeamSettings() {
    setIsTeamSettingsOpen(false);
    setTeamSectionError('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function addTeamSection(event) {
    event.preventDefault();
    const name = teamSectionDraft.trim();

    if (!name) return;
    if (teamForm.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      setTeamSectionError('Choose a unique team name.');
      return;
    }

    setTeamForm((current) => [...current, { id: createTeamId(name), name }]);
    setTeamSectionDraft('');
    setTeamSectionError('');
  }

  function removeTeamSection(team) {
    if (boards.some((board) => board.teamId === team.id)) {
      setTeamSectionError(`Move or edit boards in ${team.name} before removing this section.`);
      return;
    }

    setTeamForm((current) => current.filter((item) => item.id !== team.id));
    setTeamSectionError('');
  }

  function toggleTeamMember(teamId, memberId) {
    setTeamForm((current) => current.map((team) => {
      if (team.id !== teamId) return team;

      const memberIds = team.memberIds ?? members.map((member) => member.id);
      return {
        ...team,
        memberIds: memberIds.includes(memberId)
          ? memberIds.filter((id) => id !== memberId)
          : [...memberIds, memberId],
      };
    }));
  }

  function saveTeamSettings(event) {
    event.preventDefault();
    const nextTeams = teamForm.map((team) => ({ ...team, name: team.name.trim() }));

    if (nextTeams.some((team) => !team.name)) {
      setTeamSectionError('Every team needs a name.');
      return;
    }
    if (new Set(nextTeams.map((team) => team.name.toLowerCase())).size !== nextTeams.length) {
      setTeamSectionError('Choose a unique name for each team.');
      return;
    }

    setTeams(nextTeams);
    setNotice('Team sections saved.');
    closeTeamSettings();
  }

  function addTeamMember(event) {
    event.preventDefault();
    const member = teamMemberDraft.trim();

    if (!member) return;
    if (member === UNASSIGNED || projectForm.team.some((item) => item.toLowerCase() === member.toLowerCase())) {
      setProjectError('Choose a unique team member name.');
      return;
    }

    setProjectForm((current) => ({ ...current, team: [...current.team, member] }));
    setTeamMemberDraft('');
    setProjectError('');
  }

  function removeTeamMember(member) {
    if (tasks.some((task) => task.assignee === member)) {
      setProjectError(`Reassign ${member}'s tasks before removing them.`);
      return;
    }

    setProjectForm((current) => ({
      ...current,
      team: current.team.filter((item) => item !== member),
    }));
  }

  function saveProject(event) {
    event.preventDefault();
    const name = projectForm.name.trim();

    if (!name) {
      setProjectError('Enter a project name.');
      projectNameInputRef.current?.focus();
      return;
    }
    if (projectForm.team.length === 0) {
      setProjectError('Add at least one team member.');
      return;
    }

    setProject({ name, team: projectForm.team });
    setNotice('Project settings saved.');
    closeProjectSettings();
  }

  function openBoardCreator(teamId, event) {
    triggerRef.current = event.currentTarget;
    setBoardForm({ name: '', teamId, members: memberNamesForTeam(teamId), wipLimits: { ...EMPTY_WIP_LIMITS }, template: 'empty' });
    setBoardError('');
    setEditingBoardId(null);
    setIsConfirmingBoardDelete(false);
    setIsCreateBoardOpen(true);
  }

  function openBoardEditor(event, board = activeBoard) {
    triggerRef.current = event.currentTarget;
    setBoardForm({
      name: board.name,
      teamId: board.teamId,
      members: [...(board.members ?? project.team)],
      wipLimits: { ...EMPTY_WIP_LIMITS, ...(board.wipLimits ?? {}) },
      template: 'empty',
    });
    setBoardError('');
    setEditingBoardId(board.id);
    setIsConfirmingBoardDelete(false);
    setIsCreateBoardOpen(true);
  }

  function closeBoardCreator() {
    setIsCreateBoardOpen(false);
    setBoardError('');
    setEditingBoardId(null);
    setIsConfirmingBoardDelete(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function toggleBoardMember(member) {
    const editingBoard = boards.find((board) => board.id === editingBoardId);
    if (
      editingBoard
      && boardForm.members.includes(member)
      && editingBoard.tasks.some((task) => task.assignee === member)
    ) {
      setBoardError(`Reassign ${member}'s tasks before removing them.`);
      return;
    }

    setBoardForm((current) => ({
      ...current,
      members: current.members.includes(member)
        ? current.members.filter((item) => item !== member)
        : [...current.members, member],
    }));
  }

  function saveBoard(event) {
    event.preventDefault();
    const name = boardForm.name.trim();

    if (!name) {
      setBoardError('Enter a board name.');
      boardNameInputRef.current?.focus();
      return;
    }
    if (editingBoardId) {
      setBoards((current) => current.map((board) => (
        board.id === editingBoardId
          ? { ...board, name, teamId: boardForm.teamId, members: boardForm.members, wipLimits: boardForm.wipLimits }
          : board
      )));
      setNotice('Board updated.');
    } else {
      const board = {
        id: `board-${createTaskId()}`,
        name,
        teamId: boardForm.teamId,
        members: boardForm.members,
        tasks: createTemplateTasks(boardForm.template, boardForm.members),
        anchors: DEFAULT_ANCHORS.map((anchor) => ({ ...anchor })),
        subtasks: {},
        deliverableTasks: {},
        taskPriorities: {},
        taskComments: {},
        archivedTaskIds: [],
        blockedTaskIds: [],
        activity: [],
        wipLimits: boardForm.wipLimits,
      };

      setBoards((current) => [...current, board]);
      setActiveBoardId(board.id);
      clearFilters();
      setNotice('Board created.');
    }
    closeBoardCreator();
  }

  function deleteBoard() {
    const remainingBoards = boards.filter((board) => board.id !== editingBoardId);
    setBoards(remainingBoards);
    setActiveBoardId(remainingBoards[0]?.id ?? '');
    clearFilters();
    setNotice('Board deleted.');
    closeBoardCreator();
  }

  function selectBoard(boardId) {
    setActiveBoardId(boardId);
    setIsMobileSidebarOpen(false);
    clearFilters();
    setUndoState(null);
  }

  function openCreate(event) {
    if (!activeBoard.id) {
      openBoardCreator(teams[0]?.id ?? '', event);
      return;
    }

    triggerRef.current = event?.currentTarget ?? null;
    setForm(createEmptyForm());
    setErrors({});
    setEditingTask(null);
    setSubtaskDraft('');
    setCommentDraft('');
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
      deliverableId: getTaskDeliverableId(task.id),
      priority: taskPriorities[task.id] ?? 'medium',
      isBlocked: blockedTaskIds.includes(task.id),
      context: task.context,
      contextTool: task.contextTool ?? '',
      subtasks: subtasksByTask[task.id] ?? [],
    });
    setErrors({});
    setIsCreating(false);
    setEditingTask(task);
    setSubtaskDraft('');
    setCommentDraft('');
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  }

  function addSubtask(event) {
    event.preventDefault();
    const title = subtaskDraft.trim();
    if (!title) return;

    const subtasks = [...form.subtasks, { id: createTaskId(), title, completed: false }];

    setForm((current) => ({ ...current, subtasks }));
    if (editingTask) saveSubtasks(editingTask.id, subtasks);
    setSubtaskDraft('');
  }

  function toggleSubtask(subtaskId) {
    const subtasks = form.subtasks.map((subtask) => (
      subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
    ));

    setForm((current) => ({ ...current, subtasks }));
    if (editingTask) saveSubtasks(editingTask.id, subtasks);
  }

  function removeSubtask(subtaskId) {
    const subtasks = form.subtasks.filter((subtask) => subtask.id !== subtaskId);

    setForm((current) => ({ ...current, subtasks }));
    if (editingTask) saveSubtasks(editingTask.id, subtasks);
  }

  function saveSubtasks(taskId, subtasks) {
    setSubtasksByTask((current) => {
      const next = { ...current };
      if (subtasks.length === 0) delete next[taskId];
      else next[taskId] = subtasks;
      return next;
    });
  }

  function toggleSavedSubtask(taskId, subtaskId) {
    setSubtasksByTask((current) => ({
      ...current,
      [taskId]: (current[taskId] ?? []).map((subtask) => (
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
      )),
    }));
    const subtask = (subtasksByTask[taskId] ?? []).find((item) => item.id === subtaskId);
    if (subtask) {
      const task = tasks.find((item) => item.id === taskId);
      logActivity(`${subtask.completed ? 'reopened' : 'completed'} subtask “${subtask.title}” on “${task?.title ?? 'a task'}”`);
    }
  }

  function saveTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setErrors({ title: 'Enter a task title.' });
      titleInputRef.current?.focus();
      return;
    }

    if (!assignees.includes(form.assignee)) {
      setErrors({ assignee: 'Select an assignee.' });
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
    const contextTool = form.contextTool || null;
    setUndoState(null);

    if (editingTask) {
      const contextChanged = form.context !== editingTask.context
        || contextTool !== editingTask.contextTool;
      const contextFields = {
        context: form.context,
        contextTool,
        contextUpdatedAt: contextChanged
          ? new Date().toISOString()
          : editingTask.contextUpdatedAt,
      };

      setTasks((current) => current.map((task) => (
        task.id === editingTask.id ? { ...task, ...editableFields, ...contextFields } : task
      )));
      setTaskPriorities((current = {}) => ({ ...current, [editingTask.id]: form.priority }));
      setBlockedTaskIds((current = []) => (
        form.isBlocked
          ? [...new Set([...current, editingTask.id])]
          : current.filter((taskId) => taskId !== editingTask.id)
      ));
      if (form.status !== 'done') {
        setArchivedTaskIds((current = []) => current.filter((taskId) => taskId !== editingTask.id));
      }
      assignTaskToDeliverable(editingTask.id, form.deliverableId);
      saveSubtasks(editingTask.id, form.subtasks);
      setNotice(
        editingTask.assignee === form.assignee
          ? 'Task updated.'
          : form.assignee === UNASSIGNED ? 'Task unassigned.' : `Assigned to ${form.assignee}.`,
      );
      logActivity(describeTaskChanges(editingTask, editableFields, {
        contextChanged,
        deliverableId: form.deliverableId,
        isBlocked: form.isBlocked,
        priority: form.priority,
        subtasks: form.subtasks,
      }));
    } else {
      const taskId = createTaskId();
      setTasks((current) => [
        ...current,
        {
          id: taskId,
          ...editableFields,
          createdDate: getLocalDate(),
          context: form.context,
          contextTool,
          contextUpdatedAt: form.context || contextTool ? new Date().toISOString() : null,
        },
      ]);
      setTaskPriorities((current = {}) => ({ ...current, [taskId]: form.priority }));
      if (form.isBlocked) setBlockedTaskIds((current = []) => [...new Set([...current, taskId])]);
      assignTaskToDeliverable(taskId, form.deliverableId);
      saveSubtasks(taskId, form.subtasks);
      setNotice('Task created.');
      logActivity(`created ${form.isBlocked ? 'blocked ' : ''}${editableFields.type} task “${editableFields.title}” in ${stageLabel(editableFields.status)}, assigned to ${editableFields.assignee}`);
    }

    closeModal();
  }

  function deleteTask() {
    if (!editingTask) return;

    setUndoState({ tasks, subtasksByTask });
    setTasks((current) => current.filter((task) => task.id !== editingTask.id));
    setSubtasksByTask((current) => {
      const next = { ...current };
      delete next[editingTask.id];
      return next;
    });
    assignTaskToDeliverable(editingTask.id, '');
    setTaskPriorities((current = {}) => {
      const next = { ...current };
      delete next[editingTask.id];
      return next;
    });
    setTaskComments((current = {}) => {
      const next = { ...current };
      delete next[editingTask.id];
      return next;
    });
    setArchivedTaskIds((current = []) => current.filter((taskId) => taskId !== editingTask.id));
    setBlockedTaskIds((current = []) => current.filter((taskId) => taskId !== editingTask.id));
    logActivity(`deleted task “${editingTask.title}” and its related details`);
    setNotice('Task deleted.');
    closeModal();
  }

  function handleDragEnd(result) {
    const reorderedTasks = hasActiveFilters
      ? moveFilteredTask(tasks, visibleTasks, result.source, result.destination, STAGES)
      : moveTask(tasks, result.source, result.destination, STAGES);

    if (reorderedTasks !== tasks) {
      setUndoState({ tasks, subtasksByTask });
      setTasks(reorderedTasks);
      setNotice('Task moved.');
      const task = tasks.find((item) => item.id === result.draggableId);
      const sourceStage = stageLabel(result.source.droppableId);
      const destinationStage = stageLabel(result.destination?.droppableId);
      logActivity(result.source.droppableId === result.destination?.droppableId
        ? `reordered “${task?.title ?? 'a task'}” in ${sourceStage}`
        : `moved “${task?.title ?? 'a task'}” from ${sourceStage} to ${destinationStage}`);
    }
  }

  function handleCalendarDragEnd(result) {
    if (!result.destination) return;

    const taskId = result.draggableId.replace('calendar-', '');
    const task = activeTasks.find((item) => item.id === taskId);
    const dueDate = result.destination.droppableId === 'calendar-unscheduled'
      ? null
      : result.destination.droppableId;

    if (!task || task.dueDate === dueDate) return;

    setTasks((current) => current.map((item) => (
      item.id === taskId ? { ...item, dueDate } : item
    )));
    logActivity(dueDate
      ? `rescheduled “${task.title}” from ${task.dueDate ? formatDueDate(task.dueDate) : 'unscheduled'} to ${formatDueDate(dueDate)}`
      : `removed the due date from “${task.title}”`);
    setNotice(dueDate ? 'Task rescheduled.' : 'Due date removed.');
  }

  function undoLastAction() {
    if (!undoState) return;

    setTasks(undoState.tasks);
    setSubtasksByTask(undoState.subtasksByTask);
    setUndoState(null);
    setNotice('Change undone.');
  }

  function openAnchorEditor(anchor) {
    setEditingAnchorId(anchor.id);
    setIsCreatingAnchor(false);
    setConfirmingAnchorDeleteId(null);
    setAnchorUrl(anchor.url ?? '');
    setAnchorLabel(anchor.label);
    setAnchorError('');
  }

  function closeAnchorEditor(keepNewAnchor = false) {
    if (isCreatingAnchor && editingAnchorId && !keepNewAnchor) {
      setAnchors((current) => current.filter((anchor) => anchor.id !== editingAnchorId));
    }
    setEditingAnchorId(null);
    setIsCreatingAnchor(false);
    setConfirmingAnchorDeleteId(null);
    setAnchorUrl('');
    setAnchorLabel('');
    setAnchorError('');
  }

  function saveAnchor(event, anchor) {
    event.preventDefault();

    const label = anchorLabel.trim();
    const url = anchorUrl.trim();
    if (!label) {
      setAnchorError('Enter a deliverable name.');
      return;
    }

    if (url && !isValidDeliverableUrl(url)) {
      setAnchorError('Please enter a valid URL.');
      anchorUrlInputRef.current?.focus();
      return;
    }

    setAnchors((current) => current.map((item) => (
      item.id === anchor.id ? { ...item, label, url: url || null } : item
    )));
    logActivity(`${isCreatingAnchor ? 'created' : 'updated'} deliverable “${label}”`);
    setNotice('Deliverable saved.');
    closeAnchorEditor(true);
  }

  function addAnchor() {
    const anchor = { id: `deliverable-${createTaskId()}`, label: 'New deliverable', url: null };
    setAnchors((current) => [...current, anchor]);
    setEditingAnchorId(anchor.id);
    setIsCreatingAnchor(true);
    setConfirmingAnchorDeleteId(null);
    setAnchorLabel(anchor.label);
    setAnchorUrl('');
    setAnchorError('');
  }

  function deleteAnchor(anchor) {
    setAnchors((current) => current.filter((item) => item.id !== anchor.id));
    setDeliverableTasks((current = {}) => {
      const next = { ...current };
      delete next[anchor.id];
      return next;
    });
    logActivity(`removed deliverable “${anchor.label}”`);
    setNotice('Deliverable removed.');
    setIsCreatingAnchor(false);
    setEditingAnchorId(null);
    setConfirmingAnchorDeleteId(null);
  }

  function removeAnchorLink(anchor) {
    setAnchors((current) => current.map((item) => (
      item.id === anchor.id ? { ...item, url: null } : item
    )));
    setNotice('Deliverable link removed.');
    closeAnchorEditor();
  }

  async function copyPromptContext() {
    if (!editingTask || isCopying) return;

    const taskForPrompt = {
      ...editingTask,
      title: form.title,
      description: form.description,
      type: form.type,
      status: form.status,
      assignee: form.assignee,
      dueDate: form.dueDate || null,
      context: form.context,
      contextTool: form.contextTool || null,
    };

    setIsCopying(true);

    try {
      await navigator.clipboard.writeText(formatTaskPrompt(taskForPrompt));
      setNotice('Prompt context copied.');
    } catch {
      setNotice('Unable to copy prompt. Please try again.');
    } finally {
      setIsCopying(false);
    }
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedBoardSearch = boardSearchQuery.trim().toLowerCase();
  const matchingBoards = boards.filter((board) => (
    !normalizedBoardSearch || board.name.toLowerCase().includes(normalizedBoardSearch)
  ));
  const hasActiveFilters = Boolean(normalizedSearch || filterType !== 'all' || filterAssignee !== 'all' || filterPriority !== 'all');
  const visibleTasks = activeTasks.filter((task) => {
    const matchesSearch = !normalizedSearch || [task.title, task.description, task.assignee]
      .some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesSearch
      && (filterType === 'all' || task.type === filterType)
      && (filterAssignee === 'all' || task.assignee === filterAssignee)
      && (filterPriority === 'all' || (taskPriorities[task.id] ?? 'medium') === filterPriority);
  });
  const statusCounts = STAGES.map((stage) => ({
    ...stage,
    count: activeTasks.filter((task) => task.status === stage.id).length,
  }));
  const attentionCount = activeTasks.filter((task) => {
    const state = getDeadlineState(task.dueDate, task.status, currentTime);
    return state === 'warning' || state === 'overdue';
  }).length;
  const overdueTasks = activeTasks.filter((task) => getDeadlineState(task.dueDate, task.status, currentTime) === 'overdue');
  const upcomingTasks = activeTasks.filter((task) => task.dueDate && getDeadlineState(task.dueDate, task.status, currentTime) !== 'overdue' && task.status !== 'done')
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate));
  const unscheduledTasks = activeTasks.filter((task) => !task.dueDate && task.status !== 'done');
  const calendarUnscheduledTasks = activeTasks.filter((task) => !task.dueDate);
  const calendarDays = getCalendarDays(calendarMonth);
  const calendarTasksByDate = activeTasks.reduce((grouped, task) => {
    if (!task.dueDate) return grouped;
    return { ...grouped, [task.dueDate]: [...(grouped[task.dueDate] ?? []), task] };
  }, {});

  function clearFilters() {
    setSearchQuery('');
    setFilterType('all');
    setFilterAssignee('all');
    setFilterPriority('all');
  }

  if (!members.some((member) => member.id === signedInUserId)) {
    return (
      <AccessScreen
        members={members}
        mode={accessMode}
        onModeChange={(mode) => {
          setAccessMode(mode);
          setSignupError('');
        }}
        onSelectUser={signIn}
        onCreateUser={createUser}
        signupError={signupError}
        signupName={signupName}
        onSignupNameChange={(name) => {
          setSignupName(name);
          setSignupError('');
        }}
      />
    );
  }

  return (
    <div className={`${isDark ? 'dark ' : ''}flex min-h-screen flex-col bg-surface-page transition-colors duration-200`}>
      <header className="relative mb-4 border-b border-brand-primary/15 bg-surface-card shadow-sm sm:mb-8">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-primary/20 bg-surface-card text-brand-primary shadow-sm transition-colors hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
        >
          {isSidebarOpen ? (
            <PanelLeftClose aria-hidden="true" size={18} strokeWidth={2} />
          ) : (
            <PanelLeftOpen aria-hidden="true" size={18} strokeWidth={2} />
          )}
        </button>
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-2 py-2.5 pl-14 pr-3 sm:gap-4 sm:py-3 sm:pl-20 sm:pr-6 lg:pr-8">
        <a
          href="#board"
          aria-label="Go to the Anchor board"
          className="flex shrink-0 items-center gap-2 sm:gap-3 text-text-primary"
        >
          <img
            src="/anchor-logo-sm.png"
            alt=""
            className={`size-9 shrink-0 object-contain sm:size-11 ${isDark ? '' : 'brightness-[0.45] saturate-150 contrast-125'}`}
          />
          <span className="hidden text-lg font-semibold tracking-tight sm:block">{project.name}</span>
        </a>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <details ref={userProfileRef} className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm border border-brand-primary/20 bg-surface-card px-2 py-1.5 text-left text-sm text-text-primary shadow-sm marker:hidden transition-colors hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page">
              <MemberAvatar member={currentUser} size="size-6" />
              <span className="hidden max-w-24 truncate sm:block">{currentUser.name}</span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-sm border border-brand-primary/20 bg-surface-card p-3 text-sm shadow-lg">
              <div className="flex items-center gap-2">
                <MemberAvatar member={currentUser} size="size-9" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{currentUser.name}</p>
                  <p className="truncate text-xs text-text-muted">{currentUser.role}</p>
                </div>
              </div>
              <p className="mt-3 border-t border-brand-primary/10 pt-3 text-xs text-text-muted">Current user · {currentUser.email}</p>
              <div className="mt-3 border-t border-brand-primary/10 pt-3">
                <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-text-muted">Switch user</p>
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => selectCurrentUser(member)}
                    className={`flex w-full items-center gap-2 rounded-sm px-1 py-1.5 text-left text-xs transition-colors hover:bg-brand-primary/10 ${member.id === currentUser.id ? 'text-text-primary' : 'text-text-muted'}`}
                  >
                    <MemberAvatar member={member} size="size-5" />
                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                    {member.id === currentUser.id && <span className="text-brand-primary">Current</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSignedInUserId('');
                  setAccessMode('login');
                  userProfileRef.current?.removeAttribute('open');
                }}
                className="mt-3 w-full border-t border-brand-primary/10 pt-3 text-left text-xs font-medium text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              >
                Sign out
              </button>
            </div>
          </details>
          <button
            type="button"
            onClick={openProjectSettings}
            aria-label="Open project settings"
            title="Project settings"
            className="rounded-sm border border-brand-primary/20 bg-surface-card p-2 text-brand-primary shadow-sm transition-colors hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
          >
            <Settings aria-hidden="true" size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-sm border border-brand-primary/20 bg-surface-card p-2 text-brand-primary shadow-sm transition-colors hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
          >
            {isDark ? (
              <Sun aria-hidden="true" size={18} strokeWidth={2} />
            ) : (
              <Moon aria-hidden="true" size={18} strokeWidth={2} />
            )}
          </button>
          <button
            ref={triggerRef}
            type="button"
            onClick={openCreate}
            className="rounded-sm bg-brand-primary px-3 py-2 text-sm font-medium text-surface-card shadow-sm transition-colors hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page sm:px-4"
          >
            <span className="sm:hidden" aria-hidden="true">+</span>
            <span className="hidden sm:inline">{boards.length === 0 ? '+ New board' : '+ New task'}</span>
            <span className="sr-only sm:hidden">{boards.length === 0 ? 'New board' : 'New task'}</span>
          </button>
        </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-3 pb-6 sm:px-6 lg:px-8">

      {notice && (
        <div
          className="notice-toast fixed bottom-4 right-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-sm border border-brand-primary/20 bg-surface-card px-4 py-3 text-sm text-brand-primary shadow-md"
          style={{ '--notice-duration': `${undoState ? 5000 : 2500}ms` }}
          role="status"
        >
          <span>{notice}</span>
          {undoState && (
            <button
              type="button"
              onClick={undoLastAction}
              className="rounded px-2 py-1 font-medium text-text-primary hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              Undo
            </button>
          )}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1">
        {isMobileSidebarOpen && <button type="button" aria-label="Close sidebar" onClick={() => setIsMobileSidebarOpen(false)} className="fixed inset-0 z-20 bg-text-primary/35 lg:hidden" />}
        <aside
          aria-hidden={!isSidebarOpen && !isMobileSidebarOpen}
          aria-label="Workspace navigation"
          className={`fixed inset-y-0 left-0 z-30 w-72 max-w-[calc(100vw-3rem)] overflow-y-auto bg-surface-page px-4 py-6 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none lg:static lg:z-auto lg:max-w-none lg:self-stretch lg:overflow-hidden lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:transition-[width,margin] ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${
            isSidebarOpen
              ? 'lg:mr-8 lg:w-52 lg:delay-0'
              : 'lg:w-0 lg:delay-100 lg:pointer-events-none'
          }`}
        >
          <div className={`sticky top-6 w-full border-r border-brand-primary/15 pr-5 transition-[opacity,transform] duration-100 ease-out motion-reduce:transition-none lg:h-full lg:w-52 ${
            isSidebarOpen || isMobileSidebarOpen ? 'translate-x-0 opacity-100 delay-200' : '-translate-x-2 opacity-0 delay-0'
          }`}>
            <label className="relative block">
              <span className="sr-only">Search boards</span>
              <Search aria-hidden="true" size={15} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={boardSearchQuery}
                onChange={(event) => setBoardSearchQuery(event.target.value)}
                placeholder="Search boards"
                className="w-full rounded-sm border border-brand-primary/20 bg-surface-card py-2 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>
            <button
              type="button"
              onClick={openTeamSettings}
              className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-text-muted transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              <Settings aria-hidden="true" size={14} strokeWidth={2} />
              Manage teams
            </button>
            <div className="mt-5 space-y-5">
              {teams.map((team) => {
                const teamMatchesSearch = team.name.toLowerCase().includes(normalizedBoardSearch);
                const teamBoards = (teamMatchesSearch ? boards : matchingBoards)
                  .filter((board) => board.teamId === team.id);

                if (normalizedBoardSearch && !teamMatchesSearch && teamBoards.length === 0) return null;

                return (
                  <section key={team.id} aria-labelledby={`team-${team.id}`}>
                    <h2 id={`team-${team.id}`} className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      {team.name}
                    </h2>
                    <div className="mt-2 space-y-1">
                      {teamBoards.map((board) => (
                        <div key={board.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => selectBoard(board.id)}
                            className={`flex w-full items-center gap-2 border-l-2 py-1.5 pl-2 pr-8 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
                              board.id === activeBoard.id
                                ? 'border-brand-primary bg-brand-primary/10 font-medium text-text-primary'
                                : 'border-transparent text-text-muted hover:bg-brand-primary/5 hover:text-text-primary'
                            }`}
                          >
                            <span className="size-1.5 shrink-0 bg-current" />
                            <span className="truncate">{board.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => openBoardEditor(event, board)}
                            aria-label={`Edit ${board.name}`}
                            title="Board settings"
                            className="absolute right-1 top-1/2 -translate-x-1 -translate-y-1/2 scale-75 p-1 text-text-muted opacity-0 transition-all duration-150 ease-out hover:text-text-primary focus-visible:translate-x-0 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100"
                          >
                            <Settings aria-hidden="true" size={14} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      {teamBoards.length === 0 && !normalizedBoardSearch && (
                        <button
                          type="button"
                          onClick={(event) => openBoardCreator(team.id, event)}
                          className="group inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-primary transition-[color,transform] duration-200 ease-out hover:-translate-y-px hover:text-text-primary active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 motion-reduce:transform-none"
                        >
                          <span aria-hidden="true" className="text-sm leading-none transition-transform duration-200 ease-out group-hover:rotate-90 group-hover:scale-110 motion-reduce:transform-none">+</span>
                          <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none">Create a board</span>
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
              {matchingBoards.filter((board) => !teams.some((team) => team.id === board.teamId)).length > 0 && (
                <section aria-labelledby="ungrouped-boards">
                  <h2 id="ungrouped-boards" className="text-xs font-medium uppercase tracking-wide text-text-muted">Ungrouped</h2>
                  <div className="mt-2 space-y-1">
                    {matchingBoards.filter((board) => !teams.some((team) => team.id === board.teamId)).map((board) => (
                      <div key={board.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => selectBoard(board.id)}
                          className={`flex w-full items-center gap-2 border-l-2 py-1.5 pl-2 pr-8 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
                            board.id === activeBoard.id
                              ? 'border-brand-primary bg-brand-primary/10 font-medium text-text-primary'
                              : 'border-transparent text-text-muted hover:bg-brand-primary/5 hover:text-text-primary'
                          }`}
                        >
                          <span className="size-1.5 shrink-0 bg-current" />
                          <span className="truncate">{board.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => openBoardEditor(event, board)}
                          aria-label={`Edit ${board.name}`}
                          title="Board settings"
                          className="absolute right-1 top-1/2 -translate-x-1 -translate-y-1/2 scale-75 p-1 text-text-muted opacity-0 transition-all duration-150 ease-out hover:text-text-primary focus-visible:translate-x-0 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100"
                        >
                          <Settings aria-hidden="true" size={14} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {normalizedBoardSearch && matchingBoards.length === 0 && !teams.some((team) => team.name.toLowerCase().includes(normalizedBoardSearch)) && (
                <p className="text-sm text-text-muted">No boards found.</p>
              )}
            </div>
            {teams.length > 0 && (
              <button
                type="button"
                onClick={(event) => openBoardCreator(teams[0].id, event)}
                className="mt-6 w-full rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              >
                + New board
              </button>
            )}
          </div>
        </aside>

        <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        {boards.length === 0 ? (
          <section id="board" className="flex min-h-[26rem] flex-1 items-center justify-center rounded-sm border border-dashed border-brand-primary/25 bg-surface-card px-6 text-center" aria-labelledby="empty-workspace-heading">
            <div className="max-w-md">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Workspace</p>
              <h1 id="empty-workspace-heading" className="mt-2 text-2xl font-semibold text-text-primary">No boards yet</h1>
              <p className="mt-3 text-sm leading-6 text-text-muted">Create a board when you are ready to organise work. You can choose a team, members, and a starter setup.</p>
              <button
                type="button"
                onClick={(event) => openBoardCreator(teams[0]?.id ?? '', event)}
                className="mt-6 rounded-sm bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card shadow-sm transition-colors hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
              >
                Create a board
              </button>
            </div>
          </section>
        ) : (
          <>
      <nav className="mb-6 flex overflow-x-auto border-b border-brand-primary/15" aria-label="Board views" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === 'board'}
          onClick={() => setActiveWorkspaceTab('board')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${activeWorkspaceTab === 'board' ? 'border-brand-primary text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          Board
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === 'deliverables'}
          onClick={() => setActiveWorkspaceTab('deliverables')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${activeWorkspaceTab === 'deliverables' ? 'border-brand-primary text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          Deliverables <span className="ml-1 text-xs text-text-muted">{anchors.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeWorkspaceTab === 'dates'} onClick={() => setActiveWorkspaceTab('dates')} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${activeWorkspaceTab === 'dates' ? 'border-brand-primary text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
          Due dates
        </button>
        <button type="button" role="tab" aria-selected={activeWorkspaceTab === 'timeline'} onClick={() => setActiveWorkspaceTab('timeline')} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${activeWorkspaceTab === 'timeline' ? 'border-brand-primary text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
          Timeline
        </button>
        <button type="button" role="tab" aria-selected={activeWorkspaceTab === 'activity'} onClick={() => setActiveWorkspaceTab('activity')} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${activeWorkspaceTab === 'activity' ? 'border-brand-primary text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
          Activity
        </button>
      </nav>

      {activeWorkspaceTab === 'deliverables' && (
      <details open id="deliverables" className="group rounded-sm border border-l-2 border-l-type-feature/60 border-brand-primary/15 bg-surface-card scroll-mt-6" aria-labelledby="deliverables-heading">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-3 py-2.5 hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-type-feature/10 text-type-feature">
              <Flag aria-hidden="true" size={15} strokeWidth={2} />
            </span>
            <h2 id="deliverables-heading" className="truncate text-sm font-semibold text-text-primary">
              Deliverables
            </h2>
            <span className="hidden text-xs text-text-muted sm:inline">{anchors.length} milestones</span>
          </div>
          <ChevronDown aria-hidden="true" size={20} className="text-text-muted transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="border-t border-brand-primary/15 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted">Add only the deliverables this board needs.</p>
            <button
              type="button"
              onClick={addAnchor}
              className="rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              + New deliverable
            </button>
          </div>
          {anchors.length === 0 ? (
            <div className="rounded-sm border border-dashed border-brand-primary/20 px-4 py-10 text-center">
              <p className="text-sm font-medium text-text-primary">No deliverables yet</p>
              <p className="mt-1 text-sm text-text-muted">Add one whenever this board needs a milestone.</p>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {anchors.map((anchor) => {
            const Icon = ANCHOR_DETAILS[anchor.id] ?? Flag;
            const isEditing = editingAnchorId === anchor.id;
            const assignedTasks = tasks.filter((task) => (
              (deliverableTasks[anchor.id] ?? []).includes(task.id)
            ));
            const completedTasks = assignedTasks.filter((task) => task.status === 'done').length;
            const progress = assignedTasks.length === 0 ? 0 : (completedTasks / assignedTasks.length) * 100;

            return (
              <article
                key={anchor.id}
                className="rounded-md border border-brand-primary/15 bg-surface-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-brand-primary">
                    <Icon aria-hidden="true" size={18} strokeWidth={2} />
                    <h3 className="truncate text-sm font-medium text-text-primary">{anchor.label}</h3>
                  </div>
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${
                    anchor.url
                      ? 'border-brand-primary/20 bg-brand-primary/10 text-brand-primary'
                      : 'border-due-neutral/20 bg-due-neutral/10 text-due-neutral'
                  }`}>
                    {anchor.url ? 'Linked' : 'Not linked'}
                  </span>
                </div>

                {isEditing ? (
                  <form className="mt-4" onSubmit={(event) => saveAnchor(event, anchor)}>
                    <label htmlFor={`anchor-label-${anchor.id}`} className="block text-sm font-medium text-text-primary">
                      Deliverable name
                    </label>
                    <input
                      id={`anchor-label-${anchor.id}`}
                      type="text"
                      value={anchorLabel}
                      onChange={(event) => {
                        setAnchorLabel(event.target.value);
                        if (anchorError) setAnchorError('');
                      }}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                    <label htmlFor={`anchor-url-${anchor.id}`} className="mt-4 block text-sm font-medium text-text-primary">
                      Deliverable URL
                    </label>
                    <input
                      ref={anchorUrlInputRef}
                      id={`anchor-url-${anchor.id}`}
                      type="url"
                      value={anchorUrl}
                      onChange={(event) => {
                        setAnchorUrl(event.target.value);
                        if (anchorError) setAnchorError('');
                      }}
                      placeholder="https://example.com"
                      aria-invalid={Boolean(anchorError)}
                      aria-describedby={anchorError ? `anchor-url-error-${anchor.id}` : undefined}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                    {anchorError && (
                      <p id={`anchor-url-error-${anchor.id}`} className="mt-1.5 text-sm text-type-bug" role="alert">
                        {anchorError}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-surface-card hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                      >
                        Save deliverable
                      </button>
                      <button
                        type="button"
                        onClick={closeAnchorEditor}
                        className="rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      >
                        Cancel
                      </button>
                      {confirmingAnchorDeleteId === anchor.id ? (
                        <span className="flex items-center gap-2 rounded-md bg-type-bug/10 px-2 py-1.5 text-xs text-type-bug">
                          Delete this deliverable?
                          <button
                            type="button"
                            onClick={() => deleteAnchor(anchor)}
                            className="rounded-sm bg-type-bug px-2 py-1 text-xs font-semibold text-surface-card focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingAnchorDeleteId(null)}
                            className="rounded-sm px-1 py-1 text-xs font-medium hover:bg-type-bug/10 focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingAnchorDeleteId(anchor.id)}
                          className="rounded-md px-3 py-2 text-sm font-medium text-type-bug hover:bg-type-bug/10 focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                        >
                          Delete deliverable
                        </button>
                      )}
                      {anchor.url && (
                        <button
                          type="button"
                          onClick={() => removeAnchorLink(anchor)}
                          className="rounded-md px-3 py-2 text-sm font-medium text-type-bug hover:bg-type-bug/10 focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                        >
                          Remove link
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAnchorEditor(anchor)}
                      aria-label={`Edit ${anchor.label}`}
                      title="Deliverable settings"
                      className="inline-flex size-9 items-center justify-center rounded-md border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    >
                      <Settings aria-hidden="true" size={16} strokeWidth={2} />
                    </button>
                    {anchor.url && (
                      <a
                        href={anchor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      >
                        Open link
                        <ExternalLink aria-hidden="true" size={14} strokeWidth={2} />
                      </a>
                    )}
                  </div>
                )}
                <section className="mt-5 border-t border-brand-primary/10 pt-4" aria-label={`Tasks for ${anchor.label}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Tasks</h4>
                    <span className="text-xs text-text-muted">{completedTasks} of {assignedTasks.length} complete</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-primary/10">
                    <div className="h-full rounded-full bg-brand-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                  {assignedTasks.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {assignedTasks.map((task) => (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={(event) => openEdit(task, event)}
                            className="w-full rounded-sm border border-brand-primary/15 bg-surface-page/60 px-3 py-2 text-left transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                          >
                            <span className="block text-sm font-medium text-text-primary">{task.title}</span>
                            <span className="mt-1 block text-xs text-text-muted">
                              {STAGES.find((stage) => stage.id === task.status)?.label}
                              {task.dueDate ? ` · Due ${formatDueDate(task.dueDate)}` : ' · No due date'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-text-muted">No tasks assigned.</p>
                  )}
                </section>
              </article>
            );
          })}
          </div>
          )}
        </div>
      </details>
      )}

      {activeWorkspaceTab === 'dates' && (
        <section aria-labelledby="due-dates-heading">
          <h2 id="due-dates-heading" className="text-xl font-semibold text-text-primary">Due dates</h2>
          <p className="mt-1 text-sm text-text-muted">Keep upcoming, overdue, and unscheduled work visible.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {[
              ['Overdue', overdueTasks, 'border-type-bug/50'],
              ['Upcoming', upcomingTasks, 'border-due-warning/50'],
              ['Unscheduled', unscheduledTasks, 'border-due-neutral/50'],
            ].map(([label, dateTasks, borderClass]) => (
              <section key={label} className={`rounded-sm border border-l-2 ${borderClass} border-brand-primary/15 bg-surface-card p-4`}>
                <h3 className="font-semibold text-text-primary">{label} <span className="text-sm font-normal text-text-muted">{dateTasks.length}</span></h3>
                <ul className="mt-4 space-y-2">
                  {dateTasks.length > 0 ? dateTasks.map((task) => (
                    <li key={task.id} className="rounded-sm bg-surface-page/70 px-3 py-2 text-sm">
                      <button type="button" onClick={(event) => openEdit(task, event)} className="w-full text-left font-medium text-text-primary">{task.title}</button>
                      <span className="mt-1 block text-xs text-text-muted">{task.dueDate ? formatDueDate(task.dueDate) : 'No due date'}</span>
                    </li>
                  )) : <li className="text-sm text-text-muted">Nothing here.</li>}
                </ul>
              </section>
            ))}
          </div>
        </section>
      )}

      {activeWorkspaceTab === 'timeline' && (
        <section aria-labelledby="timeline-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="timeline-heading" className="text-xl font-semibold text-text-primary">Calendar</h2>
              <p className="mt-1 text-sm text-text-muted">Drag a task to another day to reschedule it.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCalendarMonth((current) => shiftCalendarMonth(current, -1))} className="rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">Previous</button>
              <button type="button" onClick={() => setCalendarMonth((current) => shiftCalendarMonth(current, 1))} className="rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">Next</button>
            </div>
          </div>
          <h3 className="mt-6 text-base font-semibold text-text-primary">{formatCalendarMonth(calendarMonth)}</h3>
          <DragDropContext onDragEnd={handleCalendarDragEnd}>
            <div className="mt-3 overflow-x-auto rounded-sm border border-brand-primary/15 bg-surface-card">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-7 border-b border-brand-primary/15 bg-surface-page/50">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <span key={day} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-muted">{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const isCurrentMonth = day.startsWith(calendarMonth);
                    const isToday = day === getLocalDate();
                    const dayTasks = calendarTasksByDate[day] ?? [];

                    return (
                      <Droppable key={day} droppableId={day}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`min-h-32 border-b border-r border-brand-primary/10 p-2 transition-colors ${
                              snapshot.isDraggingOver ? 'bg-brand-primary/10' : isCurrentMonth ? 'bg-surface-card' : 'bg-surface-page/50'
                            }`}
                          >
                            <span className={`mb-2 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? 'bg-brand-primary text-surface-card' : isCurrentMonth ? 'text-text-primary' : 'text-text-muted'}`}>{Number(day.slice(-2))}</span>
                            <div className="space-y-1.5">
                              {dayTasks.map((task, index) => (
                                <Draggable key={task.id} draggableId={`calendar-${task.id}`} index={index} disableInteractiveElementBlocking>
                                  {(dragProvided, dragSnapshot) => (
                                    <button
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      style={dragSnapshot.isDropAnimating
                                        ? { ...dragProvided.draggableProps.style, transition: 'transform 1ms linear' }
                                        : dragProvided.draggableProps.style}
                                      type="button"
                                      onClick={(event) => openEdit(task, event)}
                                      className={`w-full rounded-sm border-l-2 px-2 py-1.5 text-left text-xs shadow-sm transition-shadow ${
                                        task.type === 'feature' ? 'border-l-type-feature bg-type-feature/10 text-text-primary' : 'border-l-type-bug bg-type-bug/10 text-text-primary'
                                      } ${dragSnapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'}`}
                                    >
                                      <span className="block truncate font-medium">{task.title}</span>
                                      <span className="mt-0.5 block truncate text-text-muted">Set {formatDueDate(task.createdDate)}</span>
                                    </button>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </div>
              </div>
            </div>
            <Droppable droppableId="calendar-unscheduled">
              {(provided, snapshot) => (
                <section
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`relative mt-5 min-w-0 w-full max-w-full rounded-sm border border-dashed p-4 transition-colors ${snapshot.isDraggingOver ? 'border-brand-primary bg-brand-primary/5' : 'border-brand-primary/20 bg-surface-card'}`}
                >
                  <h3 className="text-sm font-semibold text-text-primary">Unscheduled tasks</h3>
                  <p className="mt-1 text-xs text-text-muted">Drag a task here to remove its due date, or drag one onto the calendar to schedule it.</p>
                  <div className="mt-3 min-h-10 min-w-0 space-y-2">
                    {calendarUnscheduledTasks.length > 0 ? (
                      <>
                        {calendarUnscheduledTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={`calendar-${task.id}`} index={index} disableInteractiveElementBlocking>
                        {(dragProvided, dragSnapshot) => (
                              <button
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                            style={dragSnapshot.isDropAnimating
                              ? { ...dragProvided.draggableProps.style, transition: 'transform 1ms linear' }
                              : dragProvided.draggableProps.style}
                                type="button"
                                onClick={(event) => openEdit(task, event)}
                                className="block w-fit max-w-full truncate rounded-sm border border-brand-primary/20 bg-surface-page px-3 py-2 text-sm text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                              >
                                {task.title}
                              </button>
                            )}
                          </Draggable>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-text-muted">Drop a task here to unschedule it.</p>
                    )}
                  </div>
                  <div aria-hidden="true" className="pointer-events-none absolute size-0 overflow-hidden">
                    {provided.placeholder}
                  </div>
                </section>
              )}
            </Droppable>
          </DragDropContext>
        </section>
      )}

      {activeWorkspaceTab === 'activity' && (
        <section aria-labelledby="activity-heading" className="max-w-3xl">
          <h2 id="activity-heading" className="text-xl font-semibold text-text-primary">Activity</h2>
          <p className="mt-1 text-sm text-text-muted">Recent changes on {activeBoard.name}.</p>
          <ol className="mt-6 divide-y divide-brand-primary/10 rounded-sm border border-brand-primary/15 bg-surface-card">
            {activity.length > 0 ? activity.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-text-primary">{entry.message}</span>
                <time className="shrink-0 text-xs text-text-muted" dateTime={entry.timestamp}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.timestamp))}</time>
              </li>
            )) : <li className="px-4 py-6 text-sm text-text-muted">No activity yet.</li>}
          </ol>
        </section>
      )}

      {activeWorkspaceTab === 'board' && (
      <>
      <details ref={filterDetailsRef} className="group relative z-10 mb-6 w-fit lg:z-40" aria-labelledby="filter-heading">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-3 rounded-sm border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-due-warning">
              <SlidersHorizontal aria-hidden="true" size={15} strokeWidth={2} />
            </span>
            <h2 id="filter-heading" className="text-sm font-medium text-text-primary">Filter</h2>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilters && <span className="text-xs font-medium text-due-warning">Active</span>}
            <ChevronDown aria-hidden="true" size={16} className="text-text-muted transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>
        <div className="absolute left-0 z-10 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-brand-primary/15 bg-surface-card p-4 shadow-lg">
          {hasActiveFilters && (
            <div className="mb-3 flex justify-start">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              >
                Clear filters
              </button>
            </div>
          )}
        <div className="grid gap-3">
          <label>
            <span className="sr-only">Search tasks</span>
            <input
              ref={taskSearchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks"
              className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>
          <label>
            <span className="sr-only">Filter by type</span>
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="all">All types</option>
              <option value="feature">Features</option>
              <option value="bug">Bugs</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by assignee</span>
            <select
              value={filterAssignee}
              onChange={(event) => setFilterAssignee(event.target.value)}
              className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="all">All assignees</option>
              {assignees.map((member) => <option key={member} value={member}>{member}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by priority</span>
            <select
              value={filterPriority}
              onChange={(event) => setFilterPriority(event.target.value)}
              className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="all">All priorities</option>
              {Object.entries(PRIORITY_DETAILS).map(([priority, details]) => (
                <option key={priority} value={priority}>{details.label}</option>
              ))}
            </select>
          </label>
        </div>
        {hasActiveFilters && (
          <p className="mt-3 text-xs text-text-muted">
            Showing {visibleTasks.length} of {activeTasks.length} active tasks.
          </p>
        )}
        </div>
      </details>

      <DragDropContext onDragEnd={handleDragEnd}>
        <section id="board" className="mt-8 scroll-mt-6" aria-label="Kanban board">
          <div className="snap-x snap-mandatory overflow-x-auto pb-3">
            <div className="grid min-w-[960px] grid-cols-4 gap-4 sm:min-w-[1080px] sm:gap-6">
            {STAGES.map((stage) => {
              const stageTasks = visibleTasks.filter((task) => task.status === stage.id);
              const wipLimit = activeBoard.wipLimits?.[stage.id];
              const isOverWipLimit = wipLimit && activeTasks.filter((task) => task.status === stage.id).length > wipLimit;

              return (
                <Droppable key={stage.id} droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <BoardColumn provided={provided} snapshot={snapshot} stage={stage} className="snap-start">
                      <header className="mb-4 flex items-center justify-between">
                        <h2
                          id={`${stage.id}-heading`}
                          className="text-sm font-semibold uppercase tracking-wide text-text-primary"
                        >
                          {stage.label}
                        </h2>
                        <span className="flex items-center gap-2">
                          {wipLimit && <span className={`text-xs font-medium ${isOverWipLimit ? 'text-type-bug' : 'text-text-muted'}`}>Limit {wipLimit}</span>}
                          <TaskCount count={stageTasks.length} />
                        </span>
                      </header>

                      <div className="space-y-3">
                        {stageTasks.map((task, index) => {
                          const deadlineState = getDeadlineState(task.dueDate, task.status, currentTime);
                          const deadlineDetails = DEADLINE_DETAILS[deadlineState];
                          const dueDateClassName = deadlineState === 'neutral'
                            ? 'text-due-neutral'
                            : 'text-text-primary';
                          const taskSubtasks = subtasksByTask[task.id] ?? [];
                          const isBlocked = blockedTaskIds.includes(task.id);

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                              disableInteractiveElementBlocking
                            >
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  aria-label={`Drag or edit ${task.title}`}
                                  onKeyDown={(event) => {
                                    dragProvided.dragHandleProps?.onKeyDown?.(event);
                                    if (!event.defaultPrevented && event.key === 'Enter') {
                                      openEdit(task, event);
                                    }
                                  }}
                                  style={dragSnapshot.isDropAnimating
                                    ? {
                                      ...dragProvided.draggableProps.style,
                                      transition: 'transform 1ms linear',
                                    }
                                    : dragProvided.draggableProps.style}
                                >
                                  <article
                                    onClick={(event) => openEdit(task, event)}
                                    className={`relative overflow-hidden rounded-md border border-brand-primary/15 border-l-4 bg-surface-card shadow-sm transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
                                      dragSnapshot.isDragging
                                        ? 'scale-[1.02] cursor-grabbing shadow-xl'
                                        : 'hover:-translate-y-0.5 hover:shadow-md'
                                    } ${isBlocked ? 'border-type-bug/50' : ''} ${deadlineDetails.cardClassName} ${TASK_TYPE_DETAILS[task.type].stripeClassName}`}
                                  >
                                    {isBlocked && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-type-bug/10" />}
                                    {isBlocked && <span className="absolute right-10 top-2 z-10 rounded-sm bg-type-bug px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface-card">Blocked</span>}
                                    <div className="relative z-10 p-4 pr-12">
                                      <div>
                                        <span className="block text-sm font-medium leading-5 text-text-primary">
                                          {task.title}
                                        </span>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <TaskTypeBadge type={task.type} />
                                        </div>
                                      </div>
                                      <span className="mt-2 block text-sm leading-5 text-text-muted">
                                        {task.description}
                                      </span>
                                      <div className="mt-4 border-t border-brand-primary/10 pt-3 text-xs text-text-muted">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <AssigneeBadge
                                            assignee={task.assignee}
                                            assignees={assignees}
                                            members={members}
                                            isOpen={assigneeMenuTaskId === task.id}
                                            onToggle={() => setAssigneeMenuTaskId((current) => (current === task.id ? null : task.id))}
                                            onAssign={(assignee) => assignTaskFromCard(task, assignee)}
                                          />
                                          <PriorityBadge priority={taskPriorities[task.id] ?? 'medium'} />
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                                          <DeadlineIndicator state={deadlineState} />
                                          <span className="shrink-0">
                                            Due{' '}
                                            <span className={`font-medium ${dueDateClassName}`}>
                                              {task.dueDate ? (
                                                <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
                                              ) : 'No due date'}
                                            </span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute right-2 top-2 z-10 rounded p-1.5 text-text-muted"
                                    >
                                      <GripVertical aria-hidden="true" size={18} strokeWidth={2} />
                                    </span>
                                  </article>
                                  {taskSubtasks.length > 0 && (
                                    <div className="relative ml-4 mt-2 space-y-2 border-l border-brand-primary/20 pl-3">
                                      {taskSubtasks.map((subtask) => (
                                        <div
                                          key={subtask.id}
                                          className={`flex items-center gap-3 rounded-sm border border-dashed px-3 py-2 text-left transition-colors ${
                                            subtask.completed
                                              ? 'border-brand-primary/15 bg-brand-primary/5 text-text-muted'
                                              : 'border-brand-primary/25 bg-surface-card/70 text-text-primary hover:bg-brand-primary/5'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={subtask.completed}
                                            aria-label={`Mark ${subtask.title} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              toggleSavedSubtask(task.id, subtask.id);
                                            }}
                                            onKeyDown={(event) => event.stopPropagation()}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onTouchStart={(event) => event.stopPropagation()}
                                            className={`flex size-4 shrink-0 items-center justify-center rounded-sm border text-[10px] leading-none focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
                                              subtask.completed
                                                ? 'border-brand-primary bg-brand-primary text-surface-card'
                                                : 'border-brand-primary/40 text-transparent'
                                            }`}
                                          >
                                            ✓
                                          </button>
                                          <span className="min-w-0 flex-1">
                                            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">Subtask</span>
                                            <span className={`mt-0.5 block text-sm ${subtask.completed ? 'line-through' : ''}`}>{subtask.title}</span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        {stageTasks.length === 0 && !snapshot.isDraggingOver && (
                          <p className="animate-empty-state rounded-sm border border-dashed border-brand-primary/20 px-3 py-6 text-center text-sm text-text-muted motion-reduce:animate-none">
                            {hasActiveFilters ? 'No matching tasks.' : 'No tasks in this stage.'}
                          </p>
                        )}
                      </div>
                    </BoardColumn>
                  )}
                </Droppable>
              );
            })}
            </div>
          </div>
        </section>
      </DragDropContext>
      {archivedTasks.length > 0 && (
        <details className="mt-8 rounded-sm border border-brand-primary/15 bg-surface-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text-primary">
            Archived completed tasks ({archivedTasks.length})
          </summary>
          <ul className="border-t border-brand-primary/10 p-3">
            {archivedTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={(event) => openEdit(task, event)}
                  className="w-full rounded-sm px-3 py-2 text-left text-sm text-text-muted hover:bg-brand-primary/5 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                >
                  {task.title}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <section ref={boardOverviewRef} className="mt-12 border-t border-brand-primary/15 pt-8" aria-labelledby="at-a-glance-heading">
        <div>
          <div>
            <h2 id="at-a-glance-heading" className="text-xl font-semibold text-text-primary">Board overview</h2>
            <p className="mt-1 text-sm text-text-muted">Live task distribution for {activeBoard.name}.</p>
          </div>
        </div>
        <div className="mt-5 max-w-5xl overflow-hidden rounded-sm border border-brand-primary/15 bg-surface-card md:grid md:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col items-start gap-4 border-b border-brand-primary/15 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 md:border-b-0 md:border-r">
            {isOverviewVisible ? (
              <Suspense fallback={<div className="size-[172px] shrink-0 rounded-full bg-brand-primary/10" />}>
                <StatusPieChart statusCounts={statusCounts} />
              </Suspense>
            ) : (
              <div aria-hidden="true" className="size-[172px] shrink-0 rounded-full bg-brand-primary/10" />
            )}
            <div className="space-y-2 text-sm">
              {statusCounts.map((status) => (
                <div key={status.id} className="flex items-center gap-2 text-text-muted">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${status.id === 'todo' ? 'bg-due-neutral' : status.id === 'in-progress' ? 'bg-type-feature' : status.id === 'review' ? 'bg-due-warning' : 'bg-due-safe'}`}
                  />
                  <span>{status.label}</span>
                  <span className="font-medium text-text-primary">{status.count}</span>
                </div>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-brand-primary/15 p-4 sm:p-5">
            <div className="px-3 first:pl-0">
              <dt className="text-sm text-text-muted">Total tasks</dt>
              <dd className="mt-1 text-2xl font-semibold text-text-primary">{tasks.length}</dd>
            </div>
            <div className="px-3">
              <dt className="text-sm text-text-muted">In progress</dt>
              <dd className="mt-1 text-2xl font-semibold text-text-primary">{statusCounts.find((status) => status.id === 'in-progress')?.count ?? 0}</dd>
            </div>
            <div className="px-3 pr-0">
              <dt className="text-sm text-text-muted">Needs attention</dt>
              <dd className="mt-1 text-2xl font-semibold text-text-primary">{attentionCount}</dd>
            </div>
          </dl>
        </div>
      </section>
      </>
      )}
          </>
        )}
        </main>
      </div>

      <footer className="mx-auto mt-16 flex w-full max-w-screen-2xl flex-col items-start justify-between gap-4 border-t border-brand-primary/15 py-6 text-sm text-text-muted sm:flex-row sm:items-center sm:gap-6">
        <div>
          <span className="font-medium text-text-primary">{project.name}</span>
          <span className="ml-2 text-xs uppercase tracking-[0.14em] text-text-muted">Prototype</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span>Prototype workspace</span>
          <a href="mailto:hello@anchor-prototype.test" className="transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">hello@anchor-prototype.test</a>
          <a href="tel:+440000000" className="transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">+44 0000000</a>
        </div>
      </footer>
      </div>

      {isModalOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            className="modal-panel max-h-[calc(100vh-2rem)] w-full max-w-[640px] overflow-y-auto rounded-lg bg-surface-card p-6 shadow-xl"
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
                      Status <span className="font-normal text-text-muted">(keyboard alternative to dragging)</span>
                    </label>
                    <p id="status-help" className="mt-1 text-xs text-text-muted">
                      Use the arrow keys to choose a stage, then save the task.
                    </p>
                    <select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={updateForm}
                      aria-describedby="status-help"
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
                      Assignee
                    </label>
                    <select
                      ref={assigneeSelectRef}
                      id="assignee"
                      name="assignee"
                      value={form.assignee}
                      onChange={updateForm}
                      aria-invalid={Boolean(errors.assignee)}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    >
                      {assignees.map((member) => <option key={member} value={member}>{member}</option>)}
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

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-text-primary">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={form.priority}
                    onChange={updateForm}
                    className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {Object.entries(PRIORITY_DETAILS).map(([priority, details]) => (
                      <option key={priority} value={priority}>{details.label}</option>
                    ))}
                  </select>
                </div>

                <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3 transition-colors ${
                  form.isBlocked ? 'border-type-bug/50 bg-type-bug/10' : 'border-brand-primary/15 bg-surface-page/60'
                }`}>
                  <span>
                    <span className="block text-sm font-medium text-text-primary">Blocked</span>
                    <span className="mt-0.5 block text-xs text-text-muted">Flag work that cannot move forward.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isBlocked}
                    onChange={(event) => setForm((current) => ({ ...current, isBlocked: event.target.checked }))}
                    className="size-4 accent-current"
                  />
                </label>

                <div>
                  <label htmlFor="deliverableId" className="block text-sm font-medium text-text-primary">
                    Deliverable <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <select
                    id="deliverableId"
                    name="deliverableId"
                    value={form.deliverableId}
                    onChange={updateForm}
                    className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  >
                    <option value="">No deliverable</option>
                    {anchors.map((anchor) => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}
                  </select>
                  <p className="mt-1.5 text-xs text-text-muted">Assigned tasks are shown under their deliverable.</p>
                </div>

                <section aria-labelledby="subtasks-heading" className="rounded-md border border-brand-primary/15 bg-surface-page/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 id="subtasks-heading" className="text-base font-semibold text-text-primary">Subtasks</h3>
                    </div>
                    {form.subtasks.length > 0 && <SubtaskProgress subtasks={form.subtasks} />}
                  </div>

                  {form.subtasks.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {form.subtasks.map((subtask) => (
                        <li key={subtask.id} className="flex items-center gap-3 rounded-md bg-surface-card px-3 py-2">
                          <input
                            id={`subtask-${subtask.id}`}
                            type="checkbox"
                            checked={subtask.completed}
                            onChange={() => toggleSubtask(subtask.id)}
                            className="size-4 accent-current"
                          />
                          <label
                            htmlFor={`subtask-${subtask.id}`}
                            className={`min-w-0 flex-1 text-sm ${subtask.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}
                          >
                            {subtask.title}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeSubtask(subtask.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-text-muted hover:bg-brand-primary/10 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">New subtask</span>
                      <input
                        type="text"
                        value={subtaskDraft}
                        onChange={(event) => setSubtaskDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') addSubtask(event);
                        }}
                        placeholder="Add a subtask"
                        className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addSubtask}
                      className="shrink-0 rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    >
                      Add
                    </button>
                  </div>
                </section>
              </fieldset>

              <section
                aria-labelledby="context-heading"
                className="mt-6 rounded-md border border-brand-primary/15 bg-surface-page/60 p-4"
              >
                <div className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    Continue the work
                  </p>
                  <h3 id="context-heading" className="mt-1 text-base font-semibold text-text-primary">
                    Curated Context
                  </h3>
                </div>

                <div>
                  <label htmlFor="context" className="block text-sm font-medium text-text-primary">
                    Curated Context <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <textarea
                    id="context"
                    name="context"
                    rows="10"
                    value={form.context}
                    onChange={updateForm}
                    placeholder={CONTEXT_PLACEHOLDER}
                    className="mt-1.5 w-full resize-y rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 font-mono text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted/80 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contextTool" className="block text-sm font-medium text-text-primary">
                      AI Tool
                    </label>
                    <select
                      id="contextTool"
                      name="contextTool"
                      value={form.contextTool}
                      onChange={updateForm}
                      className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    >
                      <option value="">No tool selected</option>
                      {AI_TOOLS.map((tool) => <option key={tool} value={tool}>{tool}</option>)}
                    </select>
                  </div>
                  <p className="self-end text-xs leading-5 text-text-muted">
                    Last updated: {editingTask?.contextUpdatedAt
                      ? <time dateTime={editingTask.contextUpdatedAt}>{formatContextUpdatedAt(editingTask.contextUpdatedAt)}</time>
                      : 'Not yet saved'}
                  </p>
                </div>
                {editingTask && (
                  <button
                    type="button"
                    onClick={copyPromptContext}
                    disabled={isCopying}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Copy aria-hidden="true" size={16} strokeWidth={2} />
                    {isCopying ? 'Copying prompt...' : 'Copy as Prompt Context'}
                  </button>
                )}
              </section>

              {editingTask && (
                <section aria-labelledby="comments-heading" className="mt-6 rounded-md border border-brand-primary/15 bg-surface-page/60 p-4">
                  <h3 id="comments-heading" className="text-base font-semibold text-text-primary">Comments</h3>
                  <div className="mt-4 flex items-center gap-2">
                    <MemberAvatar member={currentUser} size="size-8" />
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Add a comment</span>
                      <input
                        type="text"
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') addComment();
                        }}
                        placeholder="Add an update"
                        className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </label>
                    <button type="button" onClick={addComment} className="rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                      Add
                    </button>
                  </div>
                  {(taskComments[editingTask.id] ?? []).length > 0 && (
                    <ol className="mt-4 space-y-3">
                      {(taskComments[editingTask.id] ?? []).map((comment) => {
                        const author = members.find((member) => member.id === comment.authorId)
                          ?? members.find((member) => member.name === comment.authorName)
                          ?? members[0];
                        const authorName = comment.authorName ?? author?.name ?? 'Workspace member';
                        const isOwnComment = comment.authorId
                          ? comment.authorId === currentUser?.id
                          : authorName === currentUser?.name;
                        const isEditingComment = editingCommentId === comment.id;

                        return (
                          <li key={comment.id} className="flex items-start gap-2.5">
                            <MemberAvatar member={author} size="size-8" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-sm font-medium text-text-primary">{authorName}</span>
                                <time className="text-xs text-text-muted" dateTime={comment.timestamp}>{formatContextUpdatedAt(comment.timestamp)}</time>
                                {isOwnComment && !isEditingComment && (
                                  <span className="ml-auto flex items-center gap-2 text-xs">
                                    <button type="button" onClick={() => startCommentEdit(comment)} className="font-medium text-brand-primary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30">Edit</button>
                                    {confirmingCommentDeleteId === comment.id ? (
                                      <span className="flex items-center gap-1 text-type-bug">
                                        Delete?
                                        <button type="button" onClick={() => deleteComment(comment)} className="font-medium hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-type-bug/30">Yes</button>
                                        <button type="button" onClick={() => setConfirmingCommentDeleteId(null)} className="font-medium hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-type-bug/30">No</button>
                                      </span>
                                    ) : (
                                      <button type="button" onClick={() => setConfirmingCommentDeleteId(comment.id)} className="font-medium text-text-muted hover:text-type-bug focus:outline-none focus:ring-2 focus:ring-brand-primary/30">Delete</button>
                                    )}
                                  </span>
                                )}
                              </div>
                              {isEditingComment ? (
                                <div className="mt-1 flex gap-2 rounded-md rounded-tl-none bg-surface-card p-2">
                                  <label className="min-w-0 flex-1">
                                    <span className="sr-only">Edit comment</span>
                                    <input
                                      type="text"
                                      value={commentEditDraft}
                                      onChange={(event) => setCommentEditDraft(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') saveCommentEdit(comment);
                                        if (event.key === 'Escape') setEditingCommentId(null);
                                      }}
                                      className="w-full rounded-sm border border-brand-primary/20 bg-surface-page px-2 py-1.5 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                                    />
                                  </label>
                                  <button type="button" onClick={() => saveCommentEdit(comment)} className="rounded-sm px-2 py-1 text-xs font-medium text-brand-primary hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">Save</button>
                                  <button type="button" onClick={() => setEditingCommentId(null)} className="rounded-sm px-2 py-1 text-xs font-medium text-text-muted hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">Cancel</button>
                                </div>
                              ) : (
                                <p className="mt-1 rounded-md rounded-tl-none bg-surface-card px-3 py-2 text-sm leading-5 text-text-primary">{comment.body}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand-primary/10 pt-4">
                {editingTask ? (
                  <div className="flex flex-wrap gap-2">
                    {archivedTaskIds.includes(editingTask.id) ? (
                      <button type="button" onClick={() => restoreTask(editingTask)} className="rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                        Restore
                      </button>
                    ) : editingTask.status === 'done' && (
                      <button type="button" onClick={() => archiveTask(editingTask)} className="rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsConfirmingTaskDelete(true)}
                      className="rounded-md px-3 py-2 text-sm font-medium text-type-bug hover:bg-type-bug/10 focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                    >
                      Delete
                    </button>
                  </div>
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

      {isConfirmingTaskDelete && (
        <div className="modal-backdrop fixed inset-0 z-20 flex items-center justify-center bg-text-primary/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-task-title" className="modal-panel w-full max-w-sm rounded-lg bg-surface-card p-6 shadow-xl">
            <h2 id="delete-task-title" className="text-lg font-semibold text-text-primary">Delete task?</h2>
            <p className="mt-2 text-sm text-text-muted">This will permanently remove the task and its subtasks.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsConfirmingTaskDelete(false)} className="rounded-md border border-brand-primary/20 px-4 py-2 text-sm font-medium text-text-primary">Cancel</button>
              <button type="button" onClick={deleteTask} className="rounded-md bg-type-bug px-4 py-2 text-sm font-medium text-surface-card">Delete task</button>
            </div>
          </section>
        </div>
      )}

      {isTeamSettingsOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTeamSettings();
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="team-settings-title" className="modal-panel modal-panel-scroll w-full max-w-lg rounded-lg bg-surface-card p-6 shadow-xl">
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Workspace</p>
              <h2 ref={teamSettingsHeadingRef} id="team-settings-title" tabIndex={-1} className="mt-1 text-xl font-semibold text-text-primary">Customize team sections</h2>
              <p className="mt-2 text-sm text-text-muted">Organize boards under teams that match the way you work.</p>
            </div>

            <form onSubmit={saveTeamSettings}>
              <div className="space-y-2">
                {teamForm.map((team) => (
                  <div key={team.id} className="flex items-center gap-2 rounded-sm border border-brand-primary/15 bg-surface-page/60 p-2">
                    <input
                      type="text"
                      value={team.name}
                      onChange={(event) => {
                        setTeamForm((current) => current.map((item) => (
                          item.id === team.id ? { ...item, name: event.target.value } : item
                        )));
                        if (teamSectionError) setTeamSectionError('');
                      }}
                      aria-label={`Name for ${team.name}`}
                      className="min-w-0 flex-1 rounded-sm border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeTeamSection(team)}
                      className="rounded-sm px-2 py-1.5 text-xs font-medium text-text-muted hover:bg-type-bug/10 hover:text-type-bug focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <fieldset className="mt-5 rounded-sm border border-brand-primary/15 bg-surface-page/60 p-3">
                <legend className="px-1 text-sm font-medium text-text-primary">Team members</legend>
                <p className="mt-1 text-xs text-text-muted">Choose who should be available by default on each team’s boards.</p>
                <div className="mt-3 space-y-3">
                  {teamForm.map((team) => {
                    const selectedIds = team.memberIds ?? members.map((member) => member.id);

                    return (
                      <section key={team.id} className="border-t border-brand-primary/10 pt-3 first:border-0 first:pt-0">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">{team.name || 'Unnamed team'}</p>
                        <div className="flex flex-wrap gap-2">
                          {members.map((member) => (
                            <label key={member.id} className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-brand-primary/15 bg-surface-card px-2 py-1 text-xs text-text-primary">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(member.id)}
                                onChange={() => toggleTeamMember(team.id, member.id)}
                                className="size-3.5 accent-current"
                              />
                              <MemberAvatar member={member} size="size-4" />
                              {member.name}
                            </label>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-4 flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">New team section</span>
                  <input
                    ref={teamSectionInputRef}
                    type="text"
                    value={teamSectionDraft}
                    onChange={(event) => {
                      setTeamSectionDraft(event.target.value);
                      if (teamSectionError) setTeamSectionError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addTeamSection(event);
                    }}
                    placeholder="Add a team, e.g. Marketing"
                    className="w-full rounded-sm border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
                <button type="button" onClick={addTeamSection} className="rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                  Add team
                </button>
              </div>

              <p className="mt-3 text-xs text-text-muted">To remove a team that has boards, first move those boards using their settings button.</p>
              {teamSectionError && <p className="mt-3 text-sm text-type-bug" role="alert">{teamSectionError}</p>}

              <div className="mt-6 flex justify-end gap-3 border-t border-brand-primary/10 pt-4">
                <button type="button" onClick={closeTeamSettings} className="rounded-md border border-brand-primary/20 px-4 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
                  Save teams
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isProjectSettingsOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProjectSettings();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-settings-title"
            className="modal-panel w-full max-w-lg rounded-lg bg-surface-card p-6 shadow-xl"
          >
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Workspace</p>
              <h2 id="project-settings-title" className="mt-1 text-xl font-semibold text-text-primary">Project settings</h2>
              <p className="mt-2 text-sm text-text-muted">Set the project name and the people who can be assigned work.</p>
            </div>

            <form onSubmit={saveProject}>
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium text-text-primary">Project name</label>
                <input
                  ref={projectNameInputRef}
                  id="project-name"
                  type="text"
                  value={projectForm.name}
                  onChange={(event) => {
                    setProjectForm((current) => ({ ...current, name: event.target.value }));
                    if (projectError) setProjectError('');
                  }}
                  className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              <section className="mt-6 rounded-md border border-brand-primary/15 bg-surface-page/60 p-4" aria-labelledby="team-heading">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">People</p>
                  <h3 id="team-heading" className="mt-1 text-base font-semibold text-text-primary">Team members</h3>
                </div>

                <ul className="mt-4 space-y-2">
                  {projectForm.team.map((member) => (
                    <li key={member} className="flex items-center justify-between gap-3 border-b border-brand-primary/10 pb-2 text-sm text-text-primary last:border-0 last:pb-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <MemberAvatar member={members.find((item) => item.name === member)} size="size-6" />
                        <span className="truncate">{member}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTeamMember(member)}
                        className="rounded-sm px-2 py-1 text-xs font-medium text-text-muted hover:bg-brand-primary/10 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">New team member</span>
                    <input
                      type="text"
                      value={teamMemberDraft}
                      onChange={(event) => {
                        setTeamMemberDraft(event.target.value);
                        if (projectError) setProjectError('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') addTeamMember(event);
                      }}
                      placeholder="Add a team member"
                      className="w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addTeamMember}
                    className="rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  >
                    Add
                  </button>
                </div>
              </section>

              <p className="mt-4 text-xs text-text-muted">Rename individual milestones from the Deliverables menu.</p>
              {projectError && <p className="mt-3 text-sm text-type-bug" role="alert">{projectError}</p>}

              <div className="mt-6 flex justify-end gap-3 border-t border-brand-primary/10 pt-4">
                <button
                  type="button"
                  onClick={closeProjectSettings}
                  className="rounded-md border border-brand-primary/20 px-4 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                >
                  Save settings
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isCreateBoardOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBoardCreator();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-board-title"
            className="modal-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface-card p-6 shadow-xl"
          >
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Workspace</p>
              <h2 id="create-board-title" className="mt-1 text-xl font-semibold text-text-primary">
                {editingBoardId ? 'Edit board' : 'Create board'}
              </h2>
              <p className="mt-2 text-sm text-text-muted">Choose the team and people who will work on this board.</p>
            </div>

            <form onSubmit={saveBoard}>
              <div>
                <label htmlFor="board-name" className="block text-sm font-medium text-text-primary">Board name</label>
                <input
                  ref={boardNameInputRef}
                  id="board-name"
                  type="text"
                  value={boardForm.name}
                  onChange={(event) => {
                    setBoardForm((current) => ({ ...current, name: event.target.value }));
                    if (boardError) setBoardError('');
                  }}
                  placeholder="e.g. Website launch"
                  className="mt-1.5 w-full rounded-md border border-brand-primary/20 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              {!editingBoardId && (
                <div className="mt-5">
                  <label htmlFor="board-template" className="block text-sm font-medium text-text-primary">Starting point</label>
                  <select
                    id="board-template"
                    value={boardForm.template}
                    onChange={(event) => setBoardForm((current) => ({ ...current, template: event.target.value }))}
                    className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  >
                    {Object.entries(BOARD_TEMPLATES).map(([template, details]) => (
                      <option key={template} value={template}>{details.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-text-muted">Starter boards include three editable tasks.</p>
                </div>
              )}

              <div className="mt-5">
                <label htmlFor="board-team" className="block text-sm font-medium text-text-primary">Team <span className="font-normal text-text-muted">(optional)</span></label>
                <select
                  id="board-team"
                  value={boardForm.teamId}
                  onChange={(event) => {
                    setBoardForm((current) => ({ ...current, teamId: event.target.value }));
                    if (boardError) setBoardError('');
                  }}
                  className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value="">No team</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                {teams.length === 0 && <p className="mt-1.5 text-xs text-text-muted">This board will stay ungrouped until you add a team.</p>}
              </div>

              <fieldset className="mt-5 rounded-md border border-brand-primary/15 bg-surface-page/60 p-4">
                <legend className="px-1 text-sm font-medium text-text-primary">Work in progress limits</legend>
                <p className="mt-1 text-xs text-text-muted">Leave blank for no limit.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {STAGES.map((stage) => (
                    <label key={stage.id} className="text-xs font-medium text-text-muted">
                      {stage.label}
                      <input
                        type="number"
                        min="1"
                        value={boardForm.wipLimits[stage.id] ?? ''}
                        onChange={(event) => setBoardForm((current) => ({
                          ...current,
                          wipLimits: { ...current.wipLimits, [stage.id]: event.target.value ? Number(event.target.value) : null },
                        }))}
                        className="mt-1 block w-full rounded-sm border border-brand-primary/20 bg-surface-card px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-6 rounded-md border border-brand-primary/15 bg-surface-page/60 p-4">
                <legend className="px-1 text-sm font-medium text-text-primary">Board members <span className="font-normal text-text-muted">(optional)</span></legend>
                <p className="mt-1 text-xs text-text-muted">Only selected people can be assigned tasks on this board. Leave this empty for an unassigned board.</p>
                <div className="mt-4 space-y-2">
                  {workspaceMemberNames.map((member) => (
                    <label key={member} className="flex cursor-pointer items-center gap-3 rounded-sm bg-surface-card px-3 py-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={boardForm.members.includes(member)}
                        onChange={() => toggleBoardMember(member)}
                        className="size-4 accent-current"
                      />
                      <MemberAvatar member={members.find((item) => item.name === member)} size="size-5" />
                      {member}
                    </label>
                  ))}
                </div>
              </fieldset>

              {boardError && <p className="mt-3 text-sm text-type-bug" role="alert">{boardError}</p>}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-brand-primary/10 pt-4">
                {editingBoardId ? (
                  isConfirmingBoardDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-type-bug">Delete this board?</span>
                      <button
                        type="button"
                        onClick={deleteBoard}
                        className="rounded-sm bg-type-bug px-3 py-2 text-xs font-medium text-surface-card focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingBoardDelete(true)}
                      className="rounded-sm px-3 py-2 text-sm font-medium text-type-bug hover:bg-type-bug/10 focus:outline-none focus:ring-2 focus:ring-type-bug/30"
                    >
                      Delete board
                    </button>
                  )
                ) : <span />}
                <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeBoardCreator}
                  className="rounded-md border border-brand-primary/20 px-4 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                >
                  {editingBoardId ? 'Save changes' : 'Create board'}
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
