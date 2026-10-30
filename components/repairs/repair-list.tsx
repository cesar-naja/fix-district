import Link from "next/link";
import type { RepairList as RepairListData } from "@/lib/repairs/types";
import {
  deviceName,
  deviceTypeLabel,
  formatSubmitted,
  referenceCode,
  statusLabel,
} from "@/components/repairs/format";
import { LIST_LIMIT } from "@/lib/repairs/schema";

type Props = {
  list: RepairListData;
  /** Where each request's details live, e.g. "/customer/repairs". */
  basePath: string;
  /** Accessible name for the list. */
  label: string;
};

/** Newest-first list of repair requests. Renders only fields the DTO exposes. */
export function RepairList({ list, basePath, label }: Props) {
  return (
    <div>
      <ul aria-label={label} className="grid gap-px border-2 border-ink bg-ink">
        {list.items.map((repair) => (
          <li
            key={repair.id}
            className="grid gap-3 bg-paper p-6 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div>
              <p className="label text-muted">
                {deviceTypeLabel(repair)} · Ref {referenceCode(repair.id)}
              </p>
              <h3 className="mt-1 text-xl font-bold">
                <Link
                  href={`${basePath}/${repair.id}`}
                  className="underline decoration-2 underline-offset-4 hover:text-accent"
                >
                  {deviceName(repair)}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                Submitted{" "}
                <time dateTime={repair.createdAt}>
                  {formatSubmitted(repair.createdAt)}
                </time>
              </p>
            </div>
            <p className="label inline-block justify-self-start border-2 border-ink px-3 py-1.5 sm:justify-self-end">
              {statusLabel(repair)}
            </p>
          </li>
        ))}
      </ul>
      {list.hasMore ? (
        <p className="mt-4 text-ink-soft">
          Showing the {LIST_LIMIT} most recent requests.
        </p>
      ) : null}
    </div>
  );
}
