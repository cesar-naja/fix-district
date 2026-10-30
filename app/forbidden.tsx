import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Access denied",
};

export default function Forbidden() {
  return (
    <Container className="py-24 sm:py-32">
      <p className="label text-accent">Error 403</p>
      <h1 className="display mt-4 text-6xl sm:text-8xl">Access denied</h1>
      <p className="prose-measure mt-8 text-xl text-ink-soft">
        Your account does not have access to that page.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href="/dashboard">Go to my dashboard</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}
