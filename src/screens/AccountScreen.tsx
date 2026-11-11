import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Modal,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Mail,
  Bell,
  Lock,
  Palette,
  QrCode,
  CircleQuestionMark,
  MessageSquare,
  Search,
  Camera,
  Check,
  ChevronRight,
  LogOut,
  X,
  Sparkles,
  Shield,
  Smartphone,
  Share2,
  Vibrate,
  VibrateOff,
  Globe,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { SUPPORTED_LOCALES, LOCALE_NATIVE_NAMES, LOCALE_DISPLAY_NAMES } from '../i18n';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { compressAvatarPhoto } from '../utils/imageCompressor';
import { resolveProfilePicture } from '../utils/profilePhotoHelper';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { ProfilePhotoModal } from '../components/common/ProfilePhotoModal';
import { useAppTheme, ThemeColors } from '../theme';
import { useNotifications } from '../context/NotificationContext';
import { useSecurity } from '../context/SecurityContext';
import { SecuritySettingsModal } from '../components/security/SecuritySettingsModal';
import { submitSupportTicket } from '../services/support';
import { hapticsService } from '../services/hapticsService';

export const AccountScreen = ({ navigation }: any) => {
  const { user, signOut, updateProfile } = useAuth();
  const { isSecurityEnabled, isBiometricsEnabled, biometricType } = useSecurity();
  const { colors, isDark, themeMode, setThemeMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const switchTrackColor = useMemo(
    () => ({ false: isDark ? '#4B5563' : '#D1D5DB', true: '#A7F3D0' }),
    [isDark]
  );
  const getSwitchThumbColor = (val: boolean) =>
    val ? '#059669' : (isDark ? '#9CA3AF' : '#F4F3F4');
  const { currentLocale, isSystemLanguage, changeLanguage } = useI18n();
  const { unreadCount, preferences, updatePreferences, markAllAsRead } = useNotifications();
  const { t } = useTranslation(['settings', 'common', 'auth']);
  const insets = useSafeAreaInsets();

  const [confirmSignOutVisible, setConfirmSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Scan / QR Code Modal
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [profilePhotoModalVisible, setProfilePhotoModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  // Preferences Modals
  const [emailSettingsVisible, setEmailSettingsVisible] = useState(false);
  const [notificationSettingsVisible, setNotificationSettingsVisible] = useState(false);
  const [securitySettingsVisible, setSecuritySettingsVisible] = useState(false);
  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [helpCenterVisible, setHelpCenterVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  // Search in Account
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Preference switches state
  const [emailWeeklySummary, setEmailWeeklySummary] = useState(true);
  const [emailExpenseAdded, setEmailExpenseAdded] = useState(true);
  const [emailSettledUp, setEmailSettledUp] = useState(true);

  // Global Haptic Feedback preference
  const [hapticsEnabled, setHapticsEnabled] = useState(hapticsService.isEnabled());

  useEffect(() => {
    const unsub = hapticsService.subscribe(setHapticsEnabled);
    return unsub;
  }, []);

  const handleToggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    hapticsService.setEnabled(val);
  };

  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Message Required', 'Please enter your message or question before sending.');
      return;
    }

    setIsSendingFeedback(true);
    try {
      await submitSupportTicket({
        userId: user?.uid || 'anonymous',
        userName: user?.name || 'User',
        userEmail: user?.email,
        message: feedbackText.trim(),
      });

      hapticsService.notification(Haptics.NotificationFeedbackType.Success);

      setSupportModalVisible(false);
      setFeedbackText('');
      Alert.alert(
        'Ticket Submitted',
        'Thank you for reaching out! Your support ticket has been received and our team will review it shortly.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const isGoogleLinked = !user?.isAnonymous && user?.authProvider === 'google';

  // Resolve the best available profile photo (custom → google → initials)
  const { displayUrl: resolvedPhotoUrl } = resolveProfilePicture(user);

  const handlePickAvatar = () => {
    hapticsService.impact(Haptics.ImpactFeedbackStyle.Light);
    setProfilePhotoModalVisible(true);
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
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        {isSearchActive ? (
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search settings..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}
            >
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Account</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => {
                  hapticsService.impact(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('NotificationCenter');
                }}
                style={styles.headerBellBtn}
                accessibilityLabel="Notifications"
                accessibilityRole="button"
              >
                <Bell size={22} color={colors.textPrimary} strokeWidth={2.2} />
                {unreadCount > 0 && (
                  <View style={[styles.headerBellBadge, { backgroundColor: colors.danger || '#EF4444' }]}>
                    <Text style={styles.headerBellBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsSearchActive(true)}
                style={styles.headerSearchBtn}
                accessibilityLabel="Search settings"
                accessibilityRole="button"
              >
                <Search size={22} color={colors.textPrimary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 80, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card matching Screen 01 */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
          >
            <MemberAvatar
              name={user?.name || 'User'}
              imageUrl={resolvedPhotoUrl ?? user?.imageUrl}
              size={64}
            />
            <View style={styles.cameraIconBadge}>
              <Camera size={13} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>

          <View style={styles.profileDetails}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.name || 'Anonymous User'}
            </Text>
            <Text style={styles.profileSub} numberOfLines={1}>
              {user?.email || (user?.phone ? user.phone : 'Guest Account')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => {
              hapticsService.impact(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('EditProfile');
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit Account"
          >
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Top Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.quickActionRow, { borderBottomWidth: 0 }]}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.quickActionLeft}>
              <QrCode size={20} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
              <Text style={styles.quickActionText}>Scan code</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section: Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Preferences</Text>
          <View style={styles.sectionBody}>
            {/* Haptic feedback */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => handleToggleHaptics(!hapticsEnabled)}
              activeOpacity={0.8}
            >
              <View style={styles.settingItemLeft}>
                {hapticsEnabled ? (
                  <Vibrate size={19} color="#059669" strokeWidth={2} style={styles.rowIcon} />
                ) : (
                  <VibrateOff size={19} color="#9CA3AF" strokeWidth={2} style={styles.rowIcon} />
                )}
                <View style={styles.settingItemTextCol}>
                  <Text style={styles.settingItemTitle}>Haptic feedback</Text>
                  <Text style={styles.settingItemSubtitle}>Vibration on buttons, tabs and settlements</Text>
                </View>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(hapticsEnabled)}
              />
            </TouchableOpacity>

            {/* Email settings */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setEmailSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Mail size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Email settings</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Notification settings */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setNotificationSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Bell size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Notification settings</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <View style={[styles.unreadBadgeSmall, { backgroundColor: colors.danger || '#EF4444' }]}>
                    <Text style={styles.unreadBadgeSmallText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Security */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setSecuritySettingsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Lock size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Security</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textMuted, marginRight: 6 }}>
                  {isSecurityEnabled
                    ? isBiometricsEnabled
                      ? biometricType === 'face'
                        ? 'Face ID'
                        : 'Biometrics'
                      : 'Passcode'
                    : 'Off'}
                </Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Appearance */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setAppearanceVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Palette size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>{t('settings:appearance', { defaultValue: 'Appearance' })}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textMuted, marginRight: 6 }}>
                  {themeMode === 'system'
                    ? t('settings:system', { defaultValue: 'System default' })
                    : themeMode === 'light'
                    ? t('settings:light', { defaultValue: 'Light mode' })
                    : t('settings:dark', { defaultValue: 'Dark mode' })}
                </Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity
              style={[styles.settingItemRow, { borderBottomWidth: 0 }]}
              onPress={() => setLanguageModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Globe size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>{t('settings:language', { defaultValue: 'Language' })}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textMuted, marginRight: 6 }}>
                  {isSystemLanguage
                    ? t('common:systemDefault', { defaultValue: 'System Default' })
                    : LOCALE_NATIVE_NAMES[currentLocale] || currentLocale}
                </Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Help & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Help & Support</Text>
          <View style={styles.sectionBody}>
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setHelpCenterVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <CircleQuestionMark size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Help Center</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItemRow, { borderBottomWidth: 0 }]}
              onPress={() => setSupportModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <MessageSquare size={19} color={colors.textPrimary} strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Contact Splitwise support</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>


        {/* Log Out Button (Available for all signed-in users including guests) */}
        {Boolean(user) && (
          <TouchableOpacity
            style={styles.logOutBtn}
            onPress={() => setConfirmSignOutVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <LogOut size={18} color="#E11D48" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.logOutBtnText}>
              {user?.isAnonymous ? 'Log Out (Guest)' : 'Log Out'}
            </Text>
          </TouchableOpacity>
        )}

        {/* App Version */}
        <Text style={styles.versionText}>Splitwiser v2.0.1</Text>
      </ScrollView>

      {/* ── Scan Code / QR Modal ───────────────────────────────────────────── */}
      <QrCodeModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
      />

      {/* ── Language Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Language</Text>
            <Text style={styles.dialogSub}>Select your preferred app language.</Text>

            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {/* System default option */}
              <TouchableOpacity
                style={[
                  styles.themeOptionRow,
                  isSystemLanguage && styles.themeOptionRowSelected,
                ]}
                onPress={async () => {
                  try {
                    await Haptics.selectionAsync();
                  } catch {
                    // ignore
                  }
                  await changeLanguage(null, user?.uid);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.themeOptionText,
                      isSystemLanguage && { color: colors.primary, fontWeight: '700' },
                    ]}
                  >
                    Device default
                  </Text>
                  <Text style={styles.themeOptionSubText}>System Default</Text>
                </View>
                {isSystemLanguage && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
              </TouchableOpacity>

              {/* Supported Languages */}
              {SUPPORTED_LOCALES.map((locale) => {
                const isSelected = !isSystemLanguage && currentLocale === locale;
                return (
                  <TouchableOpacity
                    key={locale}
                    style={[
                      styles.themeOptionRow,
                      isSelected && styles.themeOptionRowSelected,
                    ]}
                    onPress={async () => {
                      try {
                        await Haptics.selectionAsync();
                      } catch {
                        // ignore
                      }
                      await changeLanguage(locale, user?.uid);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.themeOptionText,
                          isSelected && { color: colors.primary, fontWeight: '700' },
                        ]}
                      >
                        {LOCALE_NATIVE_NAMES[locale]}
                      </Text>
                      <Text style={styles.themeOptionSubText}>
                        {LOCALE_DISPLAY_NAMES[locale]}
                      </Text>
                    </View>
                    {isSelected && (
                      <Check size={18} color={colors.primary} strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Apply Language</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Email Settings Modal ───────────────────────────────────────────── */}
      <Modal
        visible={emailSettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEmailSettingsVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Email Preferences</Text>
            <Text style={styles.dialogSub}>
              Choose what notifications and summaries you want sent to {user?.email || 'your email'}.
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Weekly spending summary</Text>
              <Switch
                value={emailWeeklySummary}
                onValueChange={setEmailWeeklySummary}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(emailWeeklySummary)}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>When someone adds an expense</Text>
              <Switch
                value={emailExpenseAdded}
                onValueChange={setEmailExpenseAdded}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(emailExpenseAdded)}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>When someone records a settlement</Text>
              <Switch
                value={emailSettledUp}
                onValueChange={setEmailSettledUp}
                trackColor={switchTrackColor}
                thumbColor={getSwitchThumbColor(emailSettledUp)}
              />
            </View>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => {
                setEmailSettingsVisible(false);
                hapticsService.notification(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={styles.dialogPrimaryBtnText}>Save Preferences</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Notification Settings Modal ───────────────────────────────────── */}
      <Modal
        visible={notificationSettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setNotificationSettingsVisible(false)}
        >
          <View style={styles.dialogCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.dialogTitle}>Notification Settings</Text>
              <TouchableOpacity
                onPress={() => setNotificationSettingsVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.dialogSub}>
              Manage in-app notifications and real-time banner alerts.
            </Text>

            {/* Quick Actions: Inbox & Mark All Read */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity
                style={[styles.notifInboxBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setNotificationSettingsVisible(false);
                  navigation.navigate('NotificationCenter');
                }}
                activeOpacity={0.8}
              >
                <Bell size={15} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
                <Text style={styles.notifInboxBtnText}>View Inbox</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifInboxBadge}>
                    <Text style={styles.notifInboxBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {unreadCount > 0 && (
                <TouchableOpacity
                  style={[styles.notifMarkAllBtn, { borderColor: colors.border }]}
                  onPress={async () => {
                    await markAllAsRead();
                    hapticsService.notification(Haptics.NotificationFeedbackType.Success);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notifMarkAllBtnText, { color: colors.textSecondary }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>In-App Banners</Text>
                  <Text style={styles.switchSubLabel}>Show real-time toast banner at top of screen</Text>
                </View>
                <Switch
                  value={preferences.inAppBanners}
                  onValueChange={(val) => updatePreferences({ inAppBanners: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.inAppBanners)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Expense Added</Text>
                  <Text style={styles.switchSubLabel}>When someone records a new expense with you</Text>
                </View>
                <Switch
                  value={preferences.expenseAdded}
                  onValueChange={(val) => updatePreferences({ expenseAdded: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.expenseAdded)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Expense Edited or Deleted</Text>
                  <Text style={styles.switchSubLabel}>When an expense is modified</Text>
                </View>
                <Switch
                  value={preferences.expenseUpdated}
                  onValueChange={(val) => updatePreferences({ expenseUpdated: val, expenseDeleted: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.expenseUpdated)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Settlements & Payments</Text>
                  <Text style={styles.switchSubLabel}>When someone records a settlement</Text>
                </View>
                <Switch
                  value={preferences.settlements}
                  onValueChange={(val) => updatePreferences({ settlements: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.settlements)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Group Activity & Invites</Text>
                  <Text style={styles.switchSubLabel}>Invitations and new members joining</Text>
                </View>
                <Switch
                  value={preferences.groupInvites}
                  onValueChange={(val) => updatePreferences({ groupInvites: val, memberActivity: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.groupInvites)}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Payment Reminders</Text>
                  <Text style={styles.switchSubLabel}>Friendly reminders from group members</Text>
                </View>
                <Switch
                  value={preferences.paymentReminders}
                  onValueChange={(val) => updatePreferences({ paymentReminders: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.paymentReminders)}
                />
              </View>

              <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Comments & Mentions</Text>
                  <Text style={styles.switchSubLabel}>When tagged or mentioned in notes</Text>
                </View>
                <Switch
                  value={preferences.comments}
                  onValueChange={(val) => updatePreferences({ comments: val })}
                  trackColor={switchTrackColor}
                  thumbColor={getSwitchThumbColor(preferences.comments)}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => {
                setNotificationSettingsVisible(false);
                hapticsService.notification(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={styles.dialogPrimaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Security Modal ─────────────────────────────────────────────────── */}
      <SecuritySettingsModal
        visible={securitySettingsVisible}
        onClose={() => setSecuritySettingsVisible(false)}
      />

      {/* ── Appearance Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={appearanceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAppearanceVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Appearance</Text>
            <Text style={styles.dialogSub}>Select your preferred app theme.</Text>

            {(['system', 'light', 'dark'] as const).map((t) => {
              const isSelected = themeMode === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.themeOptionRow,
                    isSelected && styles.themeOptionRowSelected,
                  ]}
                  onPress={async () => {
                    try {
                      await Haptics.selectionAsync();
                    } catch {
                      // ignore
                    }
                    await setThemeMode(t, user?.uid);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.themeOptionText,
                      isSelected && { color: colors.primary, fontWeight: '700' },
                    ]}
                  >
                    {t === 'system'
                      ? 'System default'
                      : t === 'light'
                      ? 'Light mode'
                      : 'Dark mode'}
                  </Text>
                  {isSelected && (
                    <Check size={18} color={colors.primary} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => setAppearanceVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Apply Theme</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Help Center Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={helpCenterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpCenterVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setHelpCenterVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Help Center</Text>
            <Text style={styles.dialogSub}>Common questions and guides for Splitwiser.</Text>

            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              <View style={styles.faqItem}>
                <Text style={styles.faqQ}>How does balance simplification work?</Text>
                <Text style={styles.faqA}>
                  Splitwiser automatically minimizes the total number of transactions needed so everyone can settle debts in the fewest payments.
                </Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={styles.faqQ}>Can I use Splitwiser offline?</Text>
                <Text style={styles.faqA}>
                  Yes! All expenses and settlements are saved locally on your device and automatically synced once an internet connection is available.
                </Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={styles.faqQ}>How do I add friends directly?</Text>
                <Text style={styles.faqA}>
                  Go to the Friends tab and tap the + icon at the top right to invite or add any friend by email or shareable link.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => setHelpCenterVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Contact Support Modal ──────────────────────────────────────────── */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSupportModalVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Contact Support</Text>
            <Text style={styles.dialogSub}>Send feedback, report bugs, or ask our team a question.</Text>

            <TextInput
              style={styles.feedbackInput}
              placeholder="Type your message or feedback here..."
              placeholderTextColor={colors.textMuted}
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={4}
              editable={!isSendingFeedback}
            />

            <TouchableOpacity
              style={[styles.dialogPrimaryBtn, isSendingFeedback && { opacity: 0.7 }]}
              onPress={handleSendFeedback}
              disabled={isSendingFeedback}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {isSendingFeedback ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.dialogPrimaryBtnText}>Send Message</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogCancelBtn}
              onPress={() => setSupportModalVisible(false)}
              disabled={isSendingFeedback}
            >
              <Text style={styles.dialogCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>


      {/* Confirmation Sign Out Dialog */}
      <ConfirmationDialog
        visible={confirmSignOutVisible}
        onDismiss={() => setConfirmSignOutVisible(false)}
        onConfirm={handleSignOut}
        title={user?.isAnonymous ? 'Log Out as Guest?' : 'Log Out?'}
        message={
          user?.isAnonymous
            ? 'You are currently signed in as a guest. Logging out will end this guest session on this device. If you want to keep your groups and expenses, you can link an account before signing out. Are you sure you want to log out?'
            : 'Are you sure you want to log out of your Splitwiser account?'
        }
        confirmLabel="Log Out"
        isDestructive
        isLoading={isSigningOut}
        icon="logout"
      />

      {/* Profile Photo Modal */}
      <ProfilePhotoModal
        visible={profilePhotoModalVisible}
        onClose={() => setProfilePhotoModalVisible(false)}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSearchBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBellBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      marginRight: 4,
    },
    headerBellBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 17,
      height: 17,
      borderRadius: 8.5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    headerBellBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    unreadBadgeSmall: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginRight: 6,
    },
    unreadBadgeSmallText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    notifInboxBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    notifInboxBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    notifInboxBadge: {
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
      marginLeft: 6,
    },
    notifInboxBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    notifMarkAllBtn: {
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifMarkAllBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    scrollContent: {
      paddingTop: 14,
    },
    // Profile Section
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 14,
    },
    cameraIconBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    profileDetails: {
      flex: 1,
    },
    profileName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    profileSub: {
      fontSize: 13,
      color: colors.textMuted,
    },
    editProfileBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    editProfileBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    // Quick Actions (Scan code)
    quickActionsContainer: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 18,
    },
    quickActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    quickActionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quickActionText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    rowIcon: {
      marginRight: 14,
    },
    // Sections (Preferences, Help & Support)
    section: {
      marginBottom: 20,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      paddingHorizontal: 20,
      marginBottom: 6,
    },
    sectionBody: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    settingItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    settingItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },
    settingItemTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    settingItemTextCol: {
      flex: 1,
    },
    settingItemSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    // Log Out
    logOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
      marginHorizontal: 20,
      marginBottom: 16,
      paddingVertical: 13,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#7F1D1D' : '#FECDD3',
    },
    logOutBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#E11D48',
    },
    versionText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 20,
    },
    // Modals common styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dialogCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 22,
      width: '100%',
      maxWidth: 360,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    dialogTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    dialogSub: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 16,
    },
    dialogPrimaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    dialogPrimaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dialogCancelBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    dialogCancelBtnText: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '600',
    },
    // QR modal
    qrCodeBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderRadius: 12,
      marginVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    qrUidText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 10,
      fontWeight: '600',
    },
    // Switches
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    switchLabel: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
      marginRight: 10,
    },
    switchSubLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    // Theme options
    themeOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    themeOptionRowSelected: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
    },
    themeOptionText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    themeOptionSubText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    // Help Center FAQs
    faqItem: {
      marginBottom: 14,
    },
    faqQ: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    faqA: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    // Feedback input
    feedbackInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.inputBackground,
      minHeight: 80,
      textAlignVertical: 'top',
    },
  });

export default AccountScreen;
