import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  fetchMe,
  getStoredToken,
  login as loginApi,
  register as registerApi,
  setStoredToken,
  type UserRecord,
} from "../api/client";

type AuthCtx = {
  user: UserRecord | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then((u) => {
        if (mounted) setUser(u);
      })
      .catch(() => {
        // Token invalid or expired — wipe it.
        setStoredToken(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function doLogin(username: string, password: string) {
    const result = await loginApi(username, password);
    setStoredToken(result.access_token);
    setUser(result.user);
  }

  async function doRegister(username: string, password: string) {
    const result = await registerApi(username, password);
    setStoredToken(result.access_token);
    setUser(result.user);
  }

  function doLogout() {
    setStoredToken(null);
    setUser(null);
  }

  return (
    <Ctx.Provider
      value={{ user, loading, login: doLogin, register: doRegister, logout: doLogout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
