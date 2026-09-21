import type { ReactNode } from "react";

/** A drawer's top row: its actions on the left, close or back on the right. */
export default function DrawerHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-12 flex flex-row flex-nowrap items-center justify-between gap-4">
      {children}
    </div>
  );
}
