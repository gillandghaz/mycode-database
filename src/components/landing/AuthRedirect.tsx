"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { hasAuthHint } from "@/lib/auth-hint";

// Sends signed-in users to /app. Used on the landing page, /login, /register.
// With the localStorage hint the redirect is instant; a stale hint is harmless
// because /app verifies the session itself and bounces back to /login.
export default function AuthRedirect({ cover = false }: { cover?: boolean }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/app");
    if (hasAuthHint()) router.replace("/app");
  }, [router]);

  // Wait for the profile: a brand-new account must finish creating it first.
  useEffect(() => {
    if (!loading && user && profile) router.replace("/app");
  }, [loading, user, profile, router]);

  if (cover && user) return <div className="lp-cover" aria-hidden="true" />;
  return null;
}
