import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Hash, ArrowRight, Sparkles, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { joinGroup } from '../services/groups';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';

const JoinGroupScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Code Required', 'Please enter a 6-character group join code.');
      return;
    }
    if (!user) return;

    setIsJoining(true);
    try {
      const group = await joinGroup(code, user.uid, user.name);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Welcome!', `You have successfully joined "${group.name}".`);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Unable to Join', error.message || 'No group found with that code. Please verify and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Join a Group"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        {/* Hero Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Hash size={32} color={colors.primary} strokeWidth={2.4} />
          </View>

          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            Enter Group Code
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Ask the group creator or members to share their 6-character join code found in group details.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: joinCode.trim().length >= 6 ? colors.primary : colors.border,
                  color: colors.textPrimary,
                },
              ]}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              placeholder="e.g. 7X8K2M"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleJoinGroup}
              autoFocus
              accessibilityLabel="Group Join Code"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.joinButton,
              {
                backgroundColor:
                  joinCode.trim().length >= 4 ? colors.primary : colors.surfaceVariant,
              },
              shadows.sm,
            ]}
            onPress={handleJoinGroup}
            disabled={isJoining || joinCode.trim().length < 4}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Join Group"
          >
            {isJoining ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text
                  style={[
                    styles.joinButtonText,
                    {
                      color:
                        joinCode.trim().length >= 4 ? '#FFFFFF' : colors.textMuted,
                    },
                  ]}
                >
                  Join Group
                </Text>
                <ArrowRight
                  size={16}
                  color={joinCode.trim().length >= 4 ? '#FFFFFF' : colors.textMuted}
                  strokeWidth={2.2}
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingTop: spacing.xl,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  cardTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: typography.lineHeights.sm,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  codeInput: {
    borderWidth: 2,
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 26,
    fontFamily: 'Courier',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 4,
  },
  joinButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base,
    borderRadius: radii.xl,
  },
  joinButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
});

export default JoinGroupScreen;
