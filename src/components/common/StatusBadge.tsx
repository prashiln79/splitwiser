import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, ArrowUpRight, ArrowDownLeft, Shield, User, Copy } from 'lucide-react-native';
import { useAppTheme, typography, spacing, radii } from '../../theme';

export type StatusBadgeVariant =
  | 'settled'
  | 'lent'
  | 'borrowed'
  | 'code'
  | 'admin'
  | 'member'
  | 'neutral';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  onPress?: () => void;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  onPress,
  size = 'md',
}) => {
  const { colors } = useAppTheme();

  let bgColor = colors.surfaceVariant;
  let textColor = colors.textSecondary;
  let borderColor = colors.border;
  let icon: React.ReactNode = null;
  const iconSize = size === 'sm' ? 12 : 14;

  switch (variant) {
    case 'settled':
      bgColor = colors.incomeLight;
      textColor = colors.incomeDark;
      borderColor = colors.income + '40';
      icon = <Check size={iconSize} color={textColor} strokeWidth={2.5} />;
      break;
    case 'lent':
      bgColor = colors.incomeLight;
      textColor = colors.income;
      borderColor = colors.income + '40';
      icon = <ArrowUpRight size={iconSize} color={textColor} strokeWidth={2.5} />;
      break;
    case 'borrowed':
      bgColor = colors.expenseLight;
      textColor = colors.expense;
      borderColor = colors.expense + '40';
      icon = <ArrowDownLeft size={iconSize} color={textColor} strokeWidth={2.5} />;
      break;
    case 'code':
      bgColor = colors.primaryLight;
      textColor = colors.primaryDark;
      borderColor = colors.primary + '50';
      icon = <Copy size={iconSize} color={textColor} strokeWidth={2} />;
      break;
    case 'admin':
      bgColor = colors.secondaryLight;
      textColor = colors.secondary;
      borderColor = colors.secondary + '40';
      icon = <Shield size={iconSize} color={textColor} strokeWidth={2} />;
      break;
    case 'member':
      bgColor = colors.surfaceVariant;
      textColor = colors.textSecondary;
      borderColor = colors.border;
      icon = <User size={iconSize} color={textColor} strokeWidth={2} />;
      break;
    default:
      bgColor = colors.surfaceVariant;
      textColor = colors.textSecondary;
      borderColor = colors.border;
  }

  const content = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor,
          paddingVertical: size === 'sm' ? 2 : 4,
          paddingHorizontal: size === 'sm' ? 6 : 8,
        },
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: size === 'sm' ? typography.sizes.xs - 1 : typography.sizes.xs,
          },
          variant === 'code' && styles.codeText,
        ]}
      >
        {label || (variant === 'settled' ? 'Settled up' : '')}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  codeText: {
    fontFamily: 'Courier',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});

