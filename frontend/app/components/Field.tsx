import type { ReactNode } from "react";

/** A form control with its label above it. */
export default function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm">
        {label}
      </label>
      {children}
    </div>
  );
}
