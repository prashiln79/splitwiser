import React, { useState } from 'react';
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
  LogOut,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { GoogleIcon } from '../components/common/GoogleIcon';
import { ConnectGoogleModal } from '../components/common/ConnectGoogleModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

const AccountScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [confirmSignOutVisible, setConfirmSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isGoogleLinked = !user?.isAnonymous && user?.authProvider === 'google';

  const handleComingSoon = (feature: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Alert.alert(feature, 'This feature will be available in the upcoming release.');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setConfirmSignOutVisible(false);
    } catch (err: any) {
      Alert.alert('Sign Out Failed', err.message || 'Could not sign out.');
    } finally {
      setIsSigningOut(false);
    }
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

            {isGoogleLinked ? (
              <View style={[styles.statusBadge, { backgroundColor: colors.incomeLight }]}>
                <CheckCircle2 size={13} color={colors.income} strokeWidth={2.4} />
                <Text style={[styles.statusBadgeText, { color: colors.incomeDark }]}>
                  {user?.email || 'Google Account Connected'}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Lock size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                  Guest Account • UID: {user?.uid.slice(0, 8)}...
                </Text>
              </View>
            )}
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

        {/* Upgrade to Google Account Banner (when user is anonymous) */}
        {!isGoogleLinked && (
          <View
            style={[
              styles.upgradeBannerCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={styles.upgradeTopRow}>
              <View style={[styles.upgradeIconCircle, { backgroundColor: colors.primaryLight }]}>
                <GoogleIcon size={22} />
              </View>
              <View style={styles.upgradeHeaderTexts}>
                <Text style={[styles.upgradeTitle, { color: colors.textPrimary }]}>
                  Connect Google Account
                </Text>
                <Text style={[styles.upgradeSubtitle, { color: colors.textSecondary }]}>
                  Backup your data and sync across devices.
                </Text>
              </View>
            </View>

            <Text style={[styles.upgradeDescription, { color: colors.textSecondary }]}>
              Your existing Firebase UID ({user?.uid.slice(0, 8)}...) and all your groups, expenses, and balances will remain completely intact.
            </Text>

            <TouchableOpacity
              style={[
                styles.connectGoogleBtn,
                { backgroundColor: '#FFFFFF', borderColor: colors.border },
                shadows.sm,
              ]}
              onPress={() => setConnectModalVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Connect Google Account"
            >
              <GoogleIcon size={18} />
              <Text style={styles.connectGoogleBtnText}>
                Connect Google Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

            {!isGoogleLinked ? (
              <TouchableOpacity
                style={[styles.settingRow, { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}
                onPress={() => setConnectModalVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F8FAFC' }]}>
                    <GoogleIcon size={18} />
                  </View>
                  <View>
                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                      Connect Google
                    </Text>
                    <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                      Upgrade guest account
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}

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

        {/* Section 2: Support & About */}
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

        {/* Sign Out Button (for linked or returning accounts) */}
        {isGoogleLinked && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.signOutCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                shadows.sm,
              ]}
              onPress={() => setConfirmSignOutVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
            >
              <LogOut size={18} color={colors.expense} strokeWidth={2.2} style={{ marginRight: 8 }} />
              <Text style={[styles.signOutText, { color: colors.expense }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* App Version Tag */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            Splitwiser Mobile • Version 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Connect Google Modal */}
      <ConnectGoogleModal
        visible={connectModalVisible}
        onDismiss={() => setConnectModalVisible(false)}
      />

      {/* Sign Out Confirmation */}
      <ConfirmationDialog
        visible={confirmSignOutVisible}
        onDismiss={() => setConfirmSignOutVisible(false)}
        onConfirm={handleSignOut}
        title="Sign Out?"
        message="Your account is safely linked to Google. You can sign back in anytime on this or another device."
        confirmLabel="Sign Out"
        isDestructive
        isLoading={isSigningOut}
        icon="logout"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  profileCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: spacing.base,
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
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
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
  upgradeBannerCard: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1.5,
    marginBottom: spacing.lg,
  },
  upgradeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  upgradeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeHeaderTexts: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  upgradeSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  upgradeDescription: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
    marginBottom: spacing.md,
  },
  connectGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md - 2,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  connectGoogleBtnText: {
    color: '#0F172A',
    fontSize: typography.sizes.sm,
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
  settingSub: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  versionText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
});

export default AccountScreen;
