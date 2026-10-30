import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button-link";
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
        {/* On narrow screens this group drops to its own row: links left, account right. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:w-auto sm:justify-end sm:gap-x-8">
          <nav aria-label="Primary" className="-ml-2 sm:ml-0">
            <Suspense>
              <NavLinks items={NAV_ITEMS} />
            </Suspense>
          </nav>
          {/* Reserves the control's height while Clerk resolves the session. */}
          <div className="flex min-h-11 items-center">
            <Suspense fallback={<div aria-hidden="true" className="h-11 w-11" />}>
              <Show when="signed-out">
                <ButtonLink href="/sign-in" size="compact">
                  My account
                </ButtonLink>
              </Show>
              {/* /dashboard sends each user to the page for their role; the pages enforce access themselves. */}
              <Show when="signed-in">
                <div className="flex items-center gap-3">
                  <ButtonLink
                    href="/dashboard"
                    variant="secondary"
                    size="compact"
                  >
                    Dashboard
                  </ButtonLink>
                  <UserButton />
                </div>
              </Show>
            </Suspense>
          </div>
        </div>
      </Container>
    </header>
  );
}
