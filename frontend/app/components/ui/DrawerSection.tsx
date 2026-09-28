import type { ReactNode } from "react";

/**
 * One part of a drawer that holds settings or lists to work through: a label
 * heading where the part needs naming, what it's for where that needs saying,
 * and its controls. A rule sets each part off from the one above, with the
 * scale's largest step (64px) on either side of it; the first has none.
 */
export default function DrawerSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-heading border-t border-base-content/30 py-16 first:border-t-0 first:pt-0">
      {title && <h3 className="mt-0">{title}</h3>}
      {description && <p className="text-small opacity-75">{description}</p>}
      {children}
    </section>
  );
}
