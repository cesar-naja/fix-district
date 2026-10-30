import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";
type Size = "default" | "compact";

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  /** "compact" keeps a 44px minimum target for use inside the site header. */
  size?: Size;
  /** Use on charcoal backgrounds. */
  onDark?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 border-2 font-display font-bold uppercase transition-[background-color,color,transform] motion-safe:active:translate-y-px";

const sizes: Record<Size, string> = {
  default: "min-h-12 px-6 py-3 text-sm tracking-[0.14em]",
  compact:
    "min-h-11 whitespace-nowrap px-2.5 py-2 text-xs tracking-[0.06em] sm:px-4 sm:tracking-[0.12em]",
};

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
  size = "default",
  onDark = false,
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={`${base} ${sizes[size]} ${styles[onDark ? "dark" : "light"][variant]} ${className}`}
    />
  );
}
