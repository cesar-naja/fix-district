import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  DashboardFallback,
  DashboardFrame,
  PanelSection,
} from "@/components/dashboard/dashboard-frame";
import { RepairRequestForm } from "@/components/repairs/repair-request-form";
import { requireRole } from "@/lib/auth/access";
import { submitRepairRequest } from "./actions";

export const metadata: Metadata = {
  title: "Request a repair",
  robots: { index: false },
};

async function NewRepairRequest() {
  await requireRole("customer");
  // The key below differs on every render, so this must run at request time.
  await connection();
  // One key per rendered form. If a submission is retried (double click, slow
  // network, resubmitted after an error) the server saves it only once.
  const requestKey = randomUUID();

  return (
    <DashboardFrame
      eyebrow="Customer dashboard"
      title="Request a repair"
      intro="Tell us about your device and what is wrong. A technician will see your request, and nothing is repaired until you approve it."
    >
      <PanelSection id="request-form" heading="Your device">
        <RepairRequestForm requestKey={requestKey} action={submitRepairRequest} />
      </PanelSection>
    </DashboardFrame>
  );
}

export default function NewRepairRequestPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <NewRepairRequest />
    </Suspense>
  );
}
