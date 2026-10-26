import type { ProcessStep } from "@/lib/site";

/** Numbered repair steps. Semantic ordered list; numbers are decorative. */
export function ProcessList({
  steps,
  onDark = false,
}: {
  steps: readonly ProcessStep[];
  onDark?: boolean;
}) {
  return (
    <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className={`border-t-4 pt-5 ${onDark ? "border-accent-bright" : "border-accent"}`}
        >
          <span
            aria-hidden="true"
            className={`display block text-6xl ${onDark ? "text-accent-bright" : "text-accent"}`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3
            className={`mt-3 font-display text-xl font-bold leading-tight ${onDark ? "text-paper" : "text-ink"}`}
          >
            {step.title}
          </h3>
          <p className={`mt-3 text-base ${onDark ? "text-paper-dim" : "text-ink-soft"}`}>
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
