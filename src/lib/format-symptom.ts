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

  // Check if title is JSON
  if (title.startsWith("{") || title.startsWith("[")) {
    try {
      const parsed = JSON.parse(title);
      // Handle array - take first element
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!obj) return "Service Request";

      // Extract symptom key from various possible structures
      const symptomKey =
        obj?.symptom_key ||
        obj?.symptom?.key ||
        obj?.symptom ||
        obj?.key ||
        obj?.title ||
        obj?.name;

      if (symptomKey && typeof symptomKey === "string") {
        return isRawSymptomKey(symptomKey) ? formatSymptomKey(symptomKey) : symptomKey;
      }

      // Fallback to any string value in the object
      for (const val of Object.values(obj)) {
        if (typeof val === "string" && val.length > 0 && val.length < 100) {
          return isRawSymptomKey(val) ? formatSymptomKey(val) : val;
        }
      }
    } catch {
      // Not valid JSON, continue
    }
  }

  if (isRawSymptomKey(title)) {
    return formatSymptomKey(title);
  }
  return title;
}