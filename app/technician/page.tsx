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
import { loadRepairQueue } from "@/lib/repairs/server";

export const metadata: Metadata = {
  title: "Technician dashboard",
  robots: { index: false },
};

async function TechnicianDashboard() {
  // Enforced here, on the page itself. Customers get a 403, not an empty page.
  const { firstName } = await requireRole("technician");
  const queue = await loadRepairQueue();

  return (
    <DashboardFrame
      eyebrow="Technician dashboard"
      title={firstName ? `Welcome, ${firstName}` : "Welcome"}
      intro="Submitted repair requests appear here, newest first. This view is read-only for now."
    >
      <PanelSection id="repair-queue" heading="Repair queue">
        {!queue.ok ? (
          <ErrorState
            title="Couldn’t load the queue"
            actions={
              <ButtonLink href="/technician" prefetch={false} variant="secondary">
                Try again
              </ButtonLink>
            }
          >
            <p>
              We couldn’t load the repair queue right now. This does not mean it
              is empty. Please try again in a moment.
            </p>
          </ErrorState>
        ) : queue.data.items.length === 0 ? (
          <EmptyState title="Queue is empty">
            <p>
              No repair requests have been submitted yet. New requests from
              customers will appear here.
            </p>
          </EmptyState>
        ) : (
          <RepairList
            list={queue.data}
            basePath="/technician/repairs"
            label="Repair queue, newest first"
          />
        )}
      </PanelSection>
    </DashboardFrame>
  );
}

export default function TechnicianPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <TechnicianDashboard />
    </Suspense>
  );
}
