"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/site";

/**
 * Primary navigation links. This is the only part of the header that needs
 * client code: it reads the pathname to mark the current page.
 */
export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-0.5 sm:gap-2">
      {items.map((item) => {
        const isCurrent =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={`label inline-flex min-h-11 items-center border-b-2 px-2 py-2 sm:px-3 transition-colors ${
                isCurrent
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
