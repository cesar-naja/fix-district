import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardFallback } from "@/components/dashboard/dashboard-frame";
import { requireUser } from "@/lib/auth/access";
import { DASHBOARD_PATH } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

/** Authenticated entry point: sends each user to the dashboard for their role. */
async function DashboardRedirect() {
  const { role } = await requireUser();
  return redirect(DASHBOARD_PATH[role]);
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardRedirect />
    </Suspense>
  );
}
