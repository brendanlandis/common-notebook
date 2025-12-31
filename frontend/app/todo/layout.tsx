import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "to do",
  description: "to do",
};

export default function TodoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

