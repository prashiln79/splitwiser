import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { MemberAvatar } from '../common/MemberAvatar';
import { useAppTheme, ThemeColors } from '../../theme';

interface ParticipantRowProps {
  name: string;
  isCurrentUser?: boolean;
  avatarUrl?: string;
  subtitle?: string;
  badgeText?: string;
  rightAccessory?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const ParticipantRow: React.FC<ParticipantRowProps> = ({
  name,
  isCurrentUser = false,
  avatarUrl,
  subtitle,
  badgeText,
  rightAccessory,
  onPress,
  style,
  disabled = false,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const content = (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        <MemberAvatar name={name} size={36} imageUrl={avatarUrl} />
        <View style={styles.textContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {isCurrentUser ? `${name} (You)` : name}
            </Text>
            {badgeText && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
        </View>
      </View>

      {rightAccessory && <View style={styles.rightSection}>{rightAccessory}</View>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={isCurrentUser ? `${name} (You)` : name}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 12,
    },
    textContainer: {
      marginLeft: 12,
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    nameText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    subtitleText: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },
    badge: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#059669',
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

