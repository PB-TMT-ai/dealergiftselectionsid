import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@components/LoginForm";

export default function LoginPage() {
  const s = getSession();
  if (s) redirect(s.role === "admin" ? "/admin" : "/dashboard");
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-8 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Dealer Gift Scheme</h1>
          <p className="mt-1 text-sm text-slate-600">Q4 — enter your PIN to continue</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-xs text-slate-400 text-center">Internal tool • JSW One</p>
      </div>
    </main>
  );
}
