import type { Metadata } from "next";
import "@/app/css/rich-text.css";

export const metadata: Metadata = {
  title: "notes",
  description: "notes",
};

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

