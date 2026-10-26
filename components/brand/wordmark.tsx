type WordmarkProps = {
  /** "dark" renders for use on charcoal backgrounds. */
  tone?: "light" | "dark";
  className?: string;
};

/**
 * Fix District wordmark: a slotted screw head beside a stacked
 * FIX / DISTRICT lockup. Pure markup, so it works in Server Components.
 * The accessible name comes from the surrounding link, so the mark is hidden.
 */
export function Wordmark({ tone = "light", className = "" }: WordmarkProps) {
  const text = tone === "dark" ? "text-paper" : "text-ink";
  const sub = tone === "dark" ? "text-paper-dim" : "text-ink-soft";
  const accent = tone === "dark" ? "text-accent-bright" : "text-accent";

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <ScrewMark className={`h-10 w-10 shrink-0 ${accent}`} />
      <span className="flex flex-col leading-none">
        <span className={`display text-[1.9rem] ${text}`}>Fix</span>
        <span
          className={`mt-[3px] font-display text-[0.7rem] font-bold uppercase tracking-[0.32em] ${sub}`}
          style={{ fontStretch: "100%" }}
        >
          District
        </span>
      </span>
    </span>
  );
}

/** A slotted screw head: the brand mark. Uses currentColor for the accent. */
export function ScrewMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="24" cy="24" r="22" fill="currentColor" />
      <circle cx="24" cy="24" r="17" fill="none" stroke="#f5f0e6" strokeOpacity="0.35" strokeWidth="1.5" />
      <rect
        x="9"
        y="21"
        width="30"
        height="6"
        rx="1.5"
        fill="#f5f0e6"
        transform="rotate(-35 24 24)"
      />
    </svg>
  );
}
