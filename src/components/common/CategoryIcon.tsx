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

export function detectCategory(description: string, tags?: string[]): ExpenseCategory {
  if (tags && tags.length > 0) {
    const firstTag = tags[0];
    if (CATEGORIES_CONFIG[firstTag]) {
      return firstTag as ExpenseCategory;
    }
  }

  const desc = (description || '').toLowerCase();

  // Coffee & Cafes
  if (/coffee|starbucks|tea\b|chai|latte|boba|espresso|cappuccino|brew|roast|cafe/.test(desc)) {
    return 'Coffee';
  }
  // Drinks & Nightlife
  if (/beer|alcohol|wine|cocktail|cocktails|liquor|pub|bar\b|brewery|booze|tequila|whiskey|vodka|gin|rum|scotch|champagne/.test(desc)) {
    return 'Drinks';
  }
  // Fuel & Gas
  if (/petrol|diesel|fuel|gas station|cng|octane/.test(desc)) {
    return 'Fuel';
  }
  // Fitness & Sports
  if (/gym|workout|trainer|sports|football|cricket|turf|badminton|tennis|swimming|yoga|crossfit|marathon|fitness/.test(desc)) {
    return 'Fitness';
  }
  // Subscriptions & Streaming
  if (/subscription|subscriptions|netflix|spotify|prime video|youtube premium|icloud|hotstar|hulu|disney|hbo|chatgpt|patreon|saas|software|apple music/.test(desc)) {
    return 'Subscriptions';
  }
  // Gaming
  if (/gaming|steam|playstation|ps5|ps4|xbox|nintendo|gta|discord|roblox|vbucks|skins|esports/.test(desc)) {
    return 'Gaming';
  }
  // Pets & Animals
  if (/pet food|pets?\b|dogs?\b|cats?\b|vet\b|veterinary|puppy|kitten|pedigree|leash|grooming/.test(desc)) {
    return 'Pets';
  }
  // Food & Dining
  if (/dinner|lunch|breakfast|food|restaurant|pizza|burger|meal|eat|bakery|snacks?\b|sushi|zomato|swiggy|biryani|sandwich|pasta|dessert|ice cream|mcdonalds|kfc|domino|dominos|subway|tacos|shawarma|rolls/.test(desc)) {
    return 'Food';
  }
  // Groceries & Supermarket
  if (/grocery|groceries|supermarket|vegetables|fruits|milk|mart|instamart|blinkit|zepto|bigbasket|veggies|bread|eggs|\bration\b|dairy|costco|walmart/.test(desc)) {
    return 'Groceries';
  }
  // Transport & Cab
  if (/cab|uber|ola|auto\b|metro|train|bus\b|taxi|toll|parking|fare|ride|rapido|drive|car rental/.test(desc)) {
    return 'Transport';
  }
  // Travel & Trips
  if (/trip|hotel|airbnb|vacation|stay|flights?\b|resort|tour|luggage|hostel|booking|airline|plane ticket/.test(desc)) {
    return 'Travel';
  }
  // Rent & Housing
  if (/rent|deposit|lease|roommate|pg\b|apartment|broker|flat rent/.test(desc)) {
    return 'Rent';
  }
  // Bills & Utilities
  if (/wifi|bills?\b|electricity|water|recharge|internet|broadband|power|dth|maintenance|phone bill|utility/.test(desc)) {
    return 'Utilities';
  }
  // Health & Medical
  if (/medicine|doctor|pharmacy|hospital|clinic|dental|dentist|teeth|medical|pills|tablets|health checkup|optician|glasses/.test(desc)) {
    return 'Health';
  }
  // Personal Care & Beauty
  if (/salon|haircut|spa|barber|skincare|cosmetics|makeup|facial|massage|manicure|pedicure|beauty|parlour|parlor/.test(desc)) {
    return 'PersonalCare';
  }
  // Education & Learning
  if (/books?\b|course|tuition|class|school|college|exam|study|textbook|udemy|coursera|fees|coaching|tutorial|library/.test(desc)) {
    return 'Education';
  }
  // Electronics & Tech
  if (/laptop|smartphones?\b|phones?\b|iphone|ipad|electronics|charger|cable|mouse|keyboard|monitor|headphones|earphones|airpods|gadget|hardware|computer|macbook/.test(desc)) {
    return 'Tech';
  }
  // Gifts & Flowers
  if (/gifts?\b|presents?\b|flowers|bouquet/.test(desc)) {
    return 'Gift';
  }
  // Celebrations & Party
  if (/party|birthday|anniversary|celebration|wedding|bachelor|bachelorette|festival|event|nightclub/.test(desc)) {
    return 'Party';
  }
  // Shopping & Fashion
  if (/shopping|clothes|shoes|amazon|flipkart|myntra|mall|zara|h&m|store|buy|purchase|dress|shirt|jeans|hoodie|jacket/.test(desc)) {
    return 'Shopping';
  }
  // Repairs & Services
  if (/repair|plumber|electrician|cleaning|maid|laundry|dry clean|mechanic|service|carpenter|car wash/.test(desc)) {
    return 'Services';
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

