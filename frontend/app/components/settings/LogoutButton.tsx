"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/app/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        // The cache is keyed by URL, not by user. On a shared browser the next
        // person to log in would otherwise be handed the previous user's views
        // and worlds until each query happened to refetch.
        queryClient.clear();
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <Button onClick={handleLogout} id="logout-button" className="self-start">
      log out
    </Button>
  );
}
