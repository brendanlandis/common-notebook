"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPage, AuthForm, AuthField } from "@/app/components/auth/Auth";
import Button from "@/app/components/ui/Button";

const schema = z
  .object({
    code: z.string().min(1, "enter your invite code"),
    username: z.string().min(2, "pick a username"),
    email: z.email("enter a valid email"),
    password: z.string().min(8, "at least 8 characters"),
    passwordConfirmation: z.string().min(1, "confirm your password"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "passwords don't match",
    path: ["passwordConfirmation"],
  });

type RegisterInputs = z.infer<typeof schema>;

function RegisterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInputs>({
    resolver: zodResolver(schema),
    // Invite links look like /register?code=ABCDE-FGHIJ-KLMNO-PQRST
    defaultValues: { code: searchParams.get("code") ?? "" },
  });

  const onSubmit: SubmitHandler<RegisterInputs> = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/redeem-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: data.code,
          username: data.username,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(result.requiresLogin ? "/login" : "/");
      } else {
        setErrorMessage(result.error || "Could not create your account");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPage>
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <AuthField
          id="code"
          label="invite code"
          type="text"
          {...register("code")}
          disabled={isSubmitting}
          error={errors.code?.message}
        />
        <AuthField
          id="username"
          label="username"
          type="text"
          autoComplete="username"
          {...register("username")}
          disabled={isSubmitting}
          error={errors.username?.message}
        />
        <AuthField
          id="email"
          label="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          disabled={isSubmitting}
          error={errors.email?.message}
        />
        <AuthField
          id="password"
          label="password"
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
            {isSubmitting ? "creating account..." : "join"}
          </Button>
        </div>
      </AuthForm>
    </AuthPage>
  );
}

export default function RegisterPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
