"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <main id="register-page">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="code">invite code</label>
          <input
            id="code"
            type="text"
            {...register("code")}
            disabled={isSubmitting}
            placeholder="invite code"
          />
          {errors.code && <div className="error">{errors.code.message}</div>}
        </div>

        <div>
          <label htmlFor="username">username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            {...register("username")}
            disabled={isSubmitting}
            placeholder="username"
          />
          {errors.username && (
            <div className="error">{errors.username.message}</div>
          )}
        </div>

        <div>
          <label htmlFor="email">email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            disabled={isSubmitting}
            placeholder="email"
          />
          {errors.email && <div className="error">{errors.email.message}</div>}
        </div>

        <div>
          <label htmlFor="password">password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            disabled={isSubmitting}
            placeholder="password"
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
            {isSubmitting ? "creating account..." : "join"}
          </button>
        </div>
      </form>
    </main>
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
