import type { ReactNode } from "react";

/**
 * A drawer's top row: close or back on the left, the drawer's title on the
 * right. The title sits in the row rather than above the content to save the
 * vertical space. Its right margin matches its top margin inside the 40px row, as the
 * main menu's rightmost button does.
 */
export default function DrawerHeader({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-row flex-nowrap items-center justify-between gap-4">
      {children}
      {title && <h2 className="m-0 mr-[calc((2.5rem-1em)/2)] text-right">{title}</h2>}
    </div>
  );
}
