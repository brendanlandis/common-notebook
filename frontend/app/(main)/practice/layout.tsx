import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "practice",
  description: "practice",
};

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

