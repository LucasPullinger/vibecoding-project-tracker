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

export function moveFilteredTask(tasks, visibleTasks, source, destination, stages) {
  if (!destination) return tasks;
  if (
    source.droppableId === destination.droppableId
    && source.index === destination.index
  ) {
    return tasks;
  }

  const sourceVisibleTasks = visibleTasks.filter((task) => task.status === source.droppableId);
  const movedTask = sourceVisibleTasks[source.index];
  if (!movedTask) return tasks;

  const tasksByStage = Object.fromEntries(
    stages.map((stage) => [
      stage.id,
      tasks.filter((task) => task.status === stage.id),
    ]),
  );
  const sourceTasks = tasksByStage[source.droppableId];
  const destinationTasks = tasksByStage[destination.droppableId];
  const sourceTaskIndex = sourceTasks.findIndex((task) => task.id === movedTask.id);

  sourceTasks.splice(sourceTaskIndex, 1);

  const destinationVisibleTasks = visibleTasks
    .filter((task) => task.status === destination.droppableId && task.id !== movedTask.id);
  const nextVisibleTask = destinationVisibleTasks[destination.index];
  const previousVisibleTask = destinationVisibleTasks[destination.index - 1];
  const destinationIndex = nextVisibleTask
    ? destinationTasks.findIndex((task) => task.id === nextVisibleTask.id)
    : previousVisibleTask
      ? destinationTasks.findIndex((task) => task.id === previousVisibleTask.id) + 1
      : destinationTasks.length;

  destinationTasks.splice(destinationIndex, 0, {
    ...movedTask,
    status: destination.droppableId,
  });

  return stages.flatMap((stage) => tasksByStage[stage.id]);
}
