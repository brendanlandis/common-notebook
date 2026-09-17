import type { ComponentProps, ReactNode } from "react";

/**
 * The logged-out pages (login, register, forgot and reset password) share one
 * shape: a single centered column, labels carried by placeholders.
 */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      {children}
    </main>
  );
}

export function AuthForm(props: ComponentProps<"form">) {
  return <form className="flex flex-col items-center gap-4" {...props} />;
}

type AuthFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  /** Mark the field red without saying why, for errors the field already makes obvious. */
  quietError?: boolean;
};

/** Spread react-hook-form's `register()` into it; the ref reaches the input. */
export function AuthField({
  id,
  label,
  error,
  quietError = false,
  ...input
}: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        placeholder={label}
        aria-invalid={error ? true : undefined}
        className={error ? "input border-error" : "input"}
        {...input}
      />
      {error && (
        <div className={quietError ? "sr-only" : "mt-1 text-sm italic"}>
          {error}
        </div>
      )}
    </div>
  );
}
