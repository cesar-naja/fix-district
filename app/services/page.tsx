import type { Metadata } from "next";
import { DeviceIllustration } from "@/components/illustrations/device-illustration";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { DEVICE_CATEGORIES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Repair services for phones, laptops, tablets, and consoles, with careful diagnosis and your approval before any work begins.",
};

export default function ServicesPage() {
  return (
    <>
      <section aria-labelledby="services-title" className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <p className="label text-accent">Services</p>
          <h1
            id="services-title"
            className="display mt-4 text-6xl sm:text-8xl lg:text-9xl"
          >
            What we repair
          </h1>
          <p className="prose-measure mt-8 text-xl text-ink-soft">
            Fix District works on four kinds of device. For each, we start by
            finding out what is actually wrong, then explain it and wait for
            your decision.
          </p>
          <nav aria-label="Jump to a device type" className="mt-10">
            <ul className="flex flex-wrap gap-3">
              {DEVICE_CATEGORIES.map((device) => (
                <li key={device.id}>
                  <a
                    href={`#${device.id}`}
                    className="label inline-flex min-h-11 items-center border-2 border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-paper"
                  >
                    {device.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>

      {DEVICE_CATEGORIES.map((device, index) => (
        <section
          key={device.id}
          id={device.id}
          aria-labelledby={`${device.id}-title`}
          className={`border-b border-line py-16 sm:py-20 ${
            index % 2 === 1 ? "bg-paper-deep" : ""
          }`}
        >
          <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <DeviceIllustration
                device={device.id}
                className="h-auto w-full max-w-xs text-ink"
              />
              <p className="label mt-6 text-accent">
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(DEVICE_CATEGORIES.length).padStart(2, "0")}
              </p>
            </div>

            <div>
              <h2
                id={`${device.id}-title`}
                className="display text-6xl sm:text-7xl"
              >
                {device.name}
              </h2>
              <p className="prose-measure mt-6 text-lg text-ink-soft">
                {device.description}
              </p>

              <div className="mt-10 grid gap-10 sm:grid-cols-2">
                <div>
                  <h3 className="label text-accent">Problems people bring us</h3>
                  <ul className="mt-4 space-y-2">
                    {device.commonProblems.map((problem) => (
                      <li key={problem} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-[0.7em] h-[3px] w-4 shrink-0 bg-accent"
                        />
                        <span>{problem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="label text-accent">What diagnosis looks at</h3>
                  <ul className="mt-4 space-y-2">
                    {device.diagnosisFocus.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-[0.7em] h-[3px] w-4 shrink-0 bg-ink"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Container>
        </section>
      ))}

      <section
        aria-labelledby="services-note-title"
        className="on-dark bg-ink py-20 text-paper"
      >
        <Container className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <SectionHeading
            onDark
            eyebrow="Not on the list?"
            id="services-note-title"
            title="Every repair starts with a diagnosis"
            intro="These are examples, not limits. What your device needs depends on what is actually wrong with it, and we will explain that before any repair begins."
          />
          <div className="flex flex-wrap gap-4 lg:justify-end">
            <ButtonLink href="/#process" onDark>
              How repairs work
            </ButtonLink>
            <ButtonLink href="/about" variant="secondary" onDark>
              Our approach
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
