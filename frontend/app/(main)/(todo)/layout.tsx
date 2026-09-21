import type { Metadata } from "next";
import { TaskDataProvider } from "./contexts/TaskDataContext";
import TaskForms from "./components/TaskForms";

export const metadata: Metadata = {
  title: "to do",
  description: "to do",
};

// `(todo)` is a route group: it gives home, /view, /world and /project this
// layout without putting "todo" in their addresses.
export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TaskDataProvider>
      {children}
      <TaskForms />
    </TaskDataProvider>
  );
}
