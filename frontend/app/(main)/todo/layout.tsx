import type { Metadata } from "next";
import TaskShell from "./components/TaskShell";

export const metadata: Metadata = {
  title: "to do",
  description: "to do",
};

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TaskShell>{children}</TaskShell>;
}
