import { PieChart, pieClasses } from '@mui/x-charts/PieChart';

export default function StatusPieChart({ statusCounts }) {
  const colors = {
    todo: 'rgb(var(--color-due-neutral))',
    'in-progress': 'rgb(var(--color-type-feature))',
    review: 'rgb(var(--color-due-warning))',
    done: 'rgb(var(--color-due-safe))',
  };

  return (
    <PieChart
      aria-label={`Task status distribution: ${statusCounts.map(({ label, count }) => `${label} ${count}`).join(', ')}`}
      className="shrink-0"
      colors={statusCounts.map(({ id }) => colors[id])}
      height={172}
      hideLegend
      margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
      series={[{
        data: statusCounts.map(({ id, label, count }) => ({ id, label, value: count })),
        cornerRadius: 0,
        highlightScope: { fade: 'global', highlight: 'item' },
        outerRadius: 72,
        paddingAngle: 0,
      }]}
      sx={{ [`& .${pieClasses.arc}`]: { stroke: 'transparent', strokeWidth: 0 } }}
      width={172}
    />
  );
}
