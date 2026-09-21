import { TaskDataProvider } from "../contexts/TaskDataContext";
import TaskForms from "./TaskForms";

// Task data plus the shared add/edit forms drawer, for home and every /todo route.
export default function TaskShell({ children }: { children: React.ReactNode }) {
  return (
    <TaskDataProvider>
      {children}
      <TaskForms />
    </TaskDataProvider>
  );
}
