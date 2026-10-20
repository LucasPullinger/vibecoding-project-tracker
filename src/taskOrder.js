export function moveTask(tasks, source, destination, stages) {
  if (!destination) return tasks;
  if (
    source.droppableId === destination.droppableId
    && source.index === destination.index
  ) {
    return tasks;
  }

  const tasksByStage = Object.fromEntries(
    stages.map((stage) => [
      stage.id,
      tasks.filter((task) => task.status === stage.id),
    ]),
  );
  const sourceTasks = tasksByStage[source.droppableId];
  const destinationTasks = tasksByStage[destination.droppableId];
  const [movedTask] = sourceTasks.splice(source.index, 1);

  if (!movedTask) return tasks;

  if (source.droppableId === destination.droppableId) {
    sourceTasks.splice(destination.index, 0, movedTask);
  } else {
    destinationTasks.splice(destination.index, 0, {
      ...movedTask,
      status: destination.droppableId,
    });
  }

  return stages.flatMap((stage) => tasksByStage[stage.id]);
}
