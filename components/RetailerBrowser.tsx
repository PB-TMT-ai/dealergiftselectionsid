"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPoints } from "@/lib/format";

const STORAGE_KEY = "retailerBrowser.filters.v1";
const FETCH_DEBOUNCE_MS = 300;

interface Row {
  sf_id: string;
  retailer_name: string;
  distributor_name: string | null;
  state_name: string | null;
  zone: string | null;
  earned_points: number;
  points_used: number;
  balance: number;
  gifts_summary: string;
}

interface FilterRow {
  zone: string | null;
  state: string | null;
  distributor: string | null;
}

interface Props {
  filterSource: FilterRow[];
}

type HasSel = "" | "true" | "false";

export function RetailerBrowser({ filterSource }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [state, setState] = useState("");
  const [distributor, setDistributor] = useState("");
  const [hasSel, setHasSel] = useState<HasSel>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const limit = 50;

  // Restore filters from sessionStorage on mount so they survive navigation
  // to a retailer page and back. Only "Clear all" or a fresh login wipes them.
  // The fetch effect is gated on `hydrated` so the grid doesn't render a
  // "no-filter" snapshot before the saved filters apply.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") {
      setHydrated(true);
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          name?: string;
          zone?: string;
          state?: string;
          distributor?: string;
          hasSel?: HasSel;
        };
        if (typeof saved.name === "string") setName(saved.name);
        if (typeof saved.zone === "string") setZone(saved.zone);
        if (typeof saved.state === "string") setState(saved.state);
        if (typeof saved.distributor === "string") setDistributor(saved.distributor);
        if (saved.hasSel === "" || saved.hasSel === "true" || saved.hasSel === "false") {
          setHasSel(saved.hasSel);
        }
      }
    } catch {
      // Ignore malformed storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name, zone, state, distributor, hasSel })
      );
    } catch {
      // Storage may be unavailable (private mode, quota); silently skip.
    }
  }, [hydrated, name, zone, state, distributor, hasSel]);

  // Cascading options: each level only shows values present in rows matching the prior selections.
  const zoneOptions = useMemo(
    () => uniqSorted(filterSource.map((r) => r.zone)),
    [filterSource]
  );
  const stateOptions = useMemo(
    () =>
      uniqSorted(
        filterSource
          .filter((r) => !zone || r.zone === zone)
          .map((r) => r.state)
      ),
    [filterSource, zone]
  );
  const distributorOptions = useMemo(
    () =>
      uniqSorted(
        filterSource
          .filter((r) => (!zone || r.zone === zone) && (!state || r.state === state))
          .map((r) => r.distributor)
      ),
    [filterSource, zone, state]
  );

  // If a parent selection makes the child invalid, clear the child.
  useEffect(() => {
    if (state && !stateOptions.includes(state)) setState("");
  }, [state, stateOptions]);
  useEffect(() => {
    if (distributor && !distributorOptions.includes(distributor)) setDistributor("");
  }, [distributor, distributorOptions]);

  // Changing any filter resets paging to the first page in the same tick —
  // prevents a second render+fetch from an isolated "reset offset" effect.
  const changeFilter = useCallback(<T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setOffset(0);
  }, []);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (name) p.set("name", name);
    if (distributor) p.set("distributor", distributor);
    if (state) p.set("state", state);
    if (zone) p.set("zone", zone);
    if (hasSel) p.set("hasSelections", hasSel);
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    return p.toString();
  }, [name, distributor, state, zone, hasSel, offset]);

  // Request-id guard + AbortController: ignore any late response whose id
  // isn't the current one, and cancel in-flight requests on new input. This
  // is what prevents the "stale response wins" UX where the dropdown looks
  // broken on slow networks.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    const myId = ++requestIdRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/retailers?${qs}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (res.status === 401) {
          // Session expired mid-session; bounce to login instead of silently
          // leaving the grid stuck.
          router.replace("/");
          return;
        }
        if (!res.ok) {
          if (myId === requestIdRef.current) {
            setError("Couldn't load retailers.");
          }
          return;
        }
        const body = await res.json();
        // Only the latest-issued request is allowed to commit state.
        if (myId !== requestIdRef.current) return;
        if (offset === 0) setRows(body.rows ?? []);
        else setRows((prev) => [...prev, ...(body.rows ?? [])]);
        setTotal(body.total ?? 0);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (myId === requestIdRef.current) {
          setError("Network error. Please retry.");
        }
      } finally {
        if (myId === requestIdRef.current) setLoading(false);
      }
    }, FETCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [hydrated, qs, offset, router, retryTick]);

  function reset() {
    setName(""); setZone(""); setState(""); setDistributor(""); setHasSel("");
    setOffset(0);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore.
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            className="input sm:col-span-2"
            placeholder="Search retailer…"
            value={name}
            onChange={(e) => changeFilter(setName)(e.target.value)}
          />
          <select
            className="input"
            value={zone}
            onChange={(e) => changeFilter(setZone)(e.target.value)}
          >
            <option value="">All zones</option>
            {zoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select
            className="input"
            value={state}
            onChange={(e) => changeFilter(setState)(e.target.value)}
          >
            <option value="">
              {zone ? `All states in ${zone}` : "All states"}
            </option>
            {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="input"
            value={distributor}
            onChange={(e) => changeFilter(setDistributor)(e.target.value)}
          >
            <option value="">
              {state ? `All distributors in ${state}` : zone ? `All distributors in ${zone}` : "All distributors"}
            </option>
            {distributorOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="hasSel"
              checked={hasSel === ""}
              onChange={() => changeFilter(setHasSel)("")}
            />
            <span>All</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="hasSel"
              checked={hasSel === "true"}
              onChange={() => changeFilter(setHasSel)("true")}
            />
            <span>With selections</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="hasSel"
              checked={hasSel === "false"}
              onChange={() => changeFilter(setHasSel)("false")}
            />
            <span>Without selections</span>
          </label>
          <button onClick={reset} className="ml-auto text-sm text-slate-500 hover:text-slate-900">Clear all</button>
        </div>
      </div>

      <div className="text-sm text-slate-600">
        {loading && rows.length === 0 ? "Loading…" : `${total} retailer${total === 1 ? "" : "s"}`}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            className="text-sm font-medium text-red-700 underline"
            onClick={() => setRetryTick((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <Link
            key={r.sf_id}
            href={`/retailer/${encodeURIComponent(r.sf_id)}`}
            className="card p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-slate-900 truncate">{r.retailer_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {r.zone ?? "—"} · {r.state_name ?? "—"} · {r.distributor_name ?? "—"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <BalanceBar earned={r.earned_points} used={r.points_used} />
              <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                <span>Used {formatPoints(r.points_used)}</span>
                <span>Balance {formatPoints(r.balance)}</span>
              </div>
            </div>
            {r.gifts_summary && (
              <p className="mt-3 text-xs text-slate-600 line-clamp-2">🎁 {r.gifts_summary}</p>
            )}
          </Link>
        ))}
      </div>

      {rows.length < total && (
        <button
          className="btn-secondary w-full"
          onClick={() => setOffset((o) => o + limit)}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function uniqSorted(arr: (string | null)[]): string[] {
  return [...new Set(arr.filter((x): x is string => !!x))].sort();
}

function BalanceBar({ earned, used }: { earned: number; used: number }) {
  const pct = earned ? Math.min(100, (used / earned) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
    </div>
  );
}
