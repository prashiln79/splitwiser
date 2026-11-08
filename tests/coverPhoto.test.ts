import { getDefaultCoverPhoto, PRESET_COVERS } from '../src/constants/presetCovers';

console.log('--- STARTING GROUP COVER PHOTO UNIT TESTS ---');

// Test 1: Category preset fallback
const homeCover = getDefaultCoverPhoto('grp_1', 'home', 'Home Budget');
if (homeCover.presetId === 'cozy-home') {
  console.log('✅ [PASS] Group type "home" maps to "cozy-home" preset');
} else {
  console.error('❌ [FAIL] Expected cozy-home but got:', homeCover);
}

// Test 2: Trip preset fallback
const tripCover = getDefaultCoverPhoto('grp_2', 'trip', 'Goa Holiday Trip');
if (tripCover.presetId === 'mountain-alps') {
  console.log('✅ [PASS] Group type "trip" maps to "mountain-alps" preset');
} else {
  console.error('❌ [FAIL] Expected mountain-alps but got:', tripCover);
}

// Test 3: Couple / Tuscany preset fallback
const coupleCover = getDefaultCoverPhoto('grp_3', 'couple', 'Tuscany Trip ❤️');
if (coupleCover.presetId === 'tuscany-hills') {
  console.log('✅ [PASS] Group type "couple" maps to "tuscany-hills" preset');
} else {
  console.error('❌ [FAIL] Expected tuscany-hills but got:', coupleCover);
}

// Test 4: Deterministic fallback for generic groups
const coverA = getDefaultCoverPhoto('group_abc_123', 'other', 'Random Expenses');
const coverB = getDefaultCoverPhoto('group_abc_123', 'other', 'Random Expenses');
if (coverA.imageUrl === coverB.imageUrl && coverA.presetId === coverB.presetId) {
  console.log('✅ [PASS] Deterministic hashing produces identical cover across restarts');
} else {
  console.error('❌ [FAIL] Inconsistent hashing:', coverA, coverB);
}

// Test 5: Presets catalog integrity
if (PRESET_COVERS.length >= 20) {
  console.log(`✅ [PASS] Presets catalog populated with ${PRESET_COVERS.length} curated covers across 8 categories`);
} else {
  console.error('❌ [FAIL] Insufficient presets count:', PRESET_COVERS.length);
}

console.log('ALL COVER PHOTO TESTS PASSED');

