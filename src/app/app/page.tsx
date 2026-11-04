"use client";

import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import Ide from "@/components/ide/Ide";

export default function AppPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="screen-center">loading…</div>}>
        <Ide />
      </Suspense>
    </RequireAuth>
  );
}
