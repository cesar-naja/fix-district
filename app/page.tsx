import type { Metadata } from "next";
import { WorkbenchScene } from "@/components/illustrations/workbench-scene";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { DeviceCard } from "@/components/ui/device-card";
import { ProcessList } from "@/components/ui/process-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { DEVICE_CATEGORIES, PROCESS_STEPS, SITE } from "@/lib/site";

export const metadata: Metadata = {
  // The root title template is not applied here, so use the full default title.
  title: { absolute: `${SITE.name} | Phone, laptop, tablet and console repair` },
  description:
    "Neighborhood repair for phones, laptops, tablets, and consoles. We diagnose first, explain in plain language, and only repair once you approve.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Devices />
      <Process />
      <Approach />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.3fr_0.7fr] lg:gap-10 lg:py-20">
        <div className="anim-rise">
          <p className="label text-accent">{SITE.tagline}</p>
          <h1
            id="hero-title"
            className="display mt-5 text-[3.6rem] sm:text-8xl lg:text-[4.5rem] xl:text-[5.5rem]"
          >
            Diagnosed first.
            <br />
            <span className="text-accent">
              Approved
              <br className="sm:hidden" /> by you.
            </span>
            <br />
            Fixed properly.
          </h1>
          <p className="prose-measure mt-8 text-xl text-ink-soft">
            Fix District is a neighborhood repair shop for phones, laptops,
            tablets, and consoles. We tell you what&rsquo;s wrong in plain language,
            and nothing gets repaired until you&rsquo;ve said yes.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/services">Explore services</ButtonLink>
            <ButtonLink href="/#process" variant="secondary">
              How repairs work
            </ButtonLink>
          </div>
        </div>

        <div className="anim-settle relative mx-auto w-full max-w-xl lg:max-w-none">
          <WorkbenchScene className="h-auto w-full drop-shadow-[0_24px_30px_rgba(28,27,25,0.22)]" />
          <p className="label absolute -bottom-3 left-4 bg-accent px-3 py-2 text-paper sm:left-6">
            Diagnose &middot; Approve &middot; Repair
          </p>
        </div>
      </Container>
    </section>
  );
}

function Devices() {
  return (
    <section
      aria-labelledby="devices-title"
      className="border-y border-line bg-paper-deep py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          eyebrow="What we repair"
          id="devices-title"
          title="Four kinds of device. One careful approach."
          intro="Whatever is on the bench, the process is the same: find the real fault, explain it clearly, and let you decide."
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DEVICE_CATEGORIES.map((device) => (
            <li key={device.id}>
              <DeviceCard device={device} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Process() {
  return (
    <section
      id="process"
      aria-labelledby="process-title"
      className="on-dark bg-ink py-20 text-paper sm:py-24"
    >
      <Container>
        <SectionHeading
          onDark
          eyebrow="How a repair works"
          id="process-title"
          title={"From \u201Cit\u2019s broken\u201D to \u201Cit\u2019s sorted\u201D"}
          intro="Five steps, and you are in the loop for every one of them. The decision to repair is always yours."
        />
        <div className="mt-14">
          <ProcessList steps={PROCESS_STEPS} onDark />
        </div>
      </Container>
    </section>
  );
}

function Approach() {
  return (
    <section aria-labelledby="approach-title" className="py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <SectionHeading
          eyebrow="Our approach"
          id="approach-title"
          title="No jargon. No surprises. No guessing."
          intro="We think a repair shop should earn trust the plain way: by being clear about what is wrong, careful about finding it, and straight with you before any work begins."
        />
        <div className="flex flex-wrap gap-4 lg:justify-end">
          <ButtonLink href="/about">About the shop</ButtonLink>
          <ButtonLink href="/services" variant="secondary">
            See all services
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
