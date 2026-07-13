import type { Metadata } from "next";
import { TodoDataProvider } from "./contexts/TodoDataContext";
import TodoForms from "./components/TodoForms";

export const metadata: Metadata = {
  title: "to do",
  description: "to do",
};

export default function TodoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TodoDataProvider>
      {children}
      <TodoForms />
    </TodoDataProvider>
  );
}

