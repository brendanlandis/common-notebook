import type { ReactNode } from "react";

/**
 * A drawer's top row: close or back on the left, the drawer's title on the
 * right. The title sits in the row rather than above the content to save the
 * vertical space. Its right margin matches its top margin inside the 2rem row, as the
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
    <div className="flex flex-row flex-nowrap items-center justify-between">
      {children}
      {title && <h2 className="m-0 mr-[calc((2rem-1em)/2)] text-right">{title}</h2>}
    </div>
  );
}
