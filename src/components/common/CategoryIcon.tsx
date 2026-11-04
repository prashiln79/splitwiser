import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Utensils,
  Car,
  ShoppingCart,
  Film,
  ShoppingBag,
  Zap,
  Receipt,
  Coffee,
  Plane,
  Home,
  Heart,
  Gift,
} from 'lucide-react-native';

export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Groceries'
  | 'Entertainment'
  | 'Shopping'
  | 'Utilities'
  | 'General'
  | 'Coffee'
  | 'Travel'
  | 'Rent'
  | 'Health'
  | 'Gift';

interface CategoryConfig {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
  bgColor: string;
  label: string;
}

export const CATEGORIES_CONFIG: Record<string, CategoryConfig> = {
  Food: {
    icon: Utensils,
    color: '#EA580C', // Orange
    bgColor: '#FFEDD5',
    label: 'Food & Dining',
  },
  Coffee: {
    icon: Coffee,
    color: '#92400E', // Amber brown
    bgColor: '#FEF3C7',
    label: 'Coffee & Snacks',
  },
  Transport: {
    icon: Car,
    color: '#0284C7', // Sky
    bgColor: '#E0F2FE',
    label: 'Transport & Cab',
  },
  Travel: {
    icon: Plane,
    color: '#0891B2', // Cyan
    bgColor: '#CFFAFE',
    label: 'Travel & Trips',
  },
  Groceries: {
    icon: ShoppingCart,
    color: '#059669', // Emerald
    bgColor: '#D1FAE5',
    label: 'Groceries',
  },
  Shopping: {
    icon: ShoppingBag,
    color: '#DB2777', // Pink
    bgColor: '#FCE7F3',
    label: 'Shopping',
  },
  Entertainment: {
    icon: Film,
    color: '#7C3AED', // Violet
    bgColor: '#EDE9FE',
    label: 'Entertainment',
  },
  Utilities: {
    icon: Zap,
    color: '#D97706', // Yellow
    bgColor: '#FEF3C7',
    label: 'Bills & Utilities',
  },
  Rent: {
    icon: Home,
    color: '#4F46E5', // Indigo
    bgColor: '#E0E7FF',
    label: 'Rent & Housing',
  },
  Health: {
    icon: Heart,
    color: '#E11D48', // Rose
    bgColor: '#FFE4E6',
    label: 'Health & Medical',
  },
  Gift: {
    icon: Gift,
    color: '#C026D3', // Fuchsia
    bgColor: '#FAE8FF',
    label: 'Gifts',
  },
  General: {
    icon: Receipt,
    color: '#475569', // Slate
    bgColor: '#E2E8F0',
    label: 'General',
  },
};

export function detectCategory(description: string, tags?: string[]): ExpenseCategory {
  if (tags && tags.length > 0) {
    const firstTag = tags[0];
    if (CATEGORIES_CONFIG[firstTag]) {
      return firstTag as ExpenseCategory;
    }
  }

  const desc = (description || '').toLowerCase();
  if (/dinner|lunch|breakfast|food|restaurant|pizza|burger|meal|eat|cafe|bakery|snack|chai|sushi|zomato|swiggy/.test(desc)) {
    return 'Food';
  }
  if (/coffee|starbucks|tea|latte|boba/.test(desc)) {
    return 'Coffee';
  }
  if (/cab|uber|ola|auto|metro|train|flight|bus|taxi|petrol|fuel|toll|parking|gas/.test(desc)) {
    return 'Transport';
  }
  if (/trip|hotel|airbnb|vacation|stay|flight|resort/.test(desc)) {
    return 'Travel';
  }
  if (/grocery|supermarket|vegetables|fruits|milk|mart|instamart|blinkit|zepto/.test(desc)) {
    return 'Groceries';
  }
  if (/movie|cinema|netflix|concert|ticket|game|bowling|club|bar|beer|drinks|party/.test(desc)) {
    return 'Entertainment';
  }
  if (/shopping|clothes|shoes|amazon|flipkart|myntra|electronics|mall/.test(desc)) {
    return 'Shopping';
  }
  if (/wifi|bill|electricity|water|recharge|internet|broadband|rent/.test(desc)) {
    return 'Utilities';
  }
  if (/medicine|doctor|pharmacy|hospital|gym|fitness/.test(desc)) {
    return 'Health';
  }
  return 'General';
}

interface CategoryIconProps {
  category?: string;
  description?: string;
  tags?: string[];
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  description = '',
  tags,
  size = 40,
}) => {
  const cat = (category as ExpenseCategory) || detectCategory(description, tags);
  const config = CATEGORIES_CONFIG[cat] || CATEGORIES_CONFIG.General;
  const IconComp = config.icon;
  const iconSize = Math.round(size * 0.52);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: config.bgColor,
        },
      ]}
    >
      <IconComp size={iconSize} color={config.color} strokeWidth={2.2} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

