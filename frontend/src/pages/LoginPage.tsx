import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state: { from?: string } | null };
  const from = location.state?.from ?? "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function useDemoCredentials() {
    setUsername("demo");
    setPassword("demo123");
  }

  return (
    <section className="mx-auto max-w-md py-12 animate-fade-up">
      <div className="panel space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400/70">
            Welcome back
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-slate-400">
            Demo account:&nbsp;
            <button
              type="button"
              onClick={useDemoCredentials}
              className="text-orange-300 underline decoration-dotted underline-offset-2 hover:text-orange-200"
            >
              demo / demo123
            </button>
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Username
            </span>
            <input
              className="input w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </span>
            <input
              type="password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </label>

          {error && (
            <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button type="submit" className="button w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          No account yet?{" "}
          <Link to="/register" className="text-orange-300 hover:text-orange-200">
            Register
          </Link>
        </p>
      </div>
    </section>
  );
}
