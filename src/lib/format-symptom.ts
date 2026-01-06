/**
 * Converts a symptom key like "elec_alternator_not_charging" to a readable label
 * "Alternator Not Charging"
 */
export function formatSymptomKey(key: string): string {
  if (!key) return "Service Request";
  
  // Remove common prefixes
  let cleaned = key
    .replace(/^(elec_|eng_|brake_|trans_|susp_|cool_|fuel_|ac_|start_)/, "")
    .replace(/_/g, " ");
  
  // Title case
  return cleaned
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Checks if a title looks like a raw symptom key
 */
export function isRawSymptomKey(title: string): boolean {
  return /^[a-z]+_[a-z_]+$/.test(title);
}

/**
 * Returns a display-friendly title, formatting raw keys if needed
 */
export function getDisplayTitle(title: string | null | undefined): string {
  if (!title) return "Service Request";
  if (isRawSymptomKey(title)) {
    return formatSymptomKey(title);
  }
  return title;
}
