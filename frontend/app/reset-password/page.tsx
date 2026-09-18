"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPage, AuthForm, AuthField } from "@/app/components/auth/Auth";
import Button from "@/app/components/Button";

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
      <AuthPage>
        <p>this reset link is missing its code.</p>
        <p>
          <a href="/forgot-password">request a new one</a>
        </p>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <AuthField
          id="password"
          label="new password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          disabled={isSubmitting}
          error={errors.password?.message}
        />
        <AuthField
          id="passwordConfirmation"
          label="confirm password"
          type="password"
          autoComplete="new-password"
          {...register("passwordConfirmation")}
          disabled={isSubmitting}
          error={errors.passwordConfirmation?.message}
        />

        {errorMessage && (
          <div className="error-message">{errorMessage.toLowerCase()}</div>
        )}

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "resetting..." : "set new password"}
          </Button>
        </div>
      </AuthForm>
    </AuthPage>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
