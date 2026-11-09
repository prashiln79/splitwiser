import assert from 'assert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppearanceMode,
  ResolvedTheme,
  THEME_STORAGE_KEY,
  getStoredThemeMode,
  saveStoredThemeMode,
} from '../src/theme/themeStorage';
import {
  ThemeColors,
  lightColors,
  darkColors,
  resolveTheme,
  typography,
  spacing,
  radii,
  shadows,
} from '../src/theme/colors';

console.log('--- STARTING APPLICATION APPEARANCE & THEME UNIT TESTS ---');

// Setup in-memory mock for AsyncStorage in Node.js test environment
let inMemoryStorage: Record<string, string> = {};
(AsyncStorage as any).getItem = async (key: string) => inMemoryStorage[key] ?? null;
(AsyncStorage as any).setItem = async (key: string, val: string) => {
  inMemoryStorage[key] = val;
};
(AsyncStorage as any).clear = async () => {
  inMemoryStorage = {};
};

async function runThemeTests() {
  // 1. Resolution Logic: Light, Dark, System
  {
    assert.strictEqual(resolveTheme('light', 'light'), 'light', 'Explicit light remains light on light OS');
    assert.strictEqual(resolveTheme('light', 'dark'), 'light', 'Explicit light overrides dark OS to light');
    assert.strictEqual(resolveTheme('dark', 'light'), 'dark', 'Explicit dark overrides light OS to dark');
    assert.strictEqual(resolveTheme('dark', 'dark'), 'dark', 'Explicit dark remains dark on dark OS');
    assert.strictEqual(resolveTheme('system', 'light'), 'light', 'System mode resolves to light when OS is light');
    assert.strictEqual(resolveTheme('system', 'dark'), 'dark', 'System mode resolves to dark when OS is dark');
    assert.strictEqual(resolveTheme('system'), 'light', 'System mode defaults to light when OS scheme is omitted');
    console.log('✅ [PASS] 1. Theme resolution matrix (light, dark, system) matches specifications');
  }

  // 2. Storage Key & Default Fallback
  {
    await AsyncStorage.clear();
    assert.strictEqual(THEME_STORAGE_KEY, '@splitwiser_appearance_mode', 'Storage key matches contract');
    
    // Default fallback when nothing is stored
    const defaultMode = await getStoredThemeMode();
    assert.strictEqual(defaultMode, 'system', 'Default appearance mode must be system');

    // Persist 'dark'
    await saveStoredThemeMode('dark');
    const storedDark = await getStoredThemeMode();
    assert.strictEqual(storedDark, 'dark', 'Stored dark mode successfully persisted');

    // Persist 'light'
    await saveStoredThemeMode('light');
    const storedLight = await getStoredThemeMode();
    assert.strictEqual(storedLight, 'light', 'Stored light mode successfully persisted');

    // Persist 'system'
    await saveStoredThemeMode('system');
    const storedSystem = await getStoredThemeMode();
    assert.strictEqual(storedSystem, 'system', 'Stored system mode successfully persisted');

    // Corrupt / invalid value handling
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'invalid_mode_value');
    const fallbackMode = await getStoredThemeMode();
    assert.strictEqual(fallbackMode, 'system', 'Corrupt storage value safely falls back to system');
    console.log('✅ [PASS] 2. Theme storage persistence, key contract, and corrupt-value fallback verified');
  }

  // 3. Token Completeness & Symmetry (100% token coverage)
  {
    const lightKeys = Object.keys(lightColors).sort();
    const darkKeys = Object.keys(darkColors).sort();

    assert.deepStrictEqual(
      lightKeys,
      darkKeys,
      'Light and Dark color palettes must have identical semantic token keys'
    );

    // Verify all keys have valid string values
    for (const key of lightKeys as (keyof ThemeColors)[]) {
      const lightVal = lightColors[key];
      const darkVal = darkColors[key];
      assert.ok(lightVal, `Light token ${key} must not be empty`);
      assert.ok(darkVal, `Dark token ${key} must not be empty`);
    }

    // Verify critical token groups
    const requiredSemanticTokens: (keyof ThemeColors)[] = [
      'primary',
      'primaryLight',
      'primaryDark',
      'primaryGradient',
      'primaryText',
      'secondary',
      'background',
      'surface',
      'surfaceVariant',
      'surfaceSecondary',
      'card',
      'textPrimary',
      'textSecondary',
      'textMuted',
      'textInverse',
      'border',
      'borderLight',
      'divider',
      'income',
      'incomeLight',
      'incomeDark',
      'success',
      'expense',
      'expenseLight',
      'expenseDark',
      'danger',
      'warning',
      'info',
      'inputBackground',
      'tabBackground',
      'modalBackground',
    ];

    for (const token of requiredSemanticTokens) {
      assert.ok(token in lightColors, `Missing semantic token in lightColors: ${token}`);
      assert.ok(token in darkColors, `Missing semantic token in darkColors: ${token}`);
    }
    console.log('✅ [PASS] 3. Token completeness & symmetry between light and dark palettes verified');
  }

  // 4. Financial Semantics & Brand Integrity
  {
    // Brand emerald green
    assert.strictEqual(lightColors.primary, '#059669', 'Light primary matches brand emerald 600');
    assert.strictEqual(darkColors.primary, '#10B981', 'Dark primary matches brand emerald 500 for high dark contrast');

    // Income / positive balances
    assert.strictEqual(lightColors.income, '#10B981', 'Light income is emerald');
    assert.strictEqual(darkColors.income, '#34D399', 'Dark income is vibrant emerald');
    assert.strictEqual(lightColors.success, lightColors.income, 'Light success matches income');
    assert.strictEqual(darkColors.success, darkColors.income, 'Dark success matches income');

    // Expense / negative balances / debts
    assert.strictEqual(lightColors.expense, '#EF4444', 'Light expense is red');
    assert.strictEqual(darkColors.expense, '#F87171', 'Dark expense is vibrant red');
    assert.strictEqual(lightColors.danger, lightColors.expense, 'Light danger matches expense');
    assert.strictEqual(darkColors.danger, darkColors.expense, 'Dark danger matches expense');

    console.log('✅ [PASS] 4. Financial semantics (income/expense/brand) preserved across both themes');
  }

  // 5. Dark Mode Contrast & Inversion
  {
    // Dark background must be very dark slate
    assert.strictEqual(darkColors.background, '#0B1120', 'Dark background is #0B1120');
    assert.strictEqual(darkColors.surface, '#151F32', 'Dark surface is distinct from background');
    assert.notStrictEqual(darkColors.background, darkColors.surface, 'Dark surface and background are distinct');

    // Light background must be light slate
    assert.strictEqual(lightColors.background, '#F8FAFC', 'Light background is #F8FAFC');
    assert.strictEqual(lightColors.surface, '#FFFFFF', 'Light surface is #FFFFFF');
    assert.notStrictEqual(lightColors.background, lightColors.surface, 'Light surface and background are distinct');

    // Text contrast
    assert.notStrictEqual(darkColors.textPrimary, darkColors.background, 'Dark textPrimary contrast');
    assert.notStrictEqual(lightColors.textPrimary, lightColors.background, 'Light textPrimary contrast');
    console.log('✅ [PASS] 5. Background, surface elevation, and text contrast validated');
  }

  // 6. Typography, Spacing, Radii & Shadows Constants
  {
    assert.ok(typography.sizes.base === 15, 'Base font size is 15');
    assert.ok(spacing.base === 16, 'Base spacing is 16');
    assert.ok(radii.lg === 16, 'Radius lg is 16');
    assert.ok(shadows.md.elevation === 3, 'Shadow md elevation is 3');
    console.log('✅ [PASS] 6. Design token scales (typography, spacing, radii, shadows) verified');
  }

  console.log('\n🎉 ALL 6 APPLICATION APPEARANCE & THEME TEST SUITES PASSED!\n');
}

runThemeTests().catch((err) => {
  console.error('❌ Theme test failure:', err);
  process.exit(1);
});
