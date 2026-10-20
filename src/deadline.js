function parseDueDate(dueDate) {
  if (typeof dueDate !== 'string') return null;

  const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const deadline = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (
    deadline.getFullYear() !== year
    || deadline.getMonth() !== month - 1
    || deadline.getDate() !== day
  ) {
    return null;
  }

  return deadline;
}

export function getDeadlineState(dueDate, status, now = new Date()) {
  if (status === 'done' || dueDate === null) return 'neutral';

  const deadline = parseDueDate(dueDate);
  const currentTime = now.getTime();

  if (!deadline || Number.isNaN(currentTime)) return 'neutral';

  const remaining = deadline.getTime() - currentTime;
  const hours = 60 * 60 * 1000;

  if (remaining < 0) return 'overdue';
  if (remaining <= 24 * hours) return 'warning';
  if (remaining > 48 * hours) return 'safe';

  return 'neutral';
}
