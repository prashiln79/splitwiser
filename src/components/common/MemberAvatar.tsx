import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';

interface MemberAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  showAdminBadge?: boolean;
}

const AVATAR_COLORS = [
  '#059669', // Emerald
  '#0284C7', // Sky
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#EA580C', // Orange
  '#4F46E5', // Indigo
  '#D97706', // Amber
  '#0891B2', // Cyan
];

export const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  imageUrl,
  size = 40,
  showAdminBadge = false,
}) => {
  const { colors } = useAppTheme();
  const isImageValid = imageUrl && /^(https?:|data:image)/.test(imageUrl);
  const bgColor = getAvatarColor(name || 'User');
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {isImageValid ? (
        <Image
          source={{ uri: imageUrl! }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bgColor,
            },
          ]}
        >
          <Text
            style={[
              styles.initialsText,
              {
                fontSize: Math.round(size * 0.42),
                lineHeight: Math.round(size * 0.48),
              },
            ]}
          >
            {initial}
          </Text>
        </View>
      )}

      {showAdminBadge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.surface,
              right: -2,
              bottom: -2,
              width: Math.max(14, size * 0.32),
              height: Math.max(14, size * 0.32),
              borderRadius: Math.max(7, size * 0.16),
            },
          ]}
        >
          <Text style={styles.badgeText}>★</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
});

