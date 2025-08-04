import { useEffect, useState } from 'react';
import TaskCard from './TaskCard';

export default function TaskFetcher() {
  const [task, setTask] = useState(null);

  useEffect(() => {
    fetch('/mock-task.json')
      .then((res) => res.json())
      .then((data) => setTask(data))
      .catch((err) => console.error(err));
  }, []);

  if (!task) return <p>Loading...</p>;

  return <TaskCard task={task} />;
}
