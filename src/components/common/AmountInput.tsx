import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useAppTheme, typography, spacing, radii } from '../../theme';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  currencySymbol?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChangeText,
  currencySymbol = '₹',
  placeholder = '0.00',
  autoFocus = false,
}) => {
  const { colors } = useAppTheme();

  const handleChange = (text: string) => {
    // Sanitize input: allow only digits and single decimal point with up to 2 decimal places
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    onChangeText(cleaned);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>
        {currencySymbol}
      </Text>
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        accessibilityLabel="Expense amount"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    marginVertical: spacing.sm,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    marginRight: 6,
  },
  input: {
    fontSize: 36,
    fontWeight: '800',
    minWidth: 120,
    letterSpacing: -0.5,
    padding: 0,
  },
});

