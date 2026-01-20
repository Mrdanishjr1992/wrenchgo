import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export type IconSource = 'Ionicons' | 'MaterialCommunityIcons';

export type CategoryIcon = {
  name: string;
  source: IconSource;
  emoji: string;
};

const categoryIconMap: Record<string, CategoryIcon> = {
  'Engine': {
    name: 'engine',
    source: 'MaterialCommunityIcons',
    emoji: '🔧',
  },
  'Engine Performance': {
    name: 'engine',
    source: 'MaterialCommunityIcons',
    emoji: '🔧',
  },
  'Engine & Fuel': {
    name: 'engine',
    source: 'MaterialCommunityIcons',
    emoji: '🔧',
  },
  'Fuel System': {
    name: 'water',
    source: 'Ionicons',
    emoji: '⛽',
  },
  'Transmission': {
    name: 'cog',
    source: 'Ionicons',
    emoji: '⚙️',
  },
  'Drivetrain': {
    name: 'car-traction-control',
    source: 'MaterialCommunityIcons',
    emoji: '🔗',
  },
  'Brakes': {
    name: 'hand-left',
    source: 'Ionicons',
    emoji: '🛑',
  },
  'Brake System': {
    name: 'hand-left',
    source: 'Ionicons',
    emoji: '🛑',
  },
  'Electrical': {
    name: 'flash',
    source: 'Ionicons',
    emoji: '⚡',
  },
  'Electrical & Charging': {
    name: 'flash',
    source: 'Ionicons',
    emoji: '⚡',
  },
  'Battery': {
    name: 'battery-charging',
    source: 'Ionicons',
    emoji: '🔋',
  },
  'Cooling System': {
    name: 'thermometer',
    source: 'Ionicons',
    emoji: '🌡️',
  },
  'Cooling': {
    name: 'thermometer',
    source: 'Ionicons',
    emoji: '🌡️',
  },
  'Suspension': {
    name: 'car-suspension',
    source: 'MaterialCommunityIcons',
    emoji: '🔩',
  },
  'Steering': {
    name: 'car-steering',
    source: 'MaterialCommunityIcons',
    emoji: '🎯',
  },
  'Steering & Suspension': {
    name: 'car-steering',
    source: 'MaterialCommunityIcons',
    emoji: '🎯',
  },
  'Suspension & Steering': {
    name: 'car-suspension',
    source: 'MaterialCommunityIcons',
    emoji: '🔩',
  },
  'HVAC': {
    name: 'snow',
    source: 'Ionicons',
    emoji: '❄️',
  },
  'Climate Control': {
    name: 'snow',
    source: 'Ionicons',
    emoji: '❄️',
  },
  'Air Conditioning': {
    name: 'snow',
    source: 'Ionicons',
    emoji: '❄️',
  },
  'Exhaust': {
    name: 'cloud',
    source: 'Ionicons',
    emoji: '💨',
  },
  'Exhaust & Emissions': {
    name: 'cloud',
    source: 'Ionicons',
    emoji: '💨',
  },
  'Emissions': {
    name: 'cloud',
    source: 'Ionicons',
    emoji: '💨',
  },
  'Tires': {
    name: 'car-tire-alert',
    source: 'MaterialCommunityIcons',
    emoji: '🛞',
  },
  'Wheels': {
    name: 'car-tire-alert',
    source: 'MaterialCommunityIcons',
    emoji: '🛞',
  },
  'Tires & Wheels': {
    name: 'car-tire-alert',
    source: 'MaterialCommunityIcons',
    emoji: '🛞',
  },
  'Wheels & Tires': {
    name: 'car-tire-alert',
    source: 'MaterialCommunityIcons',
    emoji: '🛞',
  },
  'Lights': {
    name: 'bulb',
    source: 'Ionicons',
    emoji: '💡',
  },
  'Lighting': {
    name: 'bulb',
    source: 'Ionicons',
    emoji: '💡',
  },
  'Body': {
    name: 'car',
    source: 'Ionicons',
    emoji: '🚗',
  },
  'Interior': {
    name: 'car-seat',
    source: 'MaterialCommunityIcons',
    emoji: '🪑',
  },
  'Maintenance': {
    name: 'build',
    source: 'Ionicons',
    emoji: '🧰',
  },
  'General Maintenance': {
    name: 'build',
    source: 'Ionicons',
    emoji: '🧰',
  },
  'Safety': {
    name: 'shield-checkmark',
    source: 'Ionicons',
    emoji: '🛡️',
  },
  'Safety Systems': {
    name: 'shield-checkmark',
    source: 'Ionicons',
    emoji: '🛡️',
  },
  'Other': {
    name: 'help-circle',
    source: 'Ionicons',
    emoji: '❓',
  },
  'Unknown': {
    name: 'help-circle',
    source: 'Ionicons',
    emoji: '❓',
  },
};

const DEFAULT_ICON: CategoryIcon = {
  name: 'construct',
  source: 'Ionicons',
  emoji: '🔧',
};

export function getCategoryIcon(category: string): CategoryIcon {
  const normalizedCategory = category.replace(/\s+/g, " ").trim();

  
  if (categoryIconMap[normalizedCategory]) {
    return categoryIconMap[normalizedCategory];
  }
  
  const lowerCategory = normalizedCategory.toLowerCase();
  const matchedKey = Object.keys(categoryIconMap).find(
    key => key.toLowerCase() === lowerCategory
  );

  if (matchedKey) {
    return categoryIconMap[matchedKey];
  }

  return DEFAULT_ICON;
}

export function getCategoryIconComponent(
  category: string,
  size: number = 24,
  color: string = '#000'
): React.ReactElement {
  const icon = getCategoryIcon(category);
  
  if (icon.source === 'Ionicons') {
    return React.createElement(Ionicons, { name: icon.name as any, size, color });
  } else {
    return React.createElement(MaterialCommunityIcons, { name: icon.name as any, size, color });
  }
}

export function getCategoryEmoji(category: string): string {
  return getCategoryIcon(category).emoji;
}

export function getAllMappedCategories(): string[] {
  return Object.keys(categoryIconMap);
}
