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
  Beer,
  Fuel,
  Dumbbell,
  Tv,
  Gamepad2,
  PawPrint,
  Sparkles,
  GraduationCap,
  Laptop,
  PartyPopper,
  Wrench,
} from 'lucide-react-native';

export type ExpenseCategory =
  | 'Food'
  | 'Coffee'
  | 'Drinks'
  | 'Transport'
  | 'Fuel'
  | 'Travel'
  | 'Groceries'
  | 'Shopping'
  | 'Entertainment'
  | 'Subscriptions'
  | 'Gaming'
  | 'Utilities'
  | 'Rent'
  | 'Health'
  | 'Fitness'
  | 'PersonalCare'
  | 'Education'
  | 'Pets'
  | 'Tech'
  | 'Party'
  | 'Gift'
  | 'Services'
  | 'General';

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
  Drinks: {
    icon: Beer,
    color: '#D97706', // Amber gold
    bgColor: '#FEF3C7',
    label: 'Drinks & Nightlife',
  },
  Transport: {
    icon: Car,
    color: '#0284C7', // Sky
    bgColor: '#E0F2FE',
    label: 'Transport & Cab',
  },
  Fuel: {
    icon: Fuel,
    color: '#E11D48', // Crimson rose
    bgColor: '#FFE4E6',
    label: 'Fuel & Gas',
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
    label: 'Groceries & Mart',
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
  Subscriptions: {
    icon: Tv,
    color: '#6366F1', // Indigo
    bgColor: '#EEF2FF',
    label: 'Subscriptions & OTT',
  },
  Gaming: {
    icon: Gamepad2,
    color: '#8B5CF6', // Purple
    bgColor: '#F5F3FF',
    label: 'Gaming',
  },
  Utilities: {
    icon: Zap,
    color: '#CA8A04', // Yellow
    bgColor: '#FEF9C3',
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
    color: '#DC2626', // Red
    bgColor: '#FEE2E2',
    label: 'Health & Medical',
  },
  Fitness: {
    icon: Dumbbell,
    color: '#16A34A', // Green
    bgColor: '#DCFCE7',
    label: 'Fitness & Sports',
  },
  PersonalCare: {
    icon: Sparkles,
    color: '#BE185D', // Rose Pink
    bgColor: '#FCE7F3',
    label: 'Beauty & Personal Care',
  },
  Education: {
    icon: GraduationCap,
    color: '#2563EB', // Blue
    bgColor: '#DBEAFE',
    label: 'Education & Courses',
  },
  Pets: {
    icon: PawPrint,
    color: '#B45309', // Warm Brown
    bgColor: '#FEF3C7',
    label: 'Pets & Animals',
  },
  Tech: {
    icon: Laptop,
    color: '#0D9488', // Teal
    bgColor: '#CCFBF1',
    label: 'Electronics & Tech',
  },
  Party: {
    icon: PartyPopper,
    color: '#F43F5E', // Rose
    bgColor: '#FFE4E6',
    label: 'Celebrations & Party',
  },
  Gift: {
    icon: Gift,
    color: '#C026D3', // Fuchsia
    bgColor: '#FAE8FF',
    label: 'Gifts & Flowers',
  },
  Services: {
    icon: Wrench,
    color: '#4B5563', // Slate gray
    bgColor: '#F3F4F6',
    label: 'Repairs & Services',
  },
  General: {
    icon: Receipt,
    color: '#475569', // Slate
    bgColor: '#E2E8F0',
    label: 'General',
  },
};

import {
  detectCategory as detectCategoryEngine,
  detectCategoryDetailed,
} from '../../services/categoryDetector';

export { detectCategoryDetailed };

export function detectCategory(description: string, tags?: string[]): ExpenseCategory {
  return detectCategoryEngine(description, tags);
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

