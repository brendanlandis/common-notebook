import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "review",
  description: "review",
};

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
