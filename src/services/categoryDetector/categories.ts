import { ExpenseCategory } from './types';

export interface CategoryMetadata {
  id: ExpenseCategory;
  label: string;
  color: string;
  bgColor: string;
}

export const CATEGORIES_METADATA: Record<ExpenseCategory, CategoryMetadata> = {
  Food: {
    id: 'Food',
    label: 'Food & Dining',
    color: '#EA580C',
    bgColor: '#FFEDD5',
  },
  Coffee: {
    id: 'Coffee',
    label: 'Coffee & Snacks',
    color: '#92400E',
    bgColor: '#FEF3C7',
  },
  Drinks: {
    id: 'Drinks',
    label: 'Drinks & Nightlife',
    color: '#D97706',
    bgColor: '#FEF3C7',
  },
  Transport: {
    id: 'Transport',
    label: 'Transport & Cab',
    color: '#0284C7',
    bgColor: '#E0F2FE',
  },
  Fuel: {
    id: 'Fuel',
    label: 'Fuel & Gas',
    color: '#E11D48',
    bgColor: '#FFE4E6',
  },
  Travel: {
    id: 'Travel',
    label: 'Travel & Trips',
    color: '#0891B2',
    bgColor: '#CFFAFE',
  },
  Groceries: {
    id: 'Groceries',
    label: 'Groceries & Mart',
    color: '#059669',
    bgColor: '#D1FAE5',
  },
  Shopping: {
    id: 'Shopping',
    label: 'Shopping',
    color: '#DB2777',
    bgColor: '#FCE7F3',
  },
  Entertainment: {
    id: 'Entertainment',
    label: 'Entertainment',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
  },
  Subscriptions: {
    id: 'Subscriptions',
    label: 'Subscriptions & OTT',
    color: '#6366F1',
    bgColor: '#EEF2FF',
  },
  Gaming: {
    id: 'Gaming',
    label: 'Gaming',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
  },
  Utilities: {
    id: 'Utilities',
    label: 'Bills & Utilities',
    color: '#CA8A04',
    bgColor: '#FEF9C3',
  },
  Rent: {
    id: 'Rent',
    label: 'Rent & Housing',
    color: '#4F46E5',
    bgColor: '#E0E7FF',
  },
  Health: {
    id: 'Health',
    label: 'Health & Medical',
    color: '#DC2626',
    bgColor: '#FEE2E2',
  },
  Fitness: {
    id: 'Fitness',
    label: 'Fitness & Sports',
    color: '#16A34A',
    bgColor: '#DCFCE7',
  },
  PersonalCare: {
    id: 'PersonalCare',
    label: 'Beauty & Personal Care',
    color: '#BE185D',
    bgColor: '#FCE7F3',
  },
  Education: {
    id: 'Education',
    label: 'Education & Courses',
    color: '#2563EB',
    bgColor: '#DBEAFE',
  },
  Pets: {
    id: 'Pets',
    label: 'Pets & Animals',
    color: '#B45309',
    bgColor: '#FEF3C7',
  },
  Tech: {
    id: 'Tech',
    label: 'Electronics & Tech',
    color: '#0D9488',
    bgColor: '#CCFBF1',
  },
  Party: {
    id: 'Party',
    label: 'Celebrations & Party',
    color: '#F43F5E',
    bgColor: '#FFE4E6',
  },
  Gift: {
    id: 'Gift',
    label: 'Gifts & Flowers',
    color: '#C026D3',
    bgColor: '#FAE8FF',
  },
  Services: {
    id: 'Services',
    label: 'Repairs & Services',
    color: '#4B5563',
    bgColor: '#F3F4F6',
  },
  General: {
    id: 'General',
    label: 'General',
    color: '#475569',
    bgColor: '#E2E8F0',
  },
};

/**
 * Returns the localized label for an expense category based on the active i18n locale.
 * Falls back to canonical English metadata label.
 */
export function getCategoryLabel(
  category: ExpenseCategory,
  t?: (key: string, options?: any) => string
): string {
  if (t) {
    return t(`categories:${category}`, {
      defaultValue: CATEGORIES_METADATA[category]?.label || category,
    });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const i18n = require('../../i18n').default;
    return i18n?.t
      ? i18n.t(`categories:${category}`, {
          ns: 'categories',
          defaultValue: CATEGORIES_METADATA[category]?.label || category,
        })
      : CATEGORIES_METADATA[category]?.label || category;
  } catch {
    return CATEGORIES_METADATA[category]?.label || category;
  }
}


