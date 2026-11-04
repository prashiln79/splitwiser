import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  User,
  Edit3,
  Shield,
  MessageSquare,
  Info,
  ChevronRight,
  Sparkles,
  Lock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';

const AccountScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleComingSoon = (feature: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Alert.alert(feature, 'This feature will be available in the upcoming release.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Account" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 80, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Hero Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <MemberAvatar
            name={user?.name || 'User'}
            imageUrl={user?.imageUrl}
            size={76}
          />

          <View style={styles.profileTextInfo}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>
              {user?.name || 'Anonymous User'}
            </Text>

            <View style={[styles.statusBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Lock size={12} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                {user?.isAnonymous ? 'Instant Guest Account' : 'Verified Profile'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.editProfileBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
          >
            <Edit3 size={15} color={colors.primaryDark} strokeWidth={2.2} />
            <Text style={[styles.editProfileText, { color: colors.primaryDark }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 1: Account Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ACCOUNT
          </Text>

          <View
            style={[
              styles.cardGroup,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <User size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Personal Information
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => handleComingSoon('Privacy & Data')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
                  <Shield size={18} color={colors.secondary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Privacy & Data
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Support & About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            SUPPORT & ABOUT
          </Text>

          <View
            style={[
              styles.cardGroup,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}
              onPress={() => handleComingSoon('Feedback')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.incomeLight }]}>
                  <MessageSquare size={18} color={colors.income} strokeWidth={2.2} />
                </View>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  Send Feedback
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() =>
                Alert.alert(
                  'About Splitwiser',
                  'Splitwiser is a modern, simple expense splitting app designed for stress-free shared finances with friends and roommates.\n\nVersion 1.0.0 (Expo SDK 58)'
                )
              }
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceVariant }]}>
                  <Info size={18} color={colors.textSecondary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                  About Splitwiser
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version Tag */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            Splitwiser Mobile • Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 48,
  },
  profileCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  profileTextInfo: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radii.full,
  },
  editProfileText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  cardGroup: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  versionText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
});

export default AccountScreen;
