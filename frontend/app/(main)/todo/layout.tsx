import type { Metadata } from "next";
import { TaskDataProvider } from "./contexts/TaskDataContext";
import TaskForms from "./components/TaskForms";

export const metadata: Metadata = {
  title: "to do",
  description: "to do",
};

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

