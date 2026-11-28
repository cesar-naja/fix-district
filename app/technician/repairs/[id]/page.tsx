import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  DashboardFallback,
  DashboardFrame,
  ErrorState,
  PanelSection,
} from "@/components/dashboard/dashboard-frame";
import { deviceName, referenceCode } from "@/components/repairs/format";
import { RepairDetailView } from "@/components/repairs/repair-detail";
import { StartReviewForm } from "@/components/repairs/start-review-form";
import { ButtonLink } from "@/components/ui/button-link";
import { requireRole } from "@/lib/auth/access";
import { loadRepairForTechnician } from "@/lib/repairs/server";
import { startReview } from "./actions";

export const metadata: Metadata = {
  title: "Repair request",
  robots: { index: false },
};

const back = (
  <ButtonLink href="/technician" variant="secondary">
    Back to repair queue
  </ButtonLink>
);

async function QueuedRepair({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("technician");
  const { id } = await params;
  const result = await loadRepairForTechnician(id);

  if (!result.ok) {
    return (
      <DashboardFrame
        eyebrow="Repair request"
        title="Couldn’t load this request"
        intro="Something went wrong on our side."
      >
        <PanelSection id="repair-error" heading="Request details" actions={back}>
          <ErrorState title="Try again">
            <p>
              We couldn’t load this repair request right now. Please reload the
              page in a moment.
            </p>
          </ErrorState>
        </PanelSection>
      </DashboardFrame>
    );
  }

  if (!result.data) notFound();

  const repair = result.data;
  const canStartReview = repair.status === "submitted";
  return (
    <DashboardFrame
      eyebrow={`Repair request · Ref ${referenceCode(repair.id)}`}
      title={deviceName(repair)}
      intro={
        canStartReview
          ? "Start the review to let the customer know the shop is looking at this request. Estimates and assignment are not available yet."
          : "This request is in review. Estimates and assignment are not available yet."
      }
    >
      <PanelSection id="repair-details" heading="Request details" actions={back}>
        <RepairDetailView
          repair={repair}
          statusControl={
            canStartReview ? (
              <StartReviewForm repairId={repair.id} action={startReview} />
            ) : null
          }
        />
      </PanelSection>
    </DashboardFrame>
  );
}

export default function QueuedRepairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <QueuedRepair params={params} />
    </Suspense>
  );
}
