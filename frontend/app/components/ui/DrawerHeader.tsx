import type { ReactNode } from "react";

/**
 * A drawer's top row: close or back on the left, the drawer's title on the
 * right. The title sits in the row rather than above the content to save the
 * vertical space. `mr-1.5` makes its right margin match its top margin (22px), as the
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
      {title && <h2 className="m-0 mr-1.5 text-right text-[1.75rem]">{title}</h2>}
    </div>
  );
}
