import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  /** Heading element id, for aria-labelledby on the parent section. */
  id?: string;
  onDark?: boolean;
  className?: string;
};

/** Eyebrow label, display headline, and optional intro paragraph. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
  onDark = false,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className={`label ${onDark ? "text-accent-bright" : "text-accent"}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={`display mt-3 text-5xl sm:text-6xl ${onDark ? "text-paper" : "text-ink"}`}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={`prose-measure mt-5 text-lg ${onDark ? "text-paper-dim" : "text-ink-soft"}`}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}
