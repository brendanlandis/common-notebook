import type { Metadata } from "next";
import TaskShell from "./todo/components/TaskShell";
import DefaultView from "./todo/components/DefaultView";

export const metadata: Metadata = {
  title: "to do",
  description: "to do",
};

// Home is the to-do list's default view. It sits outside /todo, so it mounts
// the task data and forms that todo/layout.tsx gives every /todo route.
export default function HomePage() {
  return (
    <TaskShell>
      <DefaultView />
    </TaskShell>
  );
}
