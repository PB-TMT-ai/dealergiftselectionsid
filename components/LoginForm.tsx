"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Keep in sync with RetailerBrowser.tsx STORAGE_KEY.
const RETAILER_FILTERS_STORAGE_KEY = "retailerBrowser.filters.v1";

export function LoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? "Login failed");
        return;
      }
      // A fresh login must not inherit the previous user's dropdown filters.
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(RETAILER_FILTERS_STORAGE_KEY);
        } catch {
          // Ignore storage access errors.
        }
      }
      router.replace(body.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-1.5">
          PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="input text-center text-2xl tracking-[0.5em] font-medium"
          placeholder="••••"
          required
        />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" disabled={loading || pin.length < 4} className="btn-primary w-full">
        {loading ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
