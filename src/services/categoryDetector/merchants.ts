import { MerchantRule, ExpenseCategory } from './types';
import { containsPhrase, containsWord, normalizeText } from './normalizer';

export const MERCHANTS_CONFIG: MerchantRule[] = [
  // ── Tech Giants with Multi-service Disambiguation ──
  {
    brand: 'Amazon',
    aliases: ['amazon', 'amzn'],
    defaultCategory: 'Shopping',
    confidence: 0.9,
    contextOverrides: [
      {
        matchPatterns: ['prime video', 'prime', 'music', 'audible', 'kindle unlimited'],
        category: 'Subscriptions',
        confidence: 0.95,
      },
      {
        matchPatterns: ['fresh', 'grocery', 'pantry', 'groceries'],
        category: 'Groceries',
        confidence: 0.95,
      },
      {
        matchPatterns: ['aws', 'cloud', 'server', 'web services'],
        category: 'Tech',
        confidence: 0.95,
      },
    ],
  },
  {
    brand: 'Apple',
    aliases: ['apple'],
    defaultCategory: 'Tech',
    confidence: 0.85,
    contextOverrides: [
      {
        matchPatterns: ['music', 'tv+', 'tv plus', 'icloud', 'apple one', 'arcade', 'fitness+', 'podcast'],
        category: 'Subscriptions',
        confidence: 0.95,
      },
      {
        matchPatterns: ['iphone', 'ipad', 'macbook', 'mac', 'airpods', 'watch', 'pencil', 'charger', 'cable', 'store'],
        category: 'Tech',
        confidence: 0.95,
      },
    ],
  },
  {
    brand: 'Google',
    aliases: ['google'],
    defaultCategory: 'Subscriptions',
    confidence: 0.8,
    contextOverrides: [
      {
        matchPatterns: ['one', 'youtube', 'yt premium', 'drive', 'workspace', 'cloud storage'],
        category: 'Subscriptions',
        confidence: 0.95,
      },
      {
        matchPatterns: ['pixel', 'nest', 'chromebook', 'pixel buds', 'phone'],
        category: 'Tech',
        confidence: 0.95,
      },
      {
        matchPatterns: ['play store', 'play', 'game', 'play pass'],
        category: 'Entertainment',
        confidence: 0.9,
      },
    ],
  },

  // ── Coffee & Cafes ──
  {
    brand: 'Starbucks',
    aliases: ['starbucks', 'starbucks coffee'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },
  {
    brand: 'Cafe Coffee Day',
    aliases: ['cafe coffee day', 'ccd'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },
  {
    brand: 'Costa Coffee',
    aliases: ['costa coffee', 'costa'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },
  {
    brand: 'Third Wave Coffee',
    aliases: ['third wave coffee', 'third wave'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },
  {
    brand: 'Blue Tokai',
    aliases: ['blue tokai', 'blue tokai coffee'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },
  {
    brand: 'Dunkin',
    aliases: ['dunkin', 'dunkin donuts'],
    defaultCategory: 'Coffee',
    confidence: 0.95,
  },
  {
    brand: 'Tim Hortons',
    aliases: ['tim hortons', 'tims'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },

  // ── Food & Dining ──
  {
    brand: 'Swiggy',
    aliases: ['swiggy'],
    defaultCategory: 'Food',
    confidence: 0.95,
    contextOverrides: [
      {
        matchPatterns: ['instamart', 'mart', 'grocery'],
        category: 'Groceries',
        confidence: 0.98,
      },
      {
        matchPatterns: ['dineout', 'restaurant'],
        category: 'Food',
        confidence: 0.98,
      },
    ],
  },
  {
    brand: 'Zomato',
    aliases: ['zomato'],
    defaultCategory: 'Food',
    confidence: 0.98,
  },
  {
    brand: "McDonald's",
    aliases: ['mcdonalds', 'mcd', "mcdonald's"],
    defaultCategory: 'Food',
    confidence: 0.98,
  },
  {
    brand: "Domino's",
    aliases: ['dominos', "domino's", 'dominos pizza'],
    defaultCategory: 'Food',
    confidence: 0.98,
  },
  {
    brand: 'KFC',
    aliases: ['kfc'],
    defaultCategory: 'Food',
    confidence: 0.98,
  },
  {
    brand: 'Burger King',
    aliases: ['burger king'],
    defaultCategory: 'Food',
    confidence: 0.98,
  },
  {
    brand: 'Pizza Hut',
    aliases: ['pizza hut'],
    defaultCategory: 'Food',
    confidence: 0.98,
  },
  {
    brand: 'Subway',
    aliases: ['subway'],
    defaultCategory: 'Food',
    confidence: 0.95,
  },
  {
    brand: 'Haldiram',
    aliases: ['haldiram', "haldiram's", 'haldirams'],
    defaultCategory: 'Food',
    confidence: 0.95,
  },
  {
    brand: 'Chai Point',
    aliases: ['chai point'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },
  {
    brand: 'Chaayos',
    aliases: ['chaayos'],
    defaultCategory: 'Coffee',
    confidence: 0.98,
  },

  // ── Groceries & Quick Commerce ──
  {
    brand: 'Blinkit',
    aliases: ['blinkit', 'grofers'],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },
  {
    brand: 'Zepto',
    aliases: ['zepto', 'zepto now'],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },
  {
    brand: 'BigBasket',
    aliases: ['bigbasket', 'bb daily', 'bbnow'],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },
  {
    brand: 'Instamart',
    aliases: ['instamart'],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },
  {
    brand: 'DMart',
    aliases: ['dmart', 'd-mart'],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },
  {
    brand: 'Costco',
    aliases: ['costco', 'costco wholesale'],
    defaultCategory: 'Groceries',
    confidence: 0.92,
  },
  {
    brand: 'Walmart',
    aliases: ['walmart'],
    defaultCategory: 'Groceries',
    confidence: 0.88,
  },
  {
    brand: 'Trader Joe\'s',
    aliases: ['trader joes', "trader joe's"],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },
  {
    brand: 'Whole Foods',
    aliases: ['whole foods', 'wholefoods'],
    defaultCategory: 'Groceries',
    confidence: 0.98,
  },

  // ── Rides & Transport ──
  {
    brand: 'Uber',
    aliases: ['uber'],
    defaultCategory: 'Transport',
    confidence: 0.95,
    contextOverrides: [
      {
        matchPatterns: ['eats', 'food', 'meal'],
        category: 'Food',
        confidence: 0.98,
      },
    ],
  },
  {
    brand: 'Ola',
    aliases: ['ola', 'ola cabs'],
    defaultCategory: 'Transport',
    confidence: 0.95,
  },
  {
    brand: 'Rapido',
    aliases: ['rapido', 'rapido bike'],
    defaultCategory: 'Transport',
    confidence: 0.98,
  },
  {
    brand: 'Lyft',
    aliases: ['lyft'],
    defaultCategory: 'Transport',
    confidence: 0.98,
  },

  // ── Subscriptions & OTT ──
  {
    brand: 'Netflix',
    aliases: ['netflix'],
    defaultCategory: 'Subscriptions',
    confidence: 0.98,
  },
  {
    brand: 'Spotify',
    aliases: ['spotify'],
    defaultCategory: 'Subscriptions',
    confidence: 0.98,
  },
  {
    brand: 'Hotstar',
    aliases: ['hotstar', 'disney+ hotstar', 'disney hotstar'],
    defaultCategory: 'Subscriptions',
    confidence: 0.98,
  },
  {
    brand: 'YouTube Premium',
    aliases: ['youtube premium', 'yt premium'],
    defaultCategory: 'Subscriptions',
    confidence: 0.98,
  },
  {
    brand: 'ChatGPT',
    aliases: ['chatgpt', 'openai', 'chatgpt plus'],
    defaultCategory: 'Subscriptions',
    confidence: 0.95,
  },
  {
    brand: 'Patreon',
    aliases: ['patreon'],
    defaultCategory: 'Subscriptions',
    confidence: 0.98,
  },

  // ── Shopping & Fashion ──
  {
    brand: 'Zara',
    aliases: ['zara'],
    defaultCategory: 'Shopping',
    confidence: 0.95,
  },
  {
    brand: 'H&M',
    aliases: ['h&m', 'hm'],
    defaultCategory: 'Shopping',
    confidence: 0.95,
  },
  {
    brand: 'Myntra',
    aliases: ['myntra'],
    defaultCategory: 'Shopping',
    confidence: 0.95,
  },
  {
    brand: 'Flipkart',
    aliases: ['flipkart'],
    defaultCategory: 'Shopping',
    confidence: 0.9,
  },
  {
    brand: 'Uniqlo',
    aliases: ['uniqlo'],
    defaultCategory: 'Shopping',
    confidence: 0.98,
  },
  {
    brand: 'Nykaa',
    aliases: ['nykaa'],
    defaultCategory: 'PersonalCare',
    confidence: 0.95,
  },
  {
    brand: 'Sephora',
    aliases: ['sephora'],
    defaultCategory: 'PersonalCare',
    confidence: 0.98,
  },
  {
    brand: 'IKEA',
    aliases: ['ikea'],
    defaultCategory: 'Shopping',
    confidence: 0.95,
  },

  // ── Health & Pharmacy ──
  {
    brand: 'Apollo Pharmacy',
    aliases: ['apollo pharmacy', 'apollo 247', 'apollo clinic'],
    defaultCategory: 'Health',
    confidence: 0.98,
  },
  {
    brand: 'PharmEasy',
    aliases: ['pharmeasy'],
    defaultCategory: 'Health',
    confidence: 0.98,
  },
  {
    brand: 'Tata 1mg',
    aliases: ['1mg', 'tata 1mg'],
    defaultCategory: 'Health',
    confidence: 0.98,
  },
  {
    brand: 'Netmeds',
    aliases: ['netmeds'],
    defaultCategory: 'Health',
    confidence: 0.98,
  },
  {
    brand: 'Walgreens',
    aliases: ['walgreens'],
    defaultCategory: 'Health',
    confidence: 0.92,
  },
  {
    brand: 'CVS',
    aliases: ['cvs', 'cvs pharmacy'],
    defaultCategory: 'Health',
    confidence: 0.92,
  },

  // ── Fitness & Sports ──
  {
    brand: 'Decathlon',
    aliases: ['decathlon'],
    defaultCategory: 'Fitness',
    confidence: 0.95,
  },
  {
    brand: 'Cult.fit',
    aliases: ['cult.fit', 'cult fit', 'cure.fit', 'cultfit'],
    defaultCategory: 'Fitness',
    confidence: 0.98,
  },
  {
    brand: 'Anytime Fitness',
    aliases: ['anytime fitness'],
    defaultCategory: 'Fitness',
    confidence: 0.98,
  },

  // ── Travel & Stays ──
  {
    brand: 'Airbnb',
    aliases: ['airbnb'],
    defaultCategory: 'Travel',
    confidence: 0.98,
  },
  {
    brand: 'MakeMyTrip',
    aliases: ['makemytrip', 'mmt'],
    defaultCategory: 'Travel',
    confidence: 0.98,
  },
  {
    brand: 'Booking.com',
    aliases: ['booking.com', 'booking com'],
    defaultCategory: 'Travel',
    confidence: 0.98,
  },
  {
    brand: 'Expedia',
    aliases: ['expedia'],
    defaultCategory: 'Travel',
    confidence: 0.98,
  },
  {
    brand: 'Agoda',
    aliases: ['agoda'],
    defaultCategory: 'Travel',
    confidence: 0.98,
  },
];

/**
 * Match merchant against normalized text and resolve contextual category.
 */
export function matchMerchant(
  normalizedText: string
): { rule: MerchantRule; category: ExpenseCategory; confidence: number; matchedAlias: string } | null {
  for (const rule of MERCHANTS_CONFIG) {
    for (const alias of rule.aliases) {
      const aliasNormalized = normalizeText(alias);
      if (
        containsPhrase(normalizedText, aliasNormalized) ||
        (aliasNormalized.indexOf(' ') === -1 && containsWord(normalizedText, aliasNormalized))
      ) {
        // Found matching brand! Check contextual overrides
        if (rule.contextOverrides) {
          for (const override of rule.contextOverrides) {
            for (const pattern of override.matchPatterns) {
              if (containsPhrase(normalizedText, pattern) || containsWord(normalizedText, pattern)) {
                return {
                  rule,
                  category: override.category,
                  confidence: override.confidence,
                  matchedAlias: `${rule.brand} (${pattern})`,
                };
              }
            }
          }
        }

        // Return default category for brand
        return {
          rule,
          category: rule.defaultCategory,
          confidence: rule.confidence,
          matchedAlias: rule.brand,
        };
      }
    }
  }

  return null;
}
