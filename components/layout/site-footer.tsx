import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/ui/container";
import { DEVICE_CATEGORIES, NAV_ITEMS, SITE } from "@/lib/site";

const linkClass =
  "inline-flex min-h-11 items-center text-paper-dim underline-offset-4 transition-colors hover:text-paper hover:underline";

export function SiteFooter() {
  return (
    <footer className="on-dark bg-ink text-paper">
      <Container className="grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link
            href="/"
            aria-label={`${SITE.name}, home`}
            className="inline-block rounded-sm p-1 -ml-1"
          >
            <Wordmark tone="dark" />
          </Link>
          <p className="mt-5 max-w-sm text-paper-dim">
            {SITE.tagline} for phones, laptops, tablets, and consoles.
            Diagnosed carefully, explained clearly, and repaired only with your
            approval.
          </p>
        </div>

        <nav aria-label="Site pages">
          <h2 className="label text-accent-bright">Explore</h2>
          <ul className="mt-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/#process" className={linkClass}>
                How repairs work
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Devices we repair">
          <h2 className="label text-accent-bright">Devices</h2>
          <ul className="mt-3">
            {DEVICE_CATEGORIES.map((device) => (
              <li key={device.id}>
                <Link href={`/services#${device.id}`} className={linkClass}>
                  {device.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-sm text-paper-dim sm:flex-row sm:items-center sm:justify-between">
          <p>© {SITE.name}</p>
          <p>
            Sign in to request a repair online. Estimates, payments, and status
            updates are not available yet.
          </p>
        </Container>
      </div>
    </footer>
  );
}
