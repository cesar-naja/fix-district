import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <Container className="py-24 sm:py-32">
      <p className="label text-accent">Error 404</p>
      <h1 className="display mt-4 text-6xl sm:text-8xl">Page not found</h1>
      <p className="prose-measure mt-8 text-xl text-ink-soft">
        We couldn’t find that page. It may have moved, or the address might have
        a typo.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href="/">Back to home</ButtonLink>
        <ButtonLink href="/services" variant="secondary">
          Browse services
        </ButtonLink>
      </div>
    </Container>
  );
}
