import type { ApplicationStatus, DocType, RequestStatus, Sex, Submission, SubmissionStatus } from "../types";

/* ── Design tokens ─────────────────────────────────────────────── */
export type ColorScheme = "light" | "dark";

/** Fixed brand colors for the orange hero gradient; they look the same in both themes. */
export const BRAND = { orange: "#FF7043", orangeDeep: "#D84315" } as const;

/** Text on a white chip over a photo, which stays white in both themes. */
export const ON_PHOTO_TEXT = "#2C2C2A";

const LIGHT = {
  primary: "#FF7043",
  primaryLight: "#FFE8E3",
  primaryDark: "#D84315",

  secondary: "#FFB84D",
  secondaryLight: "#FFF3E0",
  secondaryDark: "#E69500",

  accent: "#4A90E2",
  accentLight: "#E3F2FD",
  accentDark: "#2E5C8A",

  success: "#2E9E5B",
  successLight: "#E6F6EC",
  warning: "#B26A00",
  warningLight: "#FFF3E0",
  error: "#D93025",
  errorLight: "#FDECEA",

  dark: "#2C2C2A",
  medium: "#76746D",
  light: "#C9C7BD",
  bg: "#F5F5F5",
  white: "#FFFFFF",
  border: "#E6E4DF",
  star: "#F59E0B",

  /** Dark promo / feature cards with white text. */
  ink: "#2C2C2A",
  /** Resting background of form inputs. */
  inputBg: "#FAFAF9",
  /** Unread rows, e.g. new notifications. */
  highlight: "#FFF8F5",
};

type Palette = typeof LIGHT;

/**
 * Dark theme. Token names keep their light-theme meaning: `white` is the card / surface color,
 * `dark` the main text color, `bg` the screen background, and `*Light` the soft tint behind
 * `*Dark` / accent text.
 */
const DARK: Palette = {
  primary: "#FF7A50",
  primaryLight: "#3A241C",
  primaryDark: "#FFAB91",

  secondary: "#FFB84D",
  secondaryLight: "#3A2E1A",
  secondaryDark: "#E69500",

  accent: "#5C9DEB",
  accentLight: "#1C2A3A",
  accentDark: "#9CC3F2",

  success: "#4CC38A",
  successLight: "#16301F",
  warning: "#F0A94B",
  warningLight: "#3A2C14",
  error: "#FF6B5E",
  errorLight: "#3A1C1A",

  dark: "#F2F1EE",
  medium: "#A9A7A0",
  light: "#5E5C57",
  bg: "#121212",
  white: "#1E1E1E",
  border: "#2E2D2A",
  star: "#F59E0B",

  ink: "#2A2622",
  inputBg: "#242424",
  highlight: "#2A1F1A",
};

/**
 * Active palette. Components read it while rendering, so switching themes swaps its values
 * (applyColorScheme) and remounts the screens (see contexts/ThemeContext.tsx).
 */
export const T: Palette & { scheme: ColorScheme } = { ...LIGHT, scheme: "light" };

export function applyColorScheme(scheme: ColorScheme) {
  if (T.scheme === scheme) return;
  Object.assign(T, scheme === "dark" ? DARK : LIGHT, { scheme });
}

export const FONT = "Roboto_400Regular";
export const FONT_MEDIUM = "Roboto_500Medium";
export const FONT_BOLD = "Roboto_700Bold";

/**
 * Drop shadow as a `boxShadow` style, which works on iOS, Android and web.
 * (React Native Web deprecates the old shadowColor / shadowOffset / ... props.)
 */
export function dropShadow(offsetY: number, blur: number, opacity: number, color = "#000") {
  return { boxShadow: `0px ${offsetY}px ${blur}px ${withAlpha(color, opacity)}` };
}

/** "#RGB" / "#RRGGBB" with an opacity as rgba(); other colors are returned unchanged. */
function withAlpha(color: string, opacity: number) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const shadow = dropShadow(2, 8, 0.08);

/* ── Localisation: Davao City districts ────────────────────────── */
export const DAVAO_DISTRICTS = [
  "Poblacion",
  "Talomo",
  "Agdao",
  "Buhangin",
  "Bunawan",
  "Paquibato",
  "Baguio",
  "Calinan",
  "Marilog",
  "Toril",
  "Tugbok",
] as const;

export const DEFAULT_LOCATION = "Davao City";

export function districtLocation(district: string) {
  return district === DEFAULT_LOCATION ? DEFAULT_LOCATION : `${district}, Davao City`;
}

export function districtOf(location: string | null | undefined): string | null {
  if (!location) return null;
  const first = location.split(",")[0].trim();
  return (DAVAO_DISTRICTS as readonly string[]).includes(first) ? first : null;
}

/* ── Verification documents (paper Figure 16) ──────────────────── */
export const DOC_TYPES: { type: DocType; label: string; short: string; required: boolean }[] = [
  { type: "vaccination", label: "Vaccination Card", short: "Vaccinated", required: true },
  { type: "health_clearance", label: "Veterinary Health Clearance", short: "Vet OK", required: false },
  { type: "pedigree", label: "Pedigree Certificate", short: "Pedigree", required: false },
  { type: "dna", label: "DNA / Genetic Test Result", short: "DNA", required: false },
];

export function docLabel(type: DocType) {
  return DOC_TYPES.find((d) => d.type === type)?.label ?? type;
}

export const TIER_DESCRIPTIONS = [
  "Not yet verified — upload a vaccination card to earn Tier 1.",
  "Tier 1 — vaccination card verified by a veterinarian.",
  "Tier 2 — vaccination and health clearance verified.",
  "Tier 3 — vaccination, health clearance and pedigree or DNA verified.",
];

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const SUBMISSION_STATUS: Record<SubmissionStatus, { label: string; tone: Tone }> = {
  owner_submitted: { label: "Owner Submitted", tone: "warning" },
  vet_verified: { label: "Veterinarian Verified", tone: "success" },
  verification_failed: { label: "Verification Failed", tone: "danger" },
};

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not Approved", tone: "danger" },
};

export function applicationStatus(v: { approved: boolean; reviewed_at: string | null }): ApplicationStatus {
  return v.approved ? "approved" : v.reviewed_at ? "rejected" : "pending";
}

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  completed: { label: "Completed", tone: "info" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/* ── Formatting ────────────────────────────────────────────────── */
/** Newest submission per document type, except that a verified one always wins. Input is newest-first. */
export function latestByType(submissions: Submission[]) {
  const map = new Map<DocType, Submission>();
  for (const s of submissions) {
    const current = map.get(s.submission_type);
    if (!current || (current.status !== "vet_verified" && s.status === "vet_verified")) {
      map.set(s.submission_type, s);
    }
  }
  return map;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", ...opts });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(iso);
}

export function formatAge(age: number) {
  if (age < 1) {
    const months = Math.round(age * 12);
    return `${months} mo${months === 1 ? "" : "s"}`;
  }
  return `${Number.isInteger(age) ? age : age.toFixed(1)} yr${age === 1 ? "" : "s"}`;
}

/** Breeding partners must be of the opposite sex. */
export function oppositeSex(sex: Sex): Sex {
  return sex === "male" ? "female" : "male";
}

export function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function initials(name: string) {
  return (
    name
      .replace(/^(dr\.?|dra\.?)\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}
