"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Logo, { BrandWord } from "@/components/Logo";
import RequireAuth from "@/components/RequireAuth";
import ProfileMenu from "@/components/ProfileMenu";
import OverviewTab from "@/components/tabs/OverviewTab";
import AccountTab from "@/components/tabs/AccountTab";
import SettingsTab from "@/components/tabs/SettingsTab";
import AdminTab from "@/components/tabs/AdminTab";

type TabKey = "overview" | "account" | "settings" | "admin";

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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "account", label: "Account" },
    { key: "settings", label: "Settings" },
    ...(isAdmin ? [{ key: "admin" as const, label: "Admin" }] : []),
  ];

  return (
    <div className="dash">
      <header className="topbar">
        <Link href="/app" className="brand"><Logo size={26} /><BrandWord /></Link>
        <div className="topbar__right">
          <Link href="/app" className="btn btn--ghost btn--sm">Editor</Link>
          <ProfileMenu />
        </div>
      </header>

      <div className="dash-shell">
        <nav className="dash-nav" aria-label="Dashboard sections">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={"dash-nav__btn" + (active === t.key ? " is-active" : "")} onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <main>
          {active === "overview" && <OverviewTab />}
          {active === "account" && <AccountTab />}
          {active === "settings" && <SettingsTab />}
          {active === "admin" && isAdmin && <AdminTab />}
        </main>
      </div>
    </div>
  );
}
