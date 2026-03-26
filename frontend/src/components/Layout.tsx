import type { PropsWithChildren } from "react";
import { Link, NavLink } from "react-router-dom";

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950">
              F
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">FireGuard</p>
              <p className="text-xs text-slate-400">Risk intelligence prototype</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`
              }
            >
              History
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}

