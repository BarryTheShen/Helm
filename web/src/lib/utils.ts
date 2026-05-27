import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fields needed to derive a user-facing version label (FF4-VER-002). */
export type VersionLabelFields = {
  version_number: number;
  display_name: string;
  default_timestamp_name?: string | null;
  custom_name?: string | null;
  created_at?: string;
};

/** Primary label: timestamp or custom name — never v1/v2/v3 as the main text. */
export function getVersionPrimaryLabel(v: VersionLabelFields): string {
  if (v.custom_name?.trim()) return v.custom_name.trim();
  if (v.default_timestamp_name?.trim()) return v.default_timestamp_name.trim();

  const versionPrefix = `v${v.version_number} — `;
  if (v.display_name.startsWith(versionPrefix)) {
    return v.display_name.slice(versionPrefix.length);
  }
  if (v.display_name === `v${v.version_number}` && v.created_at) {
    return new Date(v.created_at).toLocaleString();
  }
  return v.display_name;
}

/** Dropdown / compact label: primary name with vN as secondary suffix. */
export function formatVersionOptionLabel(v: VersionLabelFields): string {
  return `${getVersionPrimaryLabel(v)} (v${v.version_number})`;
}
