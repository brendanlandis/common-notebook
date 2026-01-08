import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "settings",
  description: "settings",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
