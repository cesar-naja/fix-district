import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/** Neutral placeholder shown while the session and role are resolved. */
export function DashboardFallback() {
  return (
    <Container className="py-16 sm:py-24">
      <p role="status" className="label text-ink-soft">
        Loading your dashboard…
      </p>
    </Container>
  );
}

type DashboardFrameProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

/** Shared page structure for the role dashboards. */
export function DashboardFrame({
  eyebrow,
  title,
  intro,
  children,
}: DashboardFrameProps) {
  return (
    <>
      <section aria-labelledby="dashboard-title" className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <p className="label text-accent">{eyebrow}</p>
          <h1
            id="dashboard-title"
            className="display mt-4 break-words text-5xl sm:text-7xl"
          >
            {title}
          </h1>
          <p className="prose-measure mt-6 text-xl text-ink-soft">{intro}</p>
        </Container>
      </section>
      {children}
    </>
  );
}

type PanelSectionProps = {
  id: string;
  heading: string;
  /** Optional actions shown beside the heading. */
  actions?: ReactNode;
  children: ReactNode;
};

/** A titled dashboard section. */
export function PanelSection({ id, heading, actions, children }: PanelSectionProps) {
  return (
    <section aria-labelledby={id} className="py-16 sm:py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id={id} className="display text-4xl sm:text-5xl">
            {heading}
          </h2>
          {actions}
        </div>
        <div className="mt-8">{children}</div>
      </Container>
    </section>
  );
}

type StateProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

/** An honest empty state: nothing to show, and nothing is wrong. */
export function EmptyState({ title, children, actions }: StateProps) {
  return (
    <div className="border-2 border-ink bg-paper p-8 sm:p-10">
      <p className="label text-accent">{title}</p>
      <div className="prose-measure mt-3 space-y-3 text-ink-soft">{children}</div>
      {actions ? <div className="mt-6 flex flex-wrap gap-4">{actions}</div> : null}
    </div>
  );
}

/** A failed load. Never rendered as an empty list. */
export function ErrorState({ title, children, actions }: StateProps) {
  return (
    <div role="alert" className="border-2 border-accent bg-white p-8 sm:p-10">
      <p className="label text-accent">{title}</p>
      <div className="prose-measure mt-3 space-y-3 text-ink">{children}</div>
      {actions ? <div className="mt-6 flex flex-wrap gap-4">{actions}</div> : null}
    </div>
  );
}
