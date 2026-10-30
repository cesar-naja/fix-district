import type { ReactNode } from "react";
import type { RepairDetail } from "@/lib/repairs/types";
import {
  deviceName,
  deviceTypeLabel,
  formatSubmitted,
  referenceCode,
  statusLabel,
} from "@/components/repairs/format";

/** Read-only view of one repair request. */
export function RepairDetailView({ repair }: { repair: RepairDetail }) {
  const facts: { term: string; value: ReactNode }[] = [
    { term: "Status", value: statusLabel(repair) },
    { term: "Device type", value: deviceTypeLabel(repair) },
    { term: "Brand", value: repair.brand },
    { term: "Model", value: repair.model },
    {
      term: "Submitted",
      value: (
        <time dateTime={repair.createdAt}>{formatSubmitted(repair.createdAt)}</time>
      ),
    },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <dl className="grid h-fit gap-px border-2 border-ink bg-ink">
        {facts.map((fact) => (
          <div key={fact.term} className="bg-paper p-5">
            <dt className="label text-muted">{fact.term}</dt>
            <dd className="mt-1 font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h2 className="display text-3xl sm:text-4xl">Problem description</h2>
        <p className="mt-2 label text-muted">
          {deviceName(repair)} · Ref {referenceCode(repair.id)}
        </p>
        <p className="prose-measure mt-5 whitespace-pre-wrap break-words text-lg">
          {repair.description}
        </p>
      </div>
    </div>
  );
}
