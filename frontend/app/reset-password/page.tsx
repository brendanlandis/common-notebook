"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const schema = z
  .object({
    password: z.string().min(8, "at least 8 characters"),
    passwordConfirmation: z.string().min(1, "confirm your password"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "passwords don't match",
    path: ["passwordConfirmation"],
  });

type ResetInputs = z.infer<typeof schema>;

function ResetForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Strapi's email links to `${email_reset_password}?code=<token>`.
  const code = searchParams.get("code");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetInputs>({ resolver: zodResolver(schema) });

  const onSubmit: SubmitHandler<ResetInputs> = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...data }),
      });

      const result = await response.json();

      if (result.success) {
        // Resetting the password revokes every other session, and the response
        // logs this browser back in.
        router.push(result.requiresLogin ? "/login" : "/");
      } else {
        setErrorMessage(result.error || "Could not reset your password");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!code) {
    return (
      <main id="reset-password-page">
        <p>this reset link is missing its code.</p>
        <p>
          <a href="/forgot-password">request a new one</a>
        </p>
      </main>
    );
  }

  return (
    <main id="reset-password-page">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="password">new password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            disabled={isSubmitting}
            placeholder="new password"
          />
          {errors.password && (
            <div className="error">{errors.password.message}</div>
          )}
        </div>

        <div>
          <label htmlFor="passwordConfirmation">confirm password</label>
          <input
            id="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            {...register("passwordConfirmation")}
            disabled={isSubmitting}
            placeholder="confirm password"
          />
          {errors.passwordConfirmation && (
            <div className="error">{errors.passwordConfirmation.message}</div>
          )}
        </div>

        {errorMessage && (
          <div className="error-message">{errorMessage.toLowerCase()}</div>
        )}

        <div>
          <button className="btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "resetting..." : "set new password"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
