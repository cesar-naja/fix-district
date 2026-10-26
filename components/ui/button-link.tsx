import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  /** Use on charcoal backgrounds. */
  onDark?: boolean;
};

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 border-2 px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.14em] transition-[background-color,color,transform] motion-safe:active:translate-y-px";

const styles: Record<"light" | "dark", Record<Variant, string>> = {
  light: {
    primary:
      "border-accent bg-accent text-paper hover:border-ink hover:bg-ink",
    secondary: "border-ink text-ink hover:bg-ink hover:text-paper",
  },
  dark: {
    primary:
      "border-accent-bright bg-accent-bright text-ink hover:border-paper hover:bg-paper",
    secondary: "border-paper text-paper hover:bg-paper hover:text-ink",
  },
};

/**
 * A link styled as a button. Every instance must point somewhere real:
 * we only render actions that have a working destination.
 */
export function ButtonLink({
  variant = "primary",
  onDark = false,
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={`${base} ${styles[onDark ? "dark" : "light"][variant]} ${className}`}
    />
  );
}
