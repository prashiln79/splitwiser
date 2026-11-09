import {
  detectCategory,
  detectCategoryDetailed,
  VALID_CATEGORIES,
  CATEGORIES_METADATA,
} from '../src/services/categoryDetector';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string, details?: any) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`, details || '');
    failedCount++;
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${msg}`);
    passedCount++;
  }
}

console.log('--- STARTING EXPENSE CATEGORY DETECTION TEST SUITE ---');

// ─────────────────────────────────────────────────────────────────────────
// 1. BASIC & CONFIGURATION INTEGRITY TESTS
// ─────────────────────────────────────────────────────────────────────────
assert(VALID_CATEGORIES.length === 23, 'All 23 canonical categories are registered');

VALID_CATEGORIES.forEach((cat) => {
  const conf = CATEGORIES_METADATA[cat];
  assert(
    !!conf && !!conf.label && !!conf.color && !!conf.bgColor,
    `Category "${cat}" is fully configured in CATEGORIES_METADATA with label and colors`
  );
});

// Empty and undefined handling
assert(detectCategory('') === 'General', 'Empty string returns General');
assert(detectCategory('   ') === 'General', 'Whitespace returns General');
assert(detectCategory('xyz random gibberish 1234') === 'General', 'Unknown description returns General');

// Positive example for every single category
const POSITIVE_EXAMPLES: Record<string, string> = {
  Food: 'Dinner at Italian restaurant',
  Coffee: 'Starbucks iced latte',
  Drinks: 'Craft beer at pub',
  Transport: 'Uber cab ride to office',
  Fuel: 'Petrol pump refuel',
  Travel: 'Hotel booking for weekend trip',
  Groceries: 'Supermarket vegetables and bread',
  Shopping: 'Zara jeans and clothing',
  Entertainment: 'Movie cinema tickets',
  Subscriptions: 'Netflix monthly subscription',
  Gaming: 'PlayStation Plus game pass',
  Utilities: 'Electricity power bill payment',
  Rent: 'Monthly apartment rent deposit',
  Health: 'Doctor consultation fees',
  Fitness: 'Gym workout membership',
  PersonalCare: 'Hair salon haircut and styling',
  Education: 'University tuition exam fees',
  Pets: 'Pedigree dog food and vet checkup',
  Tech: 'MacBook charger and USB cable',
  Party: 'Birthday party celebration',
  Gift: 'Flower bouquet gift for friend',
  Services: 'Plumbing leak repair service',
  General: 'Miscellaneous expense',
};

Object.entries(POSITIVE_EXAMPLES).forEach(([cat, desc]) => {
  const detected = detectCategory(desc);
  assert(detected === cat, `Positive example for "${cat}" matches correctly (got "${detected}" for "${desc}")`);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. FALSE POSITIVE & AMBIGUITY TESTS (Critical Audit Checks)
// ─────────────────────────────────────────────────────────────────────────
// "Great evening" must NOT become Food (old bug: contained "eat")
assert(detectCategory('Great evening with friends') === 'General', '"Great evening" does not become Food');
assert(detectCategory('Theatre tickets') === 'Entertainment', '"Theatre tickets" matches Entertainment, not Food');

// "Barber haircut" must NOT become Drinks (old bug: matched "bar" prefix)
assert(detectCategory('Barber haircut and beard trim') === 'PersonalCare', '"Barber haircut" matches PersonalCare, not Drinks');
assert(detectCategory('Barber shop') === 'PersonalCare', '"Barber shop" matches PersonalCare, not Drinks');

// "Water bottle" must NOT become Utilities
assert(detectCategory('Water bottle at convenience store') === 'Groceries', '"Water bottle" matches Groceries, not Utilities');
assert(detectCategory('Bottled water') === 'Groceries', '"Bottled water" matches Groceries, not Utilities');
assert(detectCategory('Water bill payment') === 'Utilities', '"Water bill payment" matches Utilities');

// "Yoga class" must become Fitness, not Education
assert(detectCategory('Yoga class session') === 'Fitness', '"Yoga class" matches Fitness, not Education');
assert(detectCategory('Pilates class') === 'Fitness', '"Pilates class" matches Fitness, not Education');
assert(detectCategory('Cooking class fee') === 'Education', '"Cooking class fee" matches Education');

// "Auto insurance" and "Auto repair" must not become Transport
assert(detectCategory('Auto repair mechanic') === 'Services', '"Auto repair" matches Services, not Transport');

// "Phone recharge" (Utilities) vs "Phone purchase" (Tech)
assert(detectCategory('Phone recharge voucher') === 'Utilities', '"Phone recharge" matches Utilities');
assert(detectCategory('Phone bill payment') === 'Utilities', '"Phone bill payment" matches Utilities');
assert(detectCategory('New phone purchase') === 'Tech', '"New phone purchase" matches Tech');
assert(detectCategory('iPhone screen protector') === 'Tech', '"iPhone screen protector" matches Tech');

// "Gas cylinder" (Utilities) vs "Petrol pump" (Fuel)
assert(detectCategory('Gas cylinder booking') === 'Utilities', '"Gas cylinder" matches Utilities');
assert(detectCategory('LPG cylinder refill') === 'Utilities', '"LPG cylinder refill" matches Utilities');
assert(detectCategory('Petrol pump fuel') === 'Fuel', '"Petrol pump fuel" matches Fuel');

// "Hotel booking" (Travel) vs "Book purchase" (Education)
assert(detectCategory('Hotel booking in Goa') === 'Travel', '"Hotel booking" matches Travel');
assert(detectCategory('Textbooks and reference books') === 'Education', '"Textbooks and reference books" matches Education');

// "Doctor fees" (Health) vs "Tuition fees" (Education)
assert(detectCategory('Doctor fees consultation') === 'Health', '"Doctor fees" matches Health, not Education');
assert(detectCategory('School tuition fees') === 'Education', '"School tuition fees" matches Education');

// ─────────────────────────────────────────────────────────────────────────
// 3. MERCHANT RECOGNITION & CONTEXT DISAMBIGUATION TESTS
// ─────────────────────────────────────────────────────────────────────────
// Amazon contextual disambiguation
assert(detectCategory('Amazon Prime Video') === 'Subscriptions', '"Amazon Prime Video" matches Subscriptions');
assert(detectCategory('Amazon Fresh order') === 'Groceries', '"Amazon Fresh" matches Groceries');
assert(detectCategory('Amazon shopping order') === 'Shopping', '"Amazon shopping order" matches Shopping');

// Apple contextual disambiguation
assert(detectCategory('Apple Music subscription') === 'Subscriptions', '"Apple Music" matches Subscriptions');
assert(detectCategory('Apple iPhone 15') === 'Tech', '"Apple iPhone" matches Tech');
assert(detectCategory('Apple MacBook Pro') === 'Tech', '"Apple MacBook" matches Tech');

// Google contextual disambiguation
assert(detectCategory('Google One cloud storage') === 'Subscriptions', '"Google One" matches Subscriptions');
assert(detectCategory('Google Pixel 8') === 'Tech', '"Google Pixel" matches Tech');

// Food delivery & Fast Food
assert(detectCategory('Swiggy dinner delivery') === 'Food', '"Swiggy dinner" matches Food');
assert(detectCategory('Swiggy Instamart groceries') === 'Groceries', '"Swiggy Instamart" matches Groceries');
assert(detectCategory('Zomato order') === 'Food', '"Zomato order" matches Food');
assert(detectCategory("McDonald's burger meal") === 'Food', "McDonald's matches Food");
assert(detectCategory("Domino's pizza") === 'Food', "Domino's matches Food");
assert(detectCategory('KFC chicken bucket') === 'Food', 'KFC matches Food');

// Coffee merchants
assert(detectCategory('Starbucks coffee') === 'Coffee', 'Starbucks matches Coffee');
assert(detectCategory('Third Wave Coffee') === 'Coffee', 'Third Wave Coffee matches Coffee');
assert(detectCategory('Blue Tokai') === 'Coffee', 'Blue Tokai matches Coffee');
assert(detectCategory('Cafe Coffee Day') === 'Coffee', 'Cafe Coffee Day matches Coffee');

// Quick commerce & Marts
assert(detectCategory('Blinkit quick delivery') === 'Groceries', 'Blinkit matches Groceries');
assert(detectCategory('Zepto groceries') === 'Groceries', 'Zepto matches Groceries');
assert(detectCategory('BigBasket monthly order') === 'Groceries', 'BigBasket matches Groceries');

// Rides & Cabs
assert(detectCategory('Uber ride to airport') === 'Transport', 'Uber matches Transport');
assert(detectCategory('Uber Eats lunch') === 'Food', 'Uber Eats matches Food');
assert(detectCategory('Ola cab booking') === 'Transport', 'Ola matches Transport');
assert(detectCategory('Rapido bike taxi') === 'Transport', 'Rapido matches Transport');

// Health & Pharmacy merchants
assert(detectCategory('Apollo Pharmacy medicines') === 'Health', 'Apollo Pharmacy matches Health');
assert(detectCategory('PharmEasy order') === 'Health', 'PharmEasy matches Health');
assert(detectCategory('Tata 1mg lab test') === 'Health', 'Tata 1mg matches Health');

// Fitness merchants
assert(detectCategory('Decathlon sports equipment') === 'Fitness', 'Decathlon matches Fitness');
assert(detectCategory('Cult.fit gym membership') === 'Fitness', 'Cult.fit matches Fitness');

// Fashion merchants
assert(detectCategory('Zara jacket') === 'Shopping', 'Zara matches Shopping');
assert(detectCategory('H&M t-shirt') === 'Shopping', 'H&M matches Shopping');
assert(detectCategory('Myntra clothes') === 'Shopping', 'Myntra matches Shopping');

// ─────────────────────────────────────────────────────────────────────────
// 4. REGIONAL INDIAN EXPENSE VOCABULARY TESTS
// ─────────────────────────────────────────────────────────────────────────
assert(detectCategory('Kirana store items') === 'Groceries', 'Kirana matches Groceries');
assert(detectCategory('Sabji mandi vegetables') === 'Groceries', 'Sabji mandi matches Groceries');
assert(detectCategory('Doodh and dahi daily') === 'Groceries', 'Doodh and dahi matches Groceries');
assert(detectCategory('Atta and chawal 10kg') === 'Groceries', 'Atta and chawal matches Groceries');
assert(detectCategory('Tiffin service monthly') === 'Food', 'Tiffin service matches Food');
assert(detectCategory('Nashta snacks') === 'Food', 'Nashta matches Food');
assert(detectCategory('Biryani order') === 'Food', 'Biryani matches Food');
assert(detectCategory('Chai and samosa') === 'Coffee', 'Chai matches Coffee');
assert(detectCategory('Bijli bill online payment') === 'Utilities', 'Bijli bill matches Utilities');
assert(detectCategory('Paani bill') === 'Utilities', 'Paani bill matches Utilities');
assert(detectCategory('Mobile recharge prepaid') === 'Utilities', 'Mobile recharge matches Utilities');
assert(detectCategory('Auto rickshaw fare') === 'Transport', 'Auto rickshaw matches Transport');
assert(detectCategory('Dawai from chemist shop') === 'Health', 'Dawai from chemist matches Health');
assert(detectCategory('PG rent monthly') === 'Rent', 'PG rent matches Rent');
assert(detectCategory('Ghar bhada') === 'Rent', 'Ghar bhada matches Rent');

// ─────────────────────────────────────────────────────────────────────────
// 5. TAGS & METADATA DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────
// Clean tag matching
assert(detectCategory('Random description', ['Food']) === 'Food', 'Direct valid tag wins over description');

// Non-category metadata tags preceding the category tag
assert(
  detectCategory('Random description', ['note:lunch with team', 'Food', 'payer:123:500']) === 'Food',
  'Finds valid category tag even when preceded by note: tag'
);

// Case-insensitive tag matching
assert(detectCategory('Some text', ['GROCERIES']) === 'Groceries', 'Uppercase tag "GROCERIES" matches Groceries');
assert(detectCategory('Some text', ['coffee']) === 'Coffee', 'Lowercase tag "coffee" matches Coffee');

// Non-category tags only fall back to description detection
assert(
  detectCategory('Starbucks latte', ['note:meeting', 'receipt:file.png']) === 'Coffee',
  'Skips non-category tags and detects from description'
);

// ─────────────────────────────────────────────────────────────────────────
// 6. MULTILINGUAL TESTS
// ─────────────────────────────────────────────────────────────────────────
// Spanish
assert(detectCategory('Almuerzo en restaurante') === 'Food', 'Spanish "Almuerzo" matches Food');
assert(detectCategory('Cerveza en el bar') === 'Drinks', 'Spanish "Cerveza" matches Drinks');
assert(detectCategory('Supermercado compra') === 'Groceries', 'Spanish "Supermercado" matches Groceries');

// Brazilian Portuguese
assert(detectCategory('Jantar no restaurante') === 'Food', 'Portuguese "Jantar" matches Food');
assert(detectCategory('Sacolao hortifruti') === 'Groceries', 'Portuguese "Sacolao" matches Groceries');
assert(detectCategory('Passagem de onibus') === 'Transport', 'Portuguese "onibus" matches Transport');

// French
assert(detectCategory('Dîner au bistrot') === 'Food', 'French "Dîner" matches Food');
assert(detectCategory('Billet de train pour Paris') === 'Transport', 'French "Billet de train" matches Transport');
assert(detectCategory('Abonnement electricite') === 'Utilities', 'French "electricite" matches Utilities');

// Indonesian
assert(detectCategory('Makan siang di warung') === 'Food', 'Indonesian "Makan siang" matches Food');
assert(detectCategory('Token listrik bulanan') === 'Utilities', 'Indonesian "Token listrik" matches Utilities');

// Mandarin Chinese
assert(detectCategory('吃午餐快餐') === 'Food', 'Mandarin "吃午餐" matches Food');
assert(detectCategory('打出租车去公司') === 'Transport', 'Mandarin "打出租车" matches Transport');
assert(detectCategory('超市买菜') === 'Groceries', 'Mandarin "超市买菜" matches Groceries');
assert(detectCategory('预订酒店住宿') === 'Travel', 'Mandarin "预订酒店" matches Travel');

// Japanese
assert(detectCategory('レストランでランチ') === 'Food', 'Japanese "ランチ" matches Food');
assert(detectCategory('ホテル予約') === 'Travel', 'Japanese "ホテル予約" matches Travel');
assert(detectCategory('電車定期券') === 'Transport', 'Japanese "電車" matches Transport');

// Arabic
assert(detectCategory('عشاء في المطعم') === 'Food', 'Arabic "مطعم" matches Food');
assert(detectCategory('فاتورة كهرباء') === 'Utilities', 'Arabic "كهرباء" matches Utilities');
assert(detectCategory('فندق في دبي') === 'Travel', 'Arabic "فندق" matches Travel');

// ─────────────────────────────────────────────────────────────────────────
// 7. DETAILED DETECTION RESULT & CONFIDENCE API TESTS
// ─────────────────────────────────────────────────────────────────────────
const detailResult = detectCategoryDetailed('Starbucks iced latte');
assert(detailResult.category === 'Coffee', 'Detailed API returns correct category');
assert(detailResult.confidence >= 0.9, 'Detailed API returns high confidence for merchant/keyword');
assert(detailResult.source === 'merchant' || detailResult.source === 'phrase' || detailResult.source === 'keyword', 'Detailed API returns valid source');
assert(detailResult.requiresConfirmation === false, 'Detailed API sets requiresConfirmation=false for high confidence');

// Manual Override
const manualResult = detectCategoryDetailed('Starbucks coffee', [], {
  manualCategory: 'Entertainment',
});
assert(manualResult.category === 'Entertainment', 'manualCategory overrides all automatic detection');
assert(manualResult.source === 'manual', 'manualCategory has source="manual"');
assert(manualResult.confidence === 1.0, 'manualCategory has confidence=1.0');

// Fallback Result
const fallbackResult = detectCategoryDetailed('unrecognized nonsense 9999');
assert(fallbackResult.category === 'General', 'Unknown returns General');
assert(fallbackResult.source === 'fallback', 'Unknown has source="fallback"');
assert(fallbackResult.confidence < 0.5, 'Unknown has low confidence');

console.log('─────────────────────────────────────────────────────────');
console.log(`TOTAL TESTS RUN: ${passedCount + failedCount}`);
console.log(`PASSED: ${passedCount}`);
console.log(`FAILED: ${failedCount}`);
console.log('ALL EXPENSE CATEGORY DETECTION TESTS PASSED!');
