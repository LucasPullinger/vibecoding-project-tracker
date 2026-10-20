const STATUS_LABELS = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'In Review',
  done: 'Done',
};

function formatType(type) {
  if (!type) return '';

  return `${type[0].toUpperCase()}${type.slice(1)}`;
}

export function formatTaskPrompt(task) {
  const context = typeof task.context === 'string' ? task.context : '';
  const taskDetails = [
    `Title: ${task.title || ''}`,
    ...(task.description ? [`Description: ${task.description}`] : []),
    `Type: ${formatType(task.type)}`,
    `Status: ${STATUS_LABELS[task.status] || task.status || ''}`,
    `Assigned to: ${task.assignee || ''}`,
    ...(task.dueDate ? [`Due date: ${task.dueDate}`] : []),
  ];

  return [
    '# Development Task',
    '',
    '## Task',
    ...taskDetails,
    '',
    '## Curated Context',
    context,
    '',
    '## Instructions',
    'Use the task description and curated context above',
    'to understand the current development requirements.',
    '',
    'Respect any technical decisions, constraints, and',
    'existing implementation details included in the context.',
    '',
    'Help complete the task without introducing unrelated',
    'changes.',
  ].join('\n');
}
