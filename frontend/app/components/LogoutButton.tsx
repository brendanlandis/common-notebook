"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PlugsIcon } from "@phosphor-icons/react";

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Hide logout button on login page
  if (pathname === "/login") {
    return null;
  }

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
    <button
      onClick={handleLogout}
      aria-label="logout"
      id="logout-button"
      // tooltip-bottom shows it below the icon; --tt-trans is daisyUI's tooltip
      // X-translate (default -50% = centered) — nudge it right so the leftmost
      // icon's tooltip doesn't run off the drawer edge.
      className="tooltip tooltip-bottom [--tt-trans:calc(-50%_+_0.9rem)]"
      data-tip="logout"
    >
      <PlugsIcon size={25} weight="regular" />
    </button>
  );
}
