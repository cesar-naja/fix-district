# Fix District

Public website for Fix District, a neighborhood electronics-repair shop (phones, laptops, tablets, consoles).

This milestone is the public-facing foundation only: home, services, and about pages with shared layout and design system. Authentication, data storage, bookings, payments, and dashboards are intentionally not built yet.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build && npm start
```

> This project uses a recent Next.js with breaking changes from older versions. Before changing framework-level code, read `AGENTS.md` and the matching guide in `node_modules/next/dist/docs/`. `cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`.

## Structure

```
app/                 Routes: / , /services , /about , not-found, icon
  globals.css        Design tokens (Tailwind v4 @theme) and base styles
  layout.tsx         Fonts, metadata, skip link, header, footer
components/
  brand/             Wordmark and screw-head mark
  illustrations/     Hero workbench scene and device line art (inline SVG)
  layout/            SiteHeader, SiteFooter, NavLinks (the only client component)
  ui/                Container, ButtonLink, SectionHeading, DeviceCard, ProcessList
lib/site.ts          Site name, navigation, device categories, process steps, principles
```

## Conventions

- **Server Components by default.** The only client code is `components/layout/nav-links.tsx`, which reads the pathname to mark the current page.
- **Content lives in `lib/site.ts`.** Edit copy there, not in components.
- **Design tokens** (`paper`, `ink`, `accent`, …) are defined once in `app/globals.css`. Use the `display` class for headlines and `label` for small mono tags. Dark sections use `on-dark` so focus rings stay visible.
- **Honest content.** No invented prices, turnaround times, reviews, certifications, addresses, or statistics. Add them only once the shop has confirmed them.
- **Every visible action must work.** Do not add buttons or links for features that are not built. When booking or accounts arrive, add the destination first, then the link.
- **Motion** is gated behind `prefers-reduced-motion` (see the end of `globals.css`).
