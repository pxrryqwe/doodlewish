"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-dw-bg">
      <p className="text-[14px] text-dw-gray">Loading…</p>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Sign-in failed");
      }
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-dw-bg px-5">
      <form
        onSubmit={submit}
        className="bg-dw-card rounded-card p-6 w-full max-w-[400px] flex flex-col gap-4"
      >
        <h1 className="font-bold text-[22px] text-dw-fg">Admin sign-in</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-dw-fg/20 rounded-card px-3 py-2 text-[14px] bg-white"
          placeholder="Password"
        />
        {error && <p className="text-red-500 text-[13px]">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="bg-dw-fg text-white rounded-card py-2 font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
