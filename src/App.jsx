import { useEffect, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  Anchor,
  BookOpen,
  Bug,
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
  Sparkles,
  Settings,
  SlidersHorizontal,
  Sun,
  User,
} from 'lucide-react';
import {
  DEFAULT_ANCHORS,
  isValidAnchors,
  isValidDeliverableUrl,
} from './anchors';
import { getDeadlineState } from './deadline';
import { MOCK_TASKS } from './mockTasks';
import { formatTaskPrompt } from './prompt';
import { moveTask } from './taskOrder';

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
const DEFAULT_WORKSPACE_TEAMS = [
  { id: 'product', name: 'Product' },
  { id: 'design', name: 'Design' },
  { id: 'engineering', name: 'Engineering' },
];

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

function isValidProject(value) {
  return value
    && typeof value === 'object'
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && Array.isArray(value.team)
    && value.team.every((member) => typeof member === 'string' && member.trim().length > 0);
}

function isValidWorkspaceTeams(value) {
  return Array.isArray(value) && value.length > 0 && value.every((team) => (
    team
    && typeof team.id === 'string'
    && typeof team.name === 'string'
    && team.name.trim().length > 0
  ));
}

function isValidBoards(value) {
  return Array.isArray(value) && value.length > 0 && value.every((board) => (
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
  ));
}

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
  const { label, Icon, badgeClassName } = TASK_TYPE_DETAILS[type];

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-xs font-medium ${badgeClassName}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      {label}
    </span>
  );
}

function AssigneeBadge({ assignee }) {
  const isUnassigned = assignee === UNASSIGNED;

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-sm border border-brand-primary/20 px-2 py-0.5 text-xs font-medium text-brand-primary">
      {!isUnassigned && <User aria-hidden="true" size={14} strokeWidth={2} />}
      <span className="truncate">{assignee}</span>
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

function BoardColumn({ children, provided, snapshot, stage }) {
  return (
    <section
      ref={provided.innerRef}
      {...provided.droppableProps}
      aria-labelledby={`${stage.id}-heading`}
      className={`rounded-sm border p-5 transition-colors duration-200 motion-reduce:transition-none ${
        snapshot.isDraggingOver
          ? 'border-brand-primary/40 bg-brand-primary/5'
          : 'border-brand-primary/15 bg-surface-card/50'
      }`}
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
  const [teams] = useLocalStorage(
    'vibetracker.workspace-teams',
    DEFAULT_WORKSPACE_TEAMS,
    isValidWorkspaceTeams,
  );
  const [boards, setBoards] = useLocalStorage(
    'vibetracker.boards',
    [{
      id: 'board-main',
      name: 'Main board',
      teamId: DEFAULT_WORKSPACE_TEAMS[0].id,
      tasks: legacyTasks,
      anchors: legacyAnchors,
      subtasks: legacySubtasks,
    }],
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
  const [project, setProject] = useLocalStorage(
    'vibetracker.project',
    DEFAULT_PROJECT,
    isValidProject,
  );
  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0];
  const tasks = activeBoard.tasks;
  const anchors = activeBoard.anchors;
  const subtasksByTask = activeBoard.subtasks;
  const [editingTask, setEditingTask] = useState(null);
  const [editingAnchorId, setEditingAnchorId] = useState(null);
  const [anchorUrl, setAnchorUrl] = useState('');
  const [anchorLabel, setAnchorLabel] = useState('');
  const [anchorError, setAnchorError] = useState('');
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [isConfirmingBoardDelete, setIsConfirmingBoardDelete] = useState(false);
  const [boardForm, setBoardForm] = useState({ name: '', teamId: 'product', members: [] });
  const [boardError, setBoardError] = useState('');
  const [projectForm, setProjectForm] = useState(DEFAULT_PROJECT);
  const [teamMemberDraft, setTeamMemberDraft] = useState('');
  const [projectError, setProjectError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(createEmptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [undoState, setUndoState] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('board');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const titleInputRef = useRef(null);
  const assigneeSelectRef = useRef(null);
  const anchorUrlInputRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const boardNameInputRef = useRef(null);
  const triggerRef = useRef(null);
  const isModalOpen = isCreating || editingTask !== null;
  const isDark = theme === 'dark';
  const assignees = [UNASSIGNED, ...(activeBoard.members ?? project.team)];
  const activeTeam = teams.find((team) => team.id === activeBoard.teamId) ?? teams[0];

  function updateActiveBoard(field, value) {
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (!isModalOpen && !isProjectSettingsOpen && !isCreateBoardOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        if (isCreateBoardOpen) closeBoardCreator();
        else if (isProjectSettingsOpen) closeProjectSettings();
        else closeModal();
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => {
      if (isCreateBoardOpen) boardNameInputRef.current?.focus();
      else if (isProjectSettingsOpen) projectNameInputRef.current?.focus();
      else titleInputRef.current?.focus();
    });

    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isModalOpen, isProjectSettingsOpen, isCreateBoardOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

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

  function closeModal() {
    setEditingTask(null);
    setIsCreating(false);
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
    setBoardForm({ name: '', teamId, members: [...project.team] });
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
    if (boardForm.members.length === 0) {
      setBoardError('Select at least one team member.');
      return;
    }

    if (editingBoardId) {
      setBoards((current) => current.map((board) => (
        board.id === editingBoardId
          ? { ...board, name, teamId: boardForm.teamId, members: boardForm.members }
          : board
      )));
      setNotice('Board updated.');
    } else {
      const board = {
        id: `board-${createTaskId()}`,
        name,
        teamId: boardForm.teamId,
        members: boardForm.members,
        tasks: [],
        anchors: DEFAULT_ANCHORS.map((anchor) => ({ ...anchor })),
        subtasks: {},
      };

      setBoards((current) => [...current, board]);
      setActiveBoardId(board.id);
      clearFilters();
      setNotice('Board created.');
    }
    closeBoardCreator();
  }

  function deleteBoard() {
    if (boards.length === 1) {
      setBoardError('Keep at least one board in the workspace.');
      setIsConfirmingBoardDelete(false);
      return;
    }

    const remainingBoards = boards.filter((board) => board.id !== editingBoardId);
    setBoards(remainingBoards);
    setActiveBoardId(remainingBoards[0].id);
    clearFilters();
    setNotice('Board deleted.');
    closeBoardCreator();
  }

  function selectBoard(boardId) {
    setActiveBoardId(boardId);
    clearFilters();
    setUndoState(null);
  }

  function openCreate(event) {
    triggerRef.current = event.currentTarget;
    setForm(createEmptyForm());
    setErrors({});
    setEditingTask(null);
    setSubtaskDraft('');
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
      context: task.context,
      contextTool: task.contextTool ?? '',
      subtasks: subtasksByTask[task.id] ?? [],
    });
    setErrors({});
    setIsCreating(false);
    setEditingTask(task);
    setSubtaskDraft('');
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

    setForm((current) => ({
      ...current,
      subtasks: [...current.subtasks, { id: createTaskId(), title, completed: false }],
    }));
    setSubtaskDraft('');
  }

  function toggleSubtask(subtaskId) {
    setForm((current) => ({
      ...current,
      subtasks: current.subtasks.map((subtask) => (
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
      )),
    }));
  }

  function removeSubtask(subtaskId) {
    setForm((current) => ({
      ...current,
      subtasks: current.subtasks.filter((subtask) => subtask.id !== subtaskId),
    }));
  }

  function saveSubtasks(taskId, subtasks) {
    setSubtasksByTask((current) => {
      const next = { ...current };
      if (subtasks.length === 0) delete next[taskId];
      else next[taskId] = subtasks;
      return next;
    });
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
      saveSubtasks(editingTask.id, form.subtasks);
      setNotice(
        editingTask.assignee === form.assignee
          ? 'Task updated.'
          : form.assignee === UNASSIGNED ? 'Task unassigned.' : `Assigned to ${form.assignee}.`,
      );
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
      saveSubtasks(taskId, form.subtasks);
      setNotice('Task created.');
    }

    closeModal();
  }

  function deleteTask() {
    if (!editingTask || !window.confirm('Delete this task? This action cannot be undone.')) {
      return;
    }

    setUndoState({ tasks, subtasksByTask });
    setTasks((current) => current.filter((task) => task.id !== editingTask.id));
    setSubtasksByTask((current) => {
      const next = { ...current };
      delete next[editingTask.id];
      return next;
    });
    setNotice('Task deleted.');
    closeModal();
  }

  function handleDragEnd(result) {
    const reorderedTasks = moveTask(tasks, result.source, result.destination, STAGES);

    if (reorderedTasks !== tasks) {
      setUndoState({ tasks, subtasksByTask });
      setTasks(reorderedTasks);
      setNotice('Task moved.');
    }
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
    setAnchorUrl(anchor.url ?? '');
    setAnchorLabel(anchor.label);
    setAnchorError('');
  }

  function closeAnchorEditor() {
    setEditingAnchorId(null);
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
    setNotice('Deliverable saved.');
    closeAnchorEditor();
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
  const hasActiveFilters = Boolean(normalizedSearch || filterType !== 'all' || filterAssignee !== 'all');
  const visibleTasks = tasks.filter((task) => {
    const matchesSearch = !normalizedSearch || [task.title, task.description, task.assignee]
      .some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesSearch
      && (filterType === 'all' || task.type === filterType)
      && (filterAssignee === 'all' || task.assignee === filterAssignee);
  });

  function clearFilters() {
    setSearchQuery('');
    setFilterType('all');
    setFilterAssignee('all');
  }

  return (
    <div className={`${isDark ? 'dark ' : ''}min-h-screen bg-surface-page transition-colors duration-200`}>
      <header className="relative mb-8 border-b border-brand-primary/15 bg-surface-card shadow-sm">
        <button
          type="button"
          onClick={() => setIsSidebarOpen((current) => !current)}
          aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-primary/20 bg-surface-card text-brand-primary shadow-sm transition-colors hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
        >
          {isSidebarOpen ? (
            <PanelLeftClose aria-hidden="true" size={18} strokeWidth={2} />
          ) : (
            <PanelLeftOpen aria-hidden="true" size={18} strokeWidth={2} />
          )}
        </button>
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 py-3 pl-16 pr-4 sm:pl-20 sm:pr-6 lg:pr-8">
        <a href="#board" className="flex items-center gap-3 text-text-primary">
          <span className="flex size-9 items-center justify-center rounded-md bg-brand-primary text-surface-card shadow-sm">
            <Anchor aria-hidden="true" size={20} strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight">{project.name}</span>
        </a>

        <div className="flex items-center gap-2">
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
            className="rounded-sm bg-brand-primary px-4 py-2 text-sm font-medium text-surface-card shadow-sm transition-colors hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-page"
          >
            + New task
          </button>
        </div>
        </div>
      </header>

      <div className="px-4 pb-6 sm:px-6 lg:px-8">

      {notice && (
        <div className="fixed bottom-4 right-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-sm border border-brand-primary/20 bg-surface-card px-4 py-3 text-sm text-brand-primary shadow-md" role="status">
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

      <div className={`mb-4 ${isSidebarOpen ? 'lg:hidden' : ''}`}>
        <label className="block text-xs font-medium uppercase tracking-[0.16em] text-text-muted" htmlFor="mobile-board">
          Board
        </label>
        <select
          id="mobile-board"
          value={activeBoard.id}
          onChange={(event) => selectBoard(event.target.value)}
          className="mt-1.5 w-full rounded-sm border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        >
          {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
        </select>
        <div className="mt-2 flex items-stretch gap-2">
          <button
            type="button"
            onClick={(event) => openBoardCreator(activeTeam.id, event)}
            className="flex h-10 flex-1 items-center justify-center rounded-sm border border-brand-primary/20 px-3 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          >
            + New board
          </button>
          <button
            type="button"
            onClick={openBoardEditor}
            aria-label="Edit board"
            title="Edit board"
            className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-brand-primary/20 text-text-muted hover:bg-brand-primary/5 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          >
            <Settings aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-screen-2xl gap-8">
        {isSidebarOpen && (
        <aside className="hidden w-52 shrink-0 lg:block" aria-label="Workspace navigation">
          <div className="sticky top-6 border-r border-brand-primary/15 pr-5">
            <div className="space-y-5">
              {teams.map((team) => {
                const teamBoards = boards.filter((board) => board.teamId === team.id);

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
                      {teamBoards.length === 0 && (
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
            </div>
            <button
              type="button"
              onClick={(event) => openBoardCreator(activeTeam.id, event)}
              className="mt-6 w-full rounded-sm border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              + New board
            </button>
          </div>
        </aside>
        )}

        <div className="min-w-0 flex-1">
      <nav className="mb-6 flex border-b border-brand-primary/15" aria-label="Board views" role="tablist">
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {anchors.map((anchor) => {
            const Icon = ANCHOR_DETAILS[anchor.id];
            const isEditing = editingAnchorId === anchor.id;

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
                        Save link
                      </button>
                      <button
                        type="button"
                        onClick={closeAnchorEditor}
                        className="rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      >
                        Cancel
                      </button>
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
                      className="rounded-md border border-brand-primary/20 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    >
                      {anchor.url ? 'Edit link' : 'Add link'}
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
              </article>
            );
          })}
          </div>
        </div>
      </details>
      )}

      {activeWorkspaceTab === 'board' && (
      <>
      <details className="group relative mb-6" aria-labelledby="filter-heading">
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
        <div className="absolute right-0 z-10 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-brand-primary/15 bg-surface-card p-4 shadow-lg">
          {hasActiveFilters && (
            <div className="mb-3 flex justify-end">
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
        </div>
        {hasActiveFilters && (
          <p className="mt-3 text-xs text-text-muted">
            Showing {visibleTasks.length} of {tasks.length} tasks. Clear filters to move tasks.
          </p>
        )}
        </div>
      </details>

      <DragDropContext onDragEnd={handleDragEnd}>
        <main id="board" className="mt-8 scroll-mt-6" aria-label="Kanban board">
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1080px] grid-cols-4 gap-6">
            {STAGES.map((stage) => {
              const stageTasks = visibleTasks.filter((task) => task.status === stage.id);

              return (
                <Droppable key={stage.id} droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <BoardColumn provided={provided} snapshot={snapshot} stage={stage}>
                      <header className="mb-4 flex items-center justify-between">
                        <h2
                          id={`${stage.id}-heading`}
                          className="text-sm font-semibold uppercase tracking-wide text-text-primary"
                        >
                          {stage.label}
                        </h2>
                        <TaskCount count={stageTasks.length} />
                      </header>

                      <div className="space-y-3">
                        {stageTasks.map((task, index) => {
                          const deadlineState = getDeadlineState(task.dueDate, task.status, currentTime);
                          const deadlineDetails = DEADLINE_DETAILS[deadlineState];
                          const dueDateClassName = deadlineState === 'neutral'
                            ? 'text-due-neutral'
                            : 'text-text-primary';

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={task.id}
                              index={index}
                              disableInteractiveElementBlocking
                              isDragDisabled={hasActiveFilters}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  aria-label={`${hasActiveFilters ? 'Edit' : 'Drag or edit'} ${task.title}`}
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
                                    className={`relative rounded-md border border-brand-primary/15 border-l-4 bg-surface-card shadow-sm transition-shadow duration-200 motion-reduce:transition-none ${
                                      dragSnapshot.isDragging
                                        ? 'scale-[1.02] cursor-grabbing shadow-xl'
                                        : 'hover:shadow-md'
                                    } ${deadlineDetails.cardClassName} ${TASK_TYPE_DETAILS[task.type].stripeClassName}`}
                                  >
                                    <div className="p-4 pr-12">
                                      <span className="flex flex-wrap items-start gap-2">
                                        <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-text-primary">
                                          {task.title}
                                        </span>
                                        <TaskTypeBadge type={task.type} />
                                      </span>
                                      <span className="mt-2 block text-sm leading-5 text-text-muted">
                                        {task.description}
                                      </span>
                                      <SubtaskProgress subtasks={subtasksByTask[task.id] ?? []} />
                                      <span className="mt-4 flex flex-col items-start gap-3 border-t border-brand-primary/10 pt-3 text-xs text-text-muted">
                                        <AssigneeBadge assignee={task.assignee} />
                                        <span className="flex flex-wrap items-center gap-2">
                                          <DeadlineIndicator state={deadlineState} />
                                          <span className="shrink-0">
                                            Due{' '}
                                            <span className={`font-medium ${dueDateClassName}`}>
                                              {task.dueDate ? (
                                                <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
                                              ) : 'No due date'}
                                            </span>
                                          </span>
                                        </span>
                                      </span>
                                    </div>
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute right-2 top-2 rounded p-1.5 text-text-muted"
                                    >
                                      <GripVertical aria-hidden="true" size={18} strokeWidth={2} />
                                    </span>
                                  </article>
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
        </main>
      </DragDropContext>
      </>
      )}
        </div>
      </div>

      <footer className="mx-auto mt-8 flex max-w-screen-2xl items-center justify-between gap-4 border-t border-brand-primary/15 py-5 text-sm text-text-muted">
        <span className="font-medium text-text-primary">{project.name}</span>
      </footer>
      </div>

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
                      Assignee
                    </label>
                    {editingTask && (
                      <p id="assignee-help" className="mt-1 text-xs text-text-muted">
                        {editingTask.assignee === UNASSIGNED
                          ? 'Currently unassigned.'
                          : `Currently assigned to ${editingTask.assignee}.`}
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

                <section aria-labelledby="subtasks-heading" className="rounded-md border border-brand-primary/15 bg-surface-page/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Break it down</p>
                      <h3 id="subtasks-heading" className="mt-1 text-base font-semibold text-text-primary">Subtasks</h3>
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

      {isProjectSettingsOpen && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProjectSettings();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-settings-title"
            className="w-full max-w-lg rounded-lg bg-surface-card p-6 shadow-xl"
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
                      <span>{member}</span>
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
          className="fixed inset-0 z-10 flex items-center justify-center bg-text-primary/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBoardCreator();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-board-title"
            className="w-full max-w-lg rounded-lg bg-surface-card p-6 shadow-xl"
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

              <div className="mt-5">
                <label htmlFor="board-team" className="block text-sm font-medium text-text-primary">Team</label>
                <select
                  id="board-team"
                  value={boardForm.teamId}
                  onChange={(event) => {
                    setBoardForm((current) => ({ ...current, teamId: event.target.value }));
                    if (boardError) setBoardError('');
                  }}
                  className="mt-1.5 w-full rounded-md border border-brand-primary/20 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                >
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>

              <fieldset className="mt-6 rounded-md border border-brand-primary/15 bg-surface-page/60 p-4">
                <legend className="px-1 text-sm font-medium text-text-primary">Board members</legend>
                <p className="mt-1 text-xs text-text-muted">Only selected people can be assigned tasks on this board.</p>
                <div className="mt-4 space-y-2">
                  {project.team.map((member) => (
                    <label key={member} className="flex cursor-pointer items-center gap-3 rounded-sm bg-surface-card px-3 py-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={boardForm.members.includes(member)}
                        onChange={() => toggleBoardMember(member)}
                        className="size-4 accent-current"
                      />
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
