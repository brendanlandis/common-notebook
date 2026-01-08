"use client";

import { useRouter, usePathname } from "next/navigation";
import { PlugsIcon } from "@phosphor-icons/react";

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

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
      className="tooltip"
      data-tip="logout"
    >
      <PlugsIcon size={30} weight="regular" />
    </button>
  );
}
