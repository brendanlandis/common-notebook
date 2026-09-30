import { Suspense } from "react";
import type { Metadata } from "next";
import { PracticeFormsProvider } from "./components/PracticeForms";

export const metadata: Metadata = {
  title: "practice",
  description: "practice",
};

// The subject on screen comes from the address (`?subject=`), which Next reads
// with useSearchParams — so the page and its drawer sit inside a Suspense
// boundary, as that hook requires.
export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <PracticeFormsProvider>{children}</PracticeFormsProvider>
    </Suspense>
  );
}
