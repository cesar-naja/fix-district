import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/ui/container";
import { NavLinks } from "@/components/layout/nav-links";
import { NAV_ITEMS, SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
        <Link
          href="/"
          aria-label={`${SITE.name}, home`}
          className="-ml-1 rounded-sm p-1"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="-mr-3">
          <NavLinks items={NAV_ITEMS} />
        </nav>
      </Container>
    </header>
  );
}
