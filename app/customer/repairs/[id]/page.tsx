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
import { ButtonLink } from "@/components/ui/button-link";
import { requireRole } from "@/lib/auth/access";
import { loadMyRepair } from "@/lib/repairs/server";

export const metadata: Metadata = {
  title: "Repair request",
  robots: { index: false },
};

const back = (
  <ButtonLink href="/customer" variant="secondary">
    Back to My repairs
  </ButtonLink>
);

async function MyRepair({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("customer");
  const { id } = await params;
  const result = await loadMyRepair(id);

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

  // Missing and not-yours look identical: both are a plain 404.
  if (!result.data) notFound();

  const repair = result.data;
  return (
    <DashboardFrame
      eyebrow={`Repair request · Ref ${referenceCode(repair.id)}`}
      title={deviceName(repair)}
      intro="This is the request you submitted. A technician can see it."
    >
      <PanelSection id="repair-details" heading="Request details" actions={back}>
        <RepairDetailView repair={repair} />
      </PanelSection>
    </DashboardFrame>
  );
}

export default function MyRepairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <MyRepair params={params} />
    </Suspense>
  );
}
