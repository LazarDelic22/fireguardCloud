import type { PropsWithChildren } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flame-grad" x1="12" y1="18" x2="12" y2="2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f97316" />
          <stop offset="0.55" stopColor="#fb923c" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C10 5.5 9 8 11 11c-2 0-3.5-1.5-3.5-1.5C7 11 7 12.5 7 13c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.5-.5-2.5-1.5-3.5 0 0 0 2.5-2 2.5C14.5 9 14 5 12 2Z"
        fill="url(#flame-grad)"
      />
      <ellipse cx="12" cy="15" rx="1.8" ry="2.2" fill="#fed7aa" opacity="0.6" />
    </svg>
  );
}

export function Layout({ children }: PropsWithChildren) {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const navItems: { to: string; label: string; end?: boolean; protected?: boolean }[] = user
    ? [
        { to: "/", label: "Home", end: true },
        { to: "/dashboard", label: "Dashboard" },
        { to: "/map", label: "Map" },
        { to: "/history", label: "History" },
      ]
    : [{ to: "/", label: "Home", end: true }];

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-32 h-[520px] w-[520px] rounded-full bg-orange-600/10 blur-[130px]" />
        <div className="absolute -right-24 top-1/3 h-[420px] w-[420px] rounded-full bg-amber-500/8 blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-red-700/8 blur-[90px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-md shadow-orange-500/25 transition-shadow duration-300 group-hover:shadow-orange-500/50">
              <FlameIcon />
            </span>
            <div className="leading-none">
              <p className="text-[15px] font-semibold tracking-tight">FireGuard</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Cloud · MVP</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-orange-500/15 text-orange-300 border border-orange-500/20"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            <div className="mx-2 h-6 w-px bg-white/[0.08]" />

            {loading ? null : user ? (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-slate-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-medium">{user.username}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <NavLink
                  to="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                >
                  Sign in
                </NavLink>
                <NavLink
                  to="/register"
                  className="rounded-lg bg-orange-500/90 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-500/25"
                >
                  Register
                </NavLink>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
