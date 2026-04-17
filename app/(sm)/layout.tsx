import Link from "next/link";
import { requireRole } from "@/lib/session";

export default function SmLayout({ children }: { children: React.ReactNode }) {
  const user = requireRole(["sm_tm", "admin"]);
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-slate-900">
            Dealer Gift Scheme
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-slate-600">{user.name}</span>
            {user.role === "admin" && (
              <Link href="/admin" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Admin
              </Link>
            )}
            <Link href="/logout" className="text-sm text-slate-500 hover:text-slate-900">
              Log out
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
