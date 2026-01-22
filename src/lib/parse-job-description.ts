export interface ParsedJobDescription {
  symptom?: {
    key?: string;
    label?: string;
  };
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    nickname?: string;
    vin?: string;
    license_plate?: string;
  };
  answers?: Record<string, string>;
  context?: {
    can_move?: boolean;
    location_type?: string;
    time_preference?: string;
    notes?: string;
  };
  raw?: string;
}

export function parseJobDescription(description: string | object | null | undefined): ParsedJobDescription | null {
  if (!description) return null;

  if (typeof description === 'object') {
    return description as ParsedJobDescription;
  }

  if (typeof description !== 'string') return null;

  const trimmed = description.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { raw: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) {
      return { raw: trimmed };
    }
    return parsed as ParsedJobDescription;
  } catch {
    return { raw: trimmed };
  }
}

export function formatVehicle(vehicle?: ParsedJobDescription['vehicle']): string | null {
  if (!vehicle) return null;
  const parts: string[] = [];
  if (vehicle.year) parts.push(String(vehicle.year));
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  if (parts.length === 0) return vehicle.nickname || null;
  const main = parts.join(' ');
  return vehicle.nickname ? `${main} (${vehicle.nickname})` : main;
}

export function formatAnswers(answers?: Record<string, string>): Array<{ key: string; value: string }> {
  if (!answers || typeof answers !== 'object') return [];
  return Object.entries(answers)
    .filter(([, v]) => v && typeof v === 'string')
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: v,
    }));
}

export function formatContext(context?: ParsedJobDescription['context']): Array<{ label: string; value: string }> {
  if (!context) return [];
  const items: Array<{ label: string; value: string }> = [];
  if (context.can_move !== undefined) {
    items.push({ label: 'Vehicle Can Move', value: context.can_move ? 'Yes' : 'No' });
  }
  if (context.location_type) {
    items.push({ label: 'Location Type', value: context.location_type.replace(/_/g, ' ') });
  }
  if (context.time_preference) {
    items.push({ label: 'Time Preference', value: context.time_preference });
  }
  if (context.notes) {
    items.push({ label: 'Notes', value: context.notes });
  }
  return items;
}
