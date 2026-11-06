"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { TopbarBrand } from "@/components/Logo";
import RequireAuth from "@/components/RequireAuth";
import ProfileMenu from "@/components/ProfileMenu";
import OverviewTab from "@/components/tabs/OverviewTab";
import AccountTab from "@/components/tabs/AccountTab";
import SettingsTab from "@/components/tabs/SettingsTab";
import AdminTab from "@/components/tabs/AdminTab";
import ContactTab from "@/components/tabs/ContactTab";

type TabKey = "overview" | "account" | "settings" | "admin" | "contact";
const TAB_KEYS: TabKey[] = ["overview", "account", "settings", "admin", "contact"];

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}

function DashboardInner() {
  const { isAdmin } = useAuth();
  const [active, setActive] = useState<TabKey>("overview");

  // /dashboard?tab=admin opens that tab directly (e.g. "Manage in Admin").
  // The admin tab is only honoured for admins.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
    if (wanted && TAB_KEYS.includes(wanted) && (wanted !== "admin" || isAdmin)) setActive(wanted);
  }, [isAdmin]);

  function selectTab(key: TabKey) {
    setActive(key);
    window.history.replaceState(null, "", key === "overview" ? "/dashboard" : `/dashboard?tab=${key}`);
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "account", label: "Account" },
    { key: "settings", label: "Settings" },
    ...(isAdmin ? [{ key: "admin" as const, label: "Admin" }] : []),
    { key: "contact", label: "Contact" },
  ];

  return (
    <div className="dash">
      <header className="topbar">
        <TopbarBrand />
        <div className="topbar__right">
          <Link href="/app" className="btn btn--ghost btn--sm topbar__nav">Editor</Link>
          <ProfileMenu />
        </div>
      </header>

      <div className="dash-shell">
        <nav className="dash-nav" aria-label="Dashboard sections">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={"dash-nav__btn" + (active === t.key ? " is-active" : "")} onClick={() => selectTab(t.key)}
              // iOS/Android swallow the first tap while text is selected, the page is
              // still scrolling or the keyboard is closing. pointerup still fires, so
              // switch on it (a swipe on the bar ends in pointercancel, not pointerup).
              onPointerUp={(e) => { if (e.pointerType !== "mouse") selectTab(t.key); }}>
              {t.label}
            </button>
          ))}
        </nav>
        <main>
          {active === "overview" && <OverviewTab />}
          {active === "account" && <AccountTab />}
          {active === "settings" && <SettingsTab />}
          {active === "admin" && isAdmin && <AdminTab />}
          {active === "contact" && <ContactTab />}
        </main>
      </div>
    </div>
  );
}
