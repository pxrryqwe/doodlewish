"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }
  return (
    <button
      onClick={logout}
      className="text-[13px] text-dw-gray hover:text-dw-fg"
    >
      Logout
    </button>
  );
}
