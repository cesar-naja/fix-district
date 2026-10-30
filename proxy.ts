import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * First line of defence: signed-out visitors never reach these routes (they
 * get a real redirect to sign-in before anything renders). Roles are NOT
 * checked here; they need a Clerk Backend API call, so each page and server
 * operation enforces them through lib/auth/access.ts.
 */
const isSignedInOnly = createRouteMatcher([
  "/dashboard(.*)",
  "/customer(.*)",
  "/technician(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isSignedInOnly(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
