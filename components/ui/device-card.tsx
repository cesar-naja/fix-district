import Link from "next/link";
import { DeviceIllustration } from "@/components/illustrations/device-illustration";
import type { DeviceCategory } from "@/lib/site";

/** Linked summary card for a device category. Links to its services anchor. */
export function DeviceCard({ device }: { device: DeviceCategory }) {
  return (
    <Link
      href={`/services#${device.id}`}
      className="group flex h-full flex-col border-2 border-ink bg-paper p-6 transition-colors hover:bg-ink hover:text-paper motion-safe:transition-transform motion-safe:hover:-translate-y-1"
    >
      <DeviceIllustration
        device={device.id}
        className="h-28 w-full text-ink transition-colors group-hover:text-paper"
      />
      <h3 className="display mt-6 text-4xl">{device.name}</h3>
      <p className="mt-3 flex-1 text-ink-soft transition-colors group-hover:text-paper-dim">
        {device.summary}
      </p>
      <span className="label mt-6 inline-flex items-center gap-2 text-accent transition-colors group-hover:text-accent-bright">
        View details
        <span className="sr-only"> for {device.name}</span>
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}
