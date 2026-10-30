import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

/**
 * Clerk appearance, mapped onto the Fix District tokens in app/globals.css.
 * Uses Clerk's supported `variables` and `elements` options only. Branding,
 * the development-mode badge, validation, focus, and loading styling are
 * left to Clerk. Colour pairings (checked against WCAG AA):
 *   paper (#f5f0e6) on accent (#b03a12) 5.3:1 · accent on card 5.6:1
 *   ink (#1c1b19) on card 15+:1 · muted (#5e5a51) on card 6.3:1
 *   input border (#8a8374) on card 3.5:1
 */
const ACCENT = "#b03a12";
const PAPER = "#f5f0e6";
const CARD = "#fbf8f1";
const INK = "#1c1b19";
const MUTED = "#5e5a51";
const LINE = "#cfc7b4";
const FIELD_BORDER = "#8a8374";

/** Footer link copy: registration stays reachable from the sign-in form. */
export const clerkLocalization: ComponentProps<typeof ClerkProvider>["localization"] = {
  signIn: {
    start: {
      actionText: "New to Fix District?",
      actionLink: "Create an account",
    },
  },
  signUp: {
    start: {
      actionText: "Already have an account?",
      actionLink: "Sign in",
    },
  },
};

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: ACCENT,
    colorPrimaryForeground: PAPER,
    colorForeground: INK,
    colorMutedForeground: MUTED,
    colorBackground: CARD,
    colorInput: "#ffffff",
    colorInputForeground: INK,
    colorNeutral: INK,
    colorBorder: LINE,
    colorRing: ACCENT,
    colorDanger: "#b3261e",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-archivo), var(--font-geist-sans), sans-serif",
    borderRadius: "0.125rem",
  },
  elements: {
    cardBox: { boxShadow: "none", border: `1px solid ${LINE}` },
    headerTitle: {
      fontFamily: "var(--font-archivo), var(--font-geist-sans), sans-serif",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.02em",
    },
    formFieldLabel: { fontWeight: 600 },
    formFieldInput: { borderColor: FIELD_BORDER },
    formButtonPrimary: {
      border: `2px solid ${ACCENT}`,
      backgroundImage: "none",
      boxShadow: "none !important",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      minHeight: "2.75rem",
      "&:hover, &:focus-visible": {
        backgroundColor: INK,
        borderColor: INK,
        color: PAPER,
      },
    },
    socialButtonsBlockButton: { minHeight: "2.75rem" },
    footerActionLink: {
      color: ACCENT,
      fontWeight: 600,
      textDecoration: "underline",
      "&:hover": { color: INK },
    },
    // Keeps the avatar trigger at a 44px minimum target next to the nav.
    userButtonTrigger: {
      minWidth: "2.75rem",
      minHeight: "2.75rem",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
  },
};
