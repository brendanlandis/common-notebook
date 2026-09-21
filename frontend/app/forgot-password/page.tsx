"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { AuthPage, AuthForm, AuthField } from "@/app/components/auth/Auth";
import Button from "@/app/components/ui/Button";

const schema = z.object({
  email: z.email("enter a valid email"),
});

type ForgotInputs = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotInputs>({ resolver: zodResolver(schema) });

  const onSubmit: SubmitHandler<ForgotInputs> = async (data) => {
    setIsSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Forgot password error:", error);
    } finally {
      // Always claim success. Telling the user "no such account" would let
      // anyone check which addresses are registered.
      setSent(true);
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthPage>
        <p>if that email has an account, a reset link is on its way.</p>
        <p>
          <a href="/login">back to login</a>
        </p>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <AuthField
          id="email"
          label="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          disabled={isSubmitting}
          error={errors.email?.message}
        />

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "sending..." : "send reset link"}
          </Button>
        </div>
      </AuthForm>
    </AuthPage>
  );
}
