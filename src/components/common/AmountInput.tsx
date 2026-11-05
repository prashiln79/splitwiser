import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

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
  const handleChange = (text: string) => {
    // Sanitize input: allow only digits and single decimal point with up to 2 decimal places
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    onChangeText(cleaned);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.currencySymbol}>{currencySymbol}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor="#CCCCCC"
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
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 4,
  },
  input: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1A1A1A',
    minWidth: 80,
    letterSpacing: -0.5,
    padding: 0,
  },
});
