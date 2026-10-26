import type { Metadata } from "next";
import { WorkbenchScene } from "@/components/illustrations/workbench-scene";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { PRINCIPLES, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fix District is a neighborhood repair shop built on clear communication, careful diagnosis, and customer approval before any repair.",
};

export default function AboutPage() {
  return (
    <>
      <section aria-labelledby="about-title" className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="label text-accent">About {SITE.name}</p>
            <h1
              id="about-title"
              className="display mt-4 text-6xl sm:text-8xl lg:text-9xl"
            >
              Repair you can follow
            </h1>
            <p className="prose-measure mt-8 text-xl text-ink-soft">
              {SITE.name} is a neighborhood repair shop for phones, laptops,
              tablets, and consoles. The idea is simple: a repair should never
              feel like a mystery. You should know what is wrong, what it takes
              to fix, and that the decision is yours.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="mx-auto w-full max-w-md lg:max-w-none"
          >
            <WorkbenchScene className="h-auto w-full" />
          </div>
        </Container>
      </section>

      <section aria-labelledby="principles-title" className="py-20 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="How we work"
            id="principles-title"
            title="Three things we hold to"
          />
          <ol className="mt-12 grid gap-px border-2 border-ink bg-ink lg:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <li key={principle.title} className="bg-paper p-8">
                <span
                  aria-hidden="true"
                  className="display block text-6xl text-accent"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="display mt-4 text-4xl">{principle.title}</h3>
                <p className="mt-4 text-ink-soft">{principle.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section
        aria-labelledby="approval-title"
        className="on-dark bg-ink py-20 text-paper sm:py-24"
      >
        <Container className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <SectionHeading
            onDark
            eyebrow="The promise at the center"
            id="approval-title"
            title="Nothing is repaired until you say so"
            intro="After we diagnose your device, we explain what we found and what the repair involves. You then choose whether to go ahead. If you decide not to, that is a perfectly good outcome, and you will still have a clear answer about what was wrong."
          />
          <div className="flex flex-wrap gap-4 lg:justify-end">
            <ButtonLink href="/#process" onDark>
              See the repair steps
            </ButtonLink>
            <ButtonLink href="/services" variant="secondary" onDark>
              What we repair
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
