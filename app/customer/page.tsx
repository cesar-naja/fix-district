import type { Metadata } from "next";
import { Suspense } from "react";
import {
  DashboardFallback,
  DashboardFrame,
  EmptyState,
  ErrorState,
  PanelSection,
} from "@/components/dashboard/dashboard-frame";
import { RepairList } from "@/components/repairs/repair-list";
import { ButtonLink } from "@/components/ui/button-link";
import { requireRole } from "@/lib/auth/access";
import { loadMyRepairs } from "@/lib/repairs/server";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

async function CustomerDashboard() {
  // Enforced here, on the page itself, not only by navigation or the proxy.
  const { firstName } = await requireRole("customer");
  const repairs = await loadMyRepairs();

  return (
    <DashboardFrame
      eyebrow="Customer dashboard"
      title={firstName ? `Welcome, ${firstName}` : "Welcome"}
      intro="Request a repair and follow it here. Nothing is repaired until you approve it."
    >
      <PanelSection
        id="my-repairs"
        heading="My repairs"
        actions={<ButtonLink href="/customer/new">Request a repair</ButtonLink>}
      >
        {!repairs.ok ? (
          <ErrorState
            title="Couldn’t load your repairs"
            actions={
              <ButtonLink href="/customer" prefetch={false} variant="secondary">
                Try again
              </ButtonLink>
            }
          >
            <p>
              We couldn’t load your repair requests right now. This is a problem
              on our side, and it does not mean you have no repairs. Please try
              again in a moment.
            </p>
          </ErrorState>
        ) : repairs.data.items.length === 0 ? (
          <EmptyState title="No repairs yet">
            <p>
              You haven’t requested a repair. Tell us about your device and what
              is wrong, and your request will appear here.
            </p>
          </EmptyState>
        ) : (
          <RepairList
            list={repairs.data}
            basePath="/customer/repairs"
            label="My repair requests, newest first"
          />
        )}
      </PanelSection>
    </DashboardFrame>
  );
}

export default function CustomerPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <CustomerDashboard />
    </Suspense>
  );
}
