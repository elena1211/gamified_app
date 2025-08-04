import StatsPanel from "../components/StatsPanel";
import TaskFetcher from "../components/TaskFetcher";

export default function Dashboard() {
  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <StatsPanel />
      <TaskFetcher />
    </div>
  );
}
