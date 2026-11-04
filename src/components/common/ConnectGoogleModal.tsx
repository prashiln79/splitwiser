import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../../theme';
import { GoogleIcon } from './GoogleIcon';
import { useGoogleAuth, GoogleAuthTokens } from '../../services/useGoogleAuth';

interface ConnectGoogleModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess?: () => void;
}

export const ConnectGoogleModal: React.FC<ConnectGoogleModalProps> = ({
  visible,
  onDismiss,
  onSuccess,
}) => {
  const { colors } = useAppTheme();
  const { user, linkGoogleAccount, signInWithGoogle, migrateAnonymousDataToGoogle } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [conflictTokens, setConflictTokens] = useState<GoogleAuthTokens | null>(null);

  const handleTokensReceived = async (tokens: GoogleAuthTokens) => {
    setIsLoading(true);
    try {
      const prevUid = user?.uid;
      const result = await linkGoogleAccount(tokens.idToken, tokens.accessToken);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Account Connected!',
        `Your Splitwiser account is now linked to Google (${result.user.email || 'Google'}). Your UID and all existing groups remain intact.`
      );
      if (onSuccess) onSuccess();
      onDismiss();
    } catch (err: any) {
      console.error('[ConnectGoogle] Error:', err);
      if (err.code === 'auth/credential-already-in-use') {
        // Handle credential conflict explicitly
        setConflictTokens(tokens);
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User cancelled, no error alert needed
      } else {
        Alert.alert('Linking Failed', err.message || 'Unable to connect Google account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const { promptAsync, isReady } = useGoogleAuth(
    handleTokensReceived,
    (err) => {
      setIsLoading(false);
      Alert.alert('Google Sign-In Error', err.message || 'Failed to authenticate with Google.');
    }
  );

  const handleStartGoogleLinking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        setIsLoading(false);
      }
    } catch (e: any) {
      setIsLoading(false);
      Alert.alert('Error', e.message || 'Failed to start Google authentication.');
    }
  };

  // Conflict Resolution 1: Switch to existing Google account
  const handleSwitchToExistingAccount = async () => {
    if (!conflictTokens) return;
    setIsLoading(true);
    try {
      await signInWithGoogle(conflictTokens.idToken, conflictTokens.accessToken);
      setConflictTokens(null);
      Alert.alert('Signed In', 'Logged into your existing Google Splitwiser account.');
      onDismiss();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to switch account.');
    } finally {
      setIsLoading(false);
    }
  };

  // Conflict Resolution 2: Merge current groups and data into existing Google account
  const handleMergeAndMigrateData = async () => {
    if (!conflictTokens) return;
    setIsLoading(true);
    try {
      await migrateAnonymousDataToGoogle(conflictTokens.idToken, conflictTokens.accessToken);
      setConflictTokens(null);
      Alert.alert('Data Merged!', 'All your current groups and expenses have been securely transferred to your Google account.');
      onDismiss();
    } catch (e: any) {
      Alert.alert('Merge Failed', e.message || 'Failed to migrate data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.lg,
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
              {conflictTokens ? 'Account Conflict' : 'Connect Google Account'}
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant }]}
              accessibilityRole="button"
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {conflictTokens ? (
            /* Conflict Resolution View */
            <View style={styles.conflictContainer}>
              <View style={[styles.warningBox, { backgroundColor: colors.warningLight }]}>
                <AlertTriangle size={20} color={colors.warning} strokeWidth={2.2} style={{ marginRight: 8 }} />
                <Text style={[styles.warningText, { color: colors.textPrimary }]}>
                  This Google account is already linked to another Splitwiser account.
                </Text>
              </View>

              <Text style={[styles.conflictDesc, { color: colors.textSecondary }]}>
                Your current anonymous data has not been touched. Choose how you would like to proceed:
              </Text>

              <TouchableOpacity
                style={[styles.conflictActionBtn, { backgroundColor: colors.primary }]}
                onPress={handleMergeAndMigrateData}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <RefreshCw size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
                    <Text style={styles.conflictActionText}>
                      Merge Current Groups into Google Account
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.conflictActionBtn,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderWidth: 1, marginTop: spacing.sm },
                ]}
                onPress={handleSwitchToExistingAccount}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={[styles.conflictSecondaryText, { color: colors.textPrimary }]}>
                  Switch to Existing Google Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelBtn, { marginTop: spacing.sm }]}
                onPress={() => setConflictTokens(null)}
                disabled={isLoading}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                  Cancel and Keep Guest Account
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Standard Connect View */
            <>
              <Text style={[styles.dialogSubtitle, { color: colors.textSecondary }]}>
                Upgrade your guest account without losing your data. Your existing groups, expenses, and balances remain completely intact.
              </Text>

              {/* Benefits */}
              <View style={styles.benefitsList}>
                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconCircle, { backgroundColor: colors.primaryLight }]}>
                    <ShieldCheck size={18} color={colors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.benefitTextCol}>
                    <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                      Permanent Backup
                    </Text>
                    <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                      Never lose your groups even if you clear app data or change phones.
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconCircle, { backgroundColor: colors.secondaryLight }]}>
                    <Smartphone size={18} color={colors.secondary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.benefitTextCol}>
                    <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                      Multi-Device Sync
                    </Text>
                    <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                      Log in to your account from any other Android, iOS, or web device.
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconCircle, { backgroundColor: colors.incomeLight }]}>
                    <CheckCircle2 size={18} color={colors.income} strokeWidth={2.2} />
                  </View>
                  <View style={styles.benefitTextCol}>
                    <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                      UID Preserved
                    </Text>
                    <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                      Existing user ID ({user?.uid.slice(0, 8)}...) remains completely unchanged.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Google Button */}
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  { backgroundColor: '#FFFFFF', borderColor: colors.border },
                  shadows.sm,
                ]}
                onPress={handleStartGoogleLinking}
                disabled={isLoading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Connect with Google"
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <GoogleIcon size={20} />
                    <Text style={styles.googleButtonText}>
                      Connect with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dialogTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSubtitle: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
    marginBottom: spacing.base,
  },
  benefitsList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  benefitIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  benefitDesc: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
    lineHeight: typography.lineHeights.xs,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  googleButtonText: {
    color: '#0F172A',
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  conflictContainer: {
    paddingVertical: spacing.xs,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  warningText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    flex: 1,
  },
  conflictDesc: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.lineHeights.xs,
    marginBottom: spacing.base,
  },
  conflictActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  conflictActionText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  conflictSecondaryText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
});

