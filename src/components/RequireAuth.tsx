"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Guards a page. Redirects to /login when there is no session; waits for the
// profile too, because a session without a profile can't use any data.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || !profile) return <div className="screen-center">loading…</div>;
  return <>{children}</>;
}
