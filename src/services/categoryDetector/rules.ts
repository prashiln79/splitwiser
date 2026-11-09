import { CategoryRule, ExpenseCategory } from './types';
import { containsPhrase, containsWord } from './normalizer';

/**
 * Pre-structured Category Rules with exact phrases, discrete token boundaries,
 * confidence weighting, and explicit exclusion patterns to eliminate false positives.
 */
export const CATEGORY_RULES: CategoryRule[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. HIGH-PRIORITY PHRASES (Priority: 90 - 95)
  // ─────────────────────────────────────────────────────────────────────────
  // Utilities Phrases (e.g. phone recharge, water bill, gas cylinder)
  {
    category: 'Utilities',
    priority: 95,
    weight: 0.98,
    phrases: [
      'phone bill',
      'mobile bill',
      'phone recharge',
      'mobile recharge',
      'water bill',
      'water utility',
      'water supply',
      'gas bill',
      'gas cylinder',
      'lpg cylinder',
      'cooking gas',
      'electricity bill',
      'electric bill',
      'power bill',
      'wifi bill',
      'wi fi bill',
      'internet bill',
      'broadband bill',
      'dth recharge',
      'cable bill',
      'sewer bill',
      'trash collection',
      'garbage collection',
    ],
  },
  // Subscriptions Phrases
  {
    category: 'Subscriptions',
    priority: 95,
    weight: 0.98,
    phrases: [
      'prime video',
      'amazon prime',
      'youtube premium',
      'apple music',
      'apple one',
      'google one',
      'icloud storage',
      'cloud subscription',
      'disney plus',
      'disney hotstar',
      'hbo max',
      'chatgpt plus',
      'software license',
      'saas subscription',
    ],
  },
  // Fitness Phrases (Disambiguates "yoga class", "pilates class" from Education)
  {
    category: 'Fitness',
    priority: 95,
    weight: 0.98,
    phrases: [
      'yoga class',
      'pilates class',
      'spinning class',
      'fitness class',
      'gym membership',
      'personal trainer',
      'cricket turf',
      'football turf',
      'badminton court',
      'tennis court',
      'swimming pool pass',
    ],
  },
  // Personal Care Phrases (Disambiguates "barber shop", "hair salon" from Drinks/Bar)
  {
    category: 'PersonalCare',
    priority: 95,
    weight: 0.98,
    phrases: [
      'barber shop',
      'barber haircut',
      'hair cut',
      'hair salon',
      'beauty parlour',
      'beauty parlor',
      'nail salon',
      'spa treatment',
      'facial massage',
      'beard trim',
    ],
  },
  // Travel Phrases (Disambiguates "hotel booking", "flight booking" from Education/Books)
  {
    category: 'Travel',
    priority: 95,
    weight: 0.98,
    phrases: [
      'hotel booking',
      'resort booking',
      'flight booking',
      'plane ticket',
      'flight ticket',
      'airline ticket',
      'boarding pass',
      'airbnb stay',
      'hotel stay',
      'resort stay',
      'tour package',
      'luggage bag',
    ],
  },
  // Health Phrases (Disambiguates "doctor fees" from Education/Fees, "medical store" from Shopping)
  {
    category: 'Health',
    priority: 95,
    weight: 0.98,
    phrases: [
      'medical store',
      'doctor fees',
      'dr fees',
      'dentist appointment',
      'dental clinic',
      'blood test',
      'health checkup',
      'full body checkup',
      'eye checkup',
      'prescription glasses',
      'pharmacy bill',
    ],
  },
  // Rent Phrases (Disambiguates "room rent", "flat rent" from Shopping)
  {
    category: 'Rent',
    priority: 95,
    weight: 0.98,
    phrases: [
      'flat rent',
      'house rent',
      'room rent',
      'apartment rent',
      'pg rent',
      'security deposit',
      'brokerage fee',
      'lease agreement',
    ],
  },
  // Fuel Phrases
  {
    category: 'Fuel',
    priority: 95,
    weight: 0.98,
    phrases: [
      'petrol pump',
      'petrol station',
      'gas station',
      'diesel pump',
      'fuel station',
      'cng station',
      'cng pump',
      'cng filling',
      'ev charging',
    ],
  },
  // Education Phrases (Disambiguates "cooking class", "tuition fees")
  {
    category: 'Education',
    priority: 92,
    weight: 0.95,
    phrases: [
      'school fees',
      'college fees',
      'tuition fees',
      'exam fees',
      'coaching fees',
      'course fees',
      'cooking class',
      'pottery class',
      'language class',
      'coding bootcamp',
      'udemy course',
      'coursera course',
    ],
  },
  // Tech Phrases (Disambiguates "phone purchase", "apple iphone", "phone accessories")
  {
    category: 'Tech',
    priority: 92,
    weight: 0.95,
    phrases: [
      'phone purchase',
      'new phone',
      'smartphone purchase',
      'apple iphone',
      'google pixel',
      'phone case',
      'screen protector',
      'usb cable',
      'charger cable',
      'mechanical keyboard',
      'gaming mouse',
      'external hard drive',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. STANDARD CATEGORY RULES (Priority: 50 - 80)
  // ─────────────────────────────────────────────────────────────────────────

  // Coffee & Cafes
  {
    category: 'Coffee',
    priority: 80,
    weight: 0.9,
    phrases: ['coffee shop', 'cold brew', 'iced latte', 'hot chocolate', 'tea stall', 'cafe latte'],
    keywords: ['coffee', 'latte', 'espresso', 'cappuccino', 'mocha', 'macchiato', 'boba', 'cafe', 'cafes'],
    excludePhrases: ['coffee table', 'coffee mug', 'cafe curtain'],
  },

  // Drinks & Nightlife
  {
    category: 'Drinks',
    priority: 78,
    weight: 0.9,
    phrases: ['craft beer', 'red wine', 'white wine', 'cocktail bar', 'sports bar', 'happy hours'],
    keywords: ['beer', 'wine', 'cocktail', 'cocktails', 'brewery', 'liquor', 'whiskey', 'vodka', 'tequila', 'gin', 'rum', 'scotch', 'champagne', 'booze', 'pub', 'pubs'],
    excludePhrases: [
      'barber',
      'barbell',
      'soundbar',
      'granola bar',
      'protein bar',
      'chocolate bar',
      'candy bar',
      'soap bar',
    ],
  },

  // Food & Dining (Carefully audited: NO bare "eat", NO "theatre", NO "great evening")
  {
    category: 'Food',
    priority: 75,
    weight: 0.9,
    phrases: [
      'fine dining',
      'food court',
      'takeout',
      'take away',
      'street food',
      'ice cream',
      'french fries',
      'fast food',
    ],
    keywords: [
      'dinner',
      'lunch',
      'breakfast',
      'brunch',
      'restaurant',
      'restaurants',
      'eatery',
      'pizza',
      'pizzas',
      'burger',
      'burgers',
      'sandwich',
      'sandwiches',
      'pasta',
      'sushi',
      'biryani',
      'buffet',
      'steak',
      'tacos',
      'shawarma',
      'noodles',
      'dumplings',
      'dessert',
      'desserts',
      'bakery',
      'waffles',
      'pancakes',
      'snack',
      'snacks',
    ],
    excludePhrases: ['theatre', 'theater', 'great evening', 'dog food', 'cat food', 'pet food'],
  },

  // Groceries & Supermarket
  {
    category: 'Groceries',
    priority: 74,
    weight: 0.9,
    phrases: ['grocery shopping', 'fresh vegetables', 'fresh fruits', 'organic milk', 'water bottle', 'bottled water'],
    keywords: [
      'groceries',
      'grocery',
      'supermarket',
      'vegetables',
      'veggies',
      'fruits',
      'milk',
      'bread',
      'butter',
      'cheese',
      'eggs',
      'yogurt',
      'cereals',
      'spices',
      'flour',
      'rice',
      'lentils',
      'provisions',
      'meat',
      'chicken',
      'fish',
    ],
    excludePhrases: ['dog food', 'cat food'],
  },

  // Transport & Commute
  {
    category: 'Transport',
    priority: 72,
    weight: 0.88,
    phrases: ['metro ticket', 'bus fare', 'train fare', 'taxi fare', 'cab fare', 'toll booth', 'toll tax', 'car parking'],
    keywords: ['metro', 'subway', 'tram', 'ferry', 'toll', 'parking', 'commute', 'transit'],
    excludePhrases: ['car repair', 'car insurance', 'auto insurance', 'auto repair'],
  },

  // Fuel & Charging
  {
    category: 'Fuel',
    priority: 70,
    weight: 0.9,
    keywords: ['petrol', 'diesel', 'fuel', 'cng', 'octane'],
    excludePhrases: ['fuel filter', 'gas cylinder'],
  },

  // Travel & Trips
  {
    category: 'Travel',
    priority: 68,
    weight: 0.88,
    phrases: ['hotel room', 'vacation rental', 'round trip', 'flight tickets', 'travel insurance', 'tourist visa'],
    keywords: ['hotel', 'hotels', 'hostel', 'resort', 'vacation', 'flight', 'flights', 'airline', 'airlines', 'luggage', 'suitcase', 'sightseeing'],
  },

  // Subscriptions & Streaming
  {
    category: 'Subscriptions',
    priority: 66,
    weight: 0.88,
    keywords: ['subscription', 'subscriptions', 'streaming', 'membership', 'patreon', 'newsletter'],
    excludePhrases: ['gym', 'fitness', 'workout', 'sports club'],
  },

  // Gaming
  {
    category: 'Gaming',
    priority: 65,
    weight: 0.9,
    phrases: ['game pass', 'playstation plus', 'steam game', 'in-game purchase'],
    keywords: ['gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'esports', 'twitch', 'discord', 'gta', 'roblox', 'vbucks', 'fortnite'],
  },

  // Utilities & Bills
  {
    category: 'Utilities',
    priority: 64,
    weight: 0.85,
    keywords: ['electricity', 'utility', 'utilities', 'broadband', 'wifi'],
    excludePhrases: ['water bottle', 'sparkling water', 'mineral water'],
  },

  // Rent & Housing
  {
    category: 'Rent',
    priority: 62,
    weight: 0.85,
    keywords: ['rent', 'lease', 'roommate', 'apartment', 'landlord', 'tenant', 'brokerage'],
    excludePhrases: ['car rental', 'bike rental'],
  },

  // Health & Medical
  {
    category: 'Health',
    priority: 60,
    weight: 0.88,
    phrases: ['doctor visit', 'hospital bill', 'prescription medicines', 'lab test'],
    keywords: ['medicine', 'medicines', 'pharmacy', 'doctor', 'hospital', 'clinic', 'dentist', 'dental', 'optician', 'physiotherapy', 'pills', 'tablets'],
  },

  // Fitness & Sports
  {
    category: 'Fitness',
    priority: 58,
    weight: 0.85,
    phrases: ['workout gear', 'sporting goods', 'marathon registration'],
    keywords: ['gym', 'workout', 'fitness', 'crossfit', 'yoga', 'pilates', 'badminton', 'tennis', 'cricket', 'football', 'swimming', 'marathon', 'triathlon'],
  },

  // Personal Care & Beauty
  {
    category: 'PersonalCare',
    priority: 56,
    weight: 0.85,
    phrases: ['hair stylist', 'skin care', 'hair color'],
    keywords: ['salon', 'haircut', 'spa', 'barber', 'skincare', 'cosmetics', 'makeup', 'facial', 'massage', 'manicure', 'pedicure', 'shampoo'],
  },

  // Education & Courses
  {
    category: 'Education',
    priority: 54,
    weight: 0.85,
    phrases: ['study materials', 'reference books'],
    keywords: ['course', 'courses', 'tuition', 'textbook', 'textbooks', 'exam', 'webinar', 'tutorial', 'coaching', 'curriculum'],
  },

  // Pets & Animals
  {
    category: 'Pets',
    priority: 52,
    weight: 0.9,
    phrases: ['pet food', 'dog food', 'cat food', 'vet clinic', 'veterinary clinic', 'pet grooming'],
    keywords: ['pet', 'pets', 'puppy', 'kitten', 'vet', 'veterinary', 'leash', 'pedigree', 'whiskas'],
  },

  // Electronics & Tech
  {
    category: 'Tech',
    priority: 50,
    weight: 0.85,
    keywords: ['laptop', 'laptops', 'computer', 'macbook', 'smartphone', 'electronics', 'charger', 'headphones', 'earphones', 'airpods', 'monitor', 'keyboard', 'gadget'],
    excludePhrases: ['phone bill', 'mobile recharge'],
  },

  // Entertainment
  {
    category: 'Entertainment',
    priority: 48,
    weight: 0.85,
    phrases: ['theatre tickets', 'theater tickets', 'movie tickets', 'cinema tickets', 'concert tickets'],
    keywords: ['cinema', 'movie', 'movies', 'concert', 'theatre', 'theater', 'museum', 'exhibition', 'amusement', 'arcade'],
  },

  // Celebrations & Party
  {
    category: 'Party',
    priority: 46,
    weight: 0.85,
    phrases: ['birthday party', 'wedding party', 'anniversary celebration', 'bachelor party', 'bachelorette party'],
    keywords: ['party', 'birthday', 'anniversary', 'wedding', 'celebration', 'nightclub', 'champagne'],
  },

  // Gifts & Flowers
  {
    category: 'Gift',
    priority: 44,
    weight: 0.85,
    phrases: ['gift voucher', 'gift card', 'flower bouquet'],
    keywords: ['gift', 'gifts', 'present', 'presents', 'bouquet', 'flowers'],
  },

  // Shopping & Fashion
  {
    category: 'Shopping',
    priority: 42,
    weight: 0.75,
    keywords: ['clothes', 'clothing', 'shoes', 'sneakers', 'apparel', 'dress', 'shirt', 'jeans', 'hoodie', 'jacket', 'tshirt', 'handbag'],
  },

  // Repairs & Services
  {
    category: 'Services',
    priority: 40,
    weight: 0.8,
    phrases: ['plumbing repair', 'electrical repair', 'car service', 'home cleaning', 'deep cleaning', 'car wash', 'ac service', 'ac repair'],
    keywords: ['repair', 'repairs', 'plumber', 'plumbing', 'electrician', 'carpenter', 'mechanic', 'laundry', 'drycleaning', 'locksmith', 'handyman', 'housekeeping', 'maid'],
  },
];

/**
 * Match category rules against normalized text.
 * Checks multi-word phrases before single keywords, and verifies exclusions.
 */
export function matchCategoryRules(
  normalizedText: string
): { category: ExpenseCategory; confidence: number; matchedTerm: string } | null {
  // Sort rules by priority descending
  const sortedRules = [...CATEGORY_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    // Check exclusions first
    if (rule.excludePhrases && rule.excludePhrases.length > 0) {
      const isExcluded = rule.excludePhrases.some(
        (ex) => containsPhrase(normalizedText, ex) || containsWord(normalizedText, ex)
      );
      if (isExcluded) continue;
    }

    // Check multi-word phrases
    if (rule.phrases) {
      for (const phrase of rule.phrases) {
        if (containsPhrase(normalizedText, phrase)) {
          return {
            category: rule.category,
            confidence: rule.weight,
            matchedTerm: phrase,
          };
        }
      }
    }

    // Check individual keywords with word boundary checking
    if (rule.keywords) {
      for (const kw of rule.keywords) {
        if (containsWord(normalizedText, kw)) {
          return {
            category: rule.category,
            confidence: rule.weight - 0.05, // slightly lower confidence than exact multi-word phrase
            matchedTerm: kw,
          };
        }
      }
    }
  }

  return null;
}
