/**
 * Single source of truth for public site content.
 * Pages and shared components read from here so copy and navigation stay in sync.
 *
 * Content rules for this file: no prices, turnaround promises, reviews,
 * certifications, addresses, or statistics unless the shop has confirmed them.
 */

export const SITE = {
  name: "Fix District",
  tagline: "Neighborhood electronics repair",
  description:
    "Fix District is a neighborhood repair shop for phones, laptops, tablets, and consoles. Careful diagnosis, clear communication, and your approval before any repair.",
} as const;

export type NavItem = { label: string; href: string };

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
];

export type DeviceId = "phones" | "laptops" | "tablets" | "consoles";

export type DeviceCategory = {
  id: DeviceId;
  name: string;
  /** One line used on cards. */
  summary: string;
  /** Longer description used on the services page. */
  description: string;
  /** Examples of problems people bring in. Diagnosis decides what applies. */
  commonProblems: readonly string[];
  /** What a diagnosis looks at for this category. */
  diagnosisFocus: readonly string[];
};

export const DEVICE_CATEGORIES: readonly DeviceCategory[] = [
  {
    id: "phones",
    name: "Phones",
    summary: "Screens, batteries, charging, and the everyday faults that stop a phone being useful.",
    description:
      "The device you carry everywhere is also the one most likely to get dropped, soaked, or worn out. We look at what is actually wrong before suggesting anything, so you only hear about repairs that make sense.",
    commonProblems: [
      "Cracked or unresponsive screen",
      "Battery that drains quickly or won’t hold a charge",
      "Charging that is slow, intermittent, or not working",
      "Speaker, microphone, or camera faults",
      "Liquid exposure",
    ],
    diagnosisFocus: ["Display and touch", "Battery and charging path", "Audio and cameras"],
  },
  {
    id: "laptops",
    name: "Laptops",
    summary: "Hardware faults, wear, and slowdowns, diagnosed properly before anything is replaced.",
    description:
      "A laptop that is slow, hot, or won’t start can have many different causes. We work through them in order, and explain what we find, so the repair you approve matches the actual fault.",
    commonProblems: [
      "Won’t power on or charge",
      "Damaged screen, hinge, or keyboard",
      "Overheating and loud fans",
      "Storage or memory problems",
      "Liquid exposure",
    ],
    diagnosisFocus: ["Power and charging", "Cooling and thermals", "Storage, memory, and display"],
  },
  {
    id: "tablets",
    name: "Tablets",
    summary: "Broken glass, tired batteries, and ports that have stopped doing their job.",
    description:
      "Tablets get used on sofas, in bags, and by kids, which means they take a lot of knocks. We check the whole device, not only the part you can see is broken.",
    commonProblems: [
      "Cracked glass or failed touch response",
      "Battery wear",
      "Charging port problems",
      "Buttons, speakers, or cameras not working",
      "Liquid exposure",
    ],
    diagnosisFocus: ["Screen and touch", "Battery and charging port", "Buttons, audio, and cameras"],
  },
  {
    id: "consoles",
    name: "Consoles",
    summary: "Game systems that won’t power on, overheat, or have lost a connection or port.",
    description:
      "Game consoles run hard and run hot. If yours has stopped starting, is overheating, or has lost a port, we trace the fault and tell you what it takes to put right.",
    commonProblems: [
      "No power or won’t start up",
      "Overheating or loud fan noise",
      "Video output or HDMI port faults",
      "Disc drive or storage issues",
      "Damaged connectors",
    ],
    diagnosisFocus: ["Power supply and startup", "Cooling", "Video output and ports"],
  },
];

export type ProcessStep = {
  title: string;
  body: string;
};

export const PROCESS_STEPS: readonly ProcessStep[] = [
  {
    title: "Tell us what’s wrong",
    body: "Describe what the device is doing, and what happened before it started. Details help us look in the right place first.",
  },
  {
    title: "We diagnose it",
    body: "We examine the device and find the cause, rather than guessing from the symptom.",
  },
  {
    title: "You hear the plan",
    body: "We explain what we found, what the repair involves, and what your options are, in plain language.",
  },
  {
    title: "You approve, then we repair",
    body: "Nothing gets repaired until you say yes. If you decide not to go ahead, that is a perfectly good outcome.",
  },
  {
    title: "We check it and hand it back",
    body: "We confirm the fault is fixed and walk you through what was done.",
  },
];

export type Principle = {
  title: string;
  body: string;
};

export const PRINCIPLES: readonly Principle[] = [
  {
    title: "Clear communication",
    body: "You should never need to decode a repair quote. We use plain words, say what we know and what we don’t, and keep you updated rather than leaving you wondering.",
  },
  {
    title: "Careful diagnosis",
    body: "The visible damage is not always the whole story. We find the actual cause before recommending a fix, so you aren’t paying to replace parts that were fine.",
  },
  {
    title: "Your approval comes first",
    body: "We explain the repair and you decide. No work begins on your device until you have agreed to it.",
  },
];
