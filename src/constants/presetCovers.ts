import { GroupCoverPhoto } from '../types';

export interface PresetCoverItem {
  id: string;
  title: string;
  category: PresetCategory;
  imageUrl: string;
  thumbnailUrl: string;
}

export type PresetCategory =
  | 'All'
  | 'Travel'
  | 'Nature'
  | 'Home'
  | 'Food'
  | 'Friends'
  | 'Beach'
  | 'Gradients'
  | 'Abstract';

export const PRESET_CATEGORIES: PresetCategory[] = [
  'All',
  'Home',
  'Travel',
  'Nature',
  'Food',
  'Friends',
  'Beach',
  'Gradients',
  'Abstract',
];

export const PRESET_COVERS: PresetCoverItem[] = [
  // ── Home & Family (Matching Splitwise "Home Sweet Home" screenshot) ─────────
  {
    id: 'cozy-home',
    title: 'Autumn Cottage',
    category: 'Home',
    imageUrl:
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'living-room',
    title: 'Modern Living',
    category: 'Home',
    imageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'front-porch',
    title: 'Suburban Porch',
    category: 'Home',
    imageUrl:
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'kitchen-table',
    title: 'Dining Room',
    category: 'Home',
    imageUrl:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=60',
  },

  // ── Travel & Mountains (Matching Splitwise "Tuscany trip" screenshot) ──────
  {
    id: 'tuscany-hills',
    title: 'Tuscany Sunset',
    category: 'Travel',
    imageUrl:
      'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'mountain-alps',
    title: 'Alpine Sunrise',
    category: 'Travel',
    imageUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'scenic-road',
    title: 'Mountain Road Trip',
    category: 'Travel',
    imageUrl:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'nordic-fjord',
    title: 'Nordic Fjord',
    category: 'Travel',
    imageUrl:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=60',
  },

  // ── Nature & Forests ────────────────────────────────────────────────────────
  {
    id: 'autumn-trees',
    title: 'Autumn Canopy',
    category: 'Nature',
    imageUrl:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'misty-pine',
    title: 'Misty Pine Forest',
    category: 'Nature',
    imageUrl:
      'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'lush-bamboo',
    title: 'Bamboo Grove',
    category: 'Nature',
    imageUrl:
      'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'wildflower-meadow',
    title: 'Wildflower Meadow',
    category: 'Nature',
    imageUrl:
      'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=300&q=60',
  },

  // ── Food & Dining ───────────────────────────────────────────────────────────
  {
    id: 'cozy-cafe',
    title: 'Cozy Cafe Patio',
    category: 'Food',
    imageUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'friends-dinner',
    title: 'Feast with Friends',
    category: 'Food',
    imageUrl:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'bbq-picnic',
    title: 'Summer BBQ & Picnic',
    category: 'Food',
    imageUrl:
      'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'brunch-table',
    title: 'Weekend Brunch',
    category: 'Food',
    imageUrl:
      'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=300&q=60',
  },

  // ── Friends & Celebrations ──────────────────────────────────────────────────
  {
    id: 'campfire',
    title: 'Campfire Gathering',
    category: 'Friends',
    imageUrl:
      'https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'rooftop-sunset',
    title: 'Rooftop Gathering',
    category: 'Friends',
    imageUrl:
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'celebration-sparkler',
    title: 'Golden Sparklers',
    category: 'Friends',
    imageUrl:
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=300&q=60',
  },

  // ── Beach & Holidays ────────────────────────────────────────────────────────
  {
    id: 'tropical-beach',
    title: 'Tropical Turquoise Bay',
    category: 'Beach',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'coastal-sunset',
    title: 'Sunset Cliffs',
    category: 'Beach',
    imageUrl:
      'https://images.unsplash.com/photo-1519046904884-53103b34b271?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1519046904884-53103b34b271?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'paradise-pier',
    title: 'Tranquil Ocean Pier',
    category: 'Beach',
    imageUrl:
      'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=300&q=60',
  },

  // ── Minimal Gradients ───────────────────────────────────────────────────────
  {
    id: 'gradient-emerald',
    title: 'Emerald Forest Mesh',
    category: 'Gradients',
    imageUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'gradient-sunset',
    title: 'Sunset Twilight Mesh',
    category: 'Gradients',
    imageUrl:
      'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'gradient-midnight',
    title: 'Midnight Royal Blue',
    category: 'Gradients',
    imageUrl:
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'gradient-sage',
    title: 'Sage Mint & Cream',
    category: 'Gradients',
    imageUrl:
      'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=300&q=60',
  },

  // ── Abstract Backgrounds ────────────────────────────────────────────────────
  {
    id: 'abstract-prism',
    title: 'Prism Refraction',
    category: 'Abstract',
    imageUrl:
      'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'abstract-terrazzo',
    title: 'Modern Terrazzo',
    category: 'Abstract',
    imageUrl:
      'https://images.unsplash.com/photo-1604076913837-52ab5629fba9?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1604076913837-52ab5629fba9?auto=format&fit=crop&w=300&q=60',
  },
  {
    id: 'abstract-geometry',
    title: 'Architectural Shadows',
    category: 'Abstract',
    imageUrl:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=300&q=60',
  },
];

/**
 * Returns a stable, deterministic default cover photo for a group.
 * If groupType matches 'home', 'trip', 'couple' or a keyword, uses the appropriate theme.
 * Otherwise hashes groupId to guarantee the same group always has the same cover.
 */
export function getDefaultCoverPhoto(
  groupId: string,
  groupType?: string,
  groupName?: string
): GroupCoverPhoto {
  const normName = (groupName || '').toLowerCase();
  const normType = (groupType || '').toLowerCase();

  // Explicit type matching
  if (normType === 'couple' || /couple|love|anniversary|date|tuscany/.test(normName)) {
    const preset = PRESET_COVERS.find((p) => p.id === 'tuscany-hills') || PRESET_COVERS[4];
    return {
      type: 'preset',
      imageUrl: preset.imageUrl,
      presetId: preset.id,
    };
  }

  if (normType === 'home' || /home|flat|apt|apartment|house|roommate|rent/.test(normName)) {
    const preset = PRESET_COVERS.find((p) => p.id === 'cozy-home') || PRESET_COVERS[0];
    return {
      type: 'preset',
      imageUrl: preset.imageUrl,
      presetId: preset.id,
    };
  }

  if (normType === 'trip' || /trip|travel|tour|vacation|flight|trek|holiday/.test(normName)) {
    const preset = PRESET_COVERS.find((p) => p.id === 'mountain-alps') || PRESET_COVERS[4];
    return {
      type: 'preset',
      imageUrl: preset.imageUrl,
      presetId: preset.id,
    };
  }

  // Deterministic fallback based on groupId character codes
  let hash = 0;
  for (let i = 0; i < (groupId || '').length; i++) {
    hash = (hash << 5) - hash + groupId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PRESET_COVERS.length;
  const chosen = PRESET_COVERS[index];

  return {
    type: 'preset',
    imageUrl: chosen.imageUrl,
    presetId: chosen.id,
  };
}
