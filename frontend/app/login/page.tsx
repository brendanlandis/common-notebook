"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";

const schema = z.object({
  identifier: z.string().min(1, "enter a username"),
  password: z.string().min(1, "enter a password"),
});

type LoginInputs = z.infer<typeof schema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInputs>({
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<LoginInputs> = async (data) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setRemainingAttempts(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to admin dashboard
        router.push("/admin");
      } else {
        setErrorMessage(result.error || "Login failed");
        if (typeof result.remaining === "number") {
          setRemainingAttempts(result.remaining);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="login-page">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="identifier">user or email</label>
          <input
            id="identifier"
            type="text"
            {...register("identifier")}
            disabled={isSubmitting}
            placeholder="user or email"
          />
          {errors.identifier && (
            <div className="error">{errors.identifier.message}</div>
          )}
        </div>

        <div>
          <label htmlFor="password">password</label>
          <input
            id="password"
            type="password"
            {...register("password")}
            disabled={isSubmitting}
            placeholder="password"
          />
          {errors.password && (
            <div className="error">{errors.password.message}</div>
          )}
        </div>

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
            {remainingAttempts !== null && remainingAttempts > 0 && (
              <span> ({remainingAttempts} attempts remaining)</span>
            )}
          </div>
        )}
        <div>
          <button className="btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "logging in..." : "duh"}
          </button>
        </div>
      </form>
    </main>
  );
}
