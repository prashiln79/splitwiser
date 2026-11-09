import React, { useState, useEffect } from 'react';
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
import { LOCALE_NATIVE_NAMES } from '../i18n';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { compressAvatarPhoto } from '../utils/imageCompressor';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { ProfilePhotoModal } from '../components/common/ProfilePhotoModal';
import { LanguagePickerModal } from '../components/settings/LanguagePickerModal';
import { submitSupportTicket } from '../services/support';
import { hapticsService } from '../services/hapticsService';

export const AccountScreen = ({ navigation }: any) => {
  const { user, signOut, updateProfile } = useAuth();
  const { currentLocale, isSystemLanguage } = useI18n();
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

  const [pushExpenseAdded, setPushExpenseAdded] = useState(true);
  const [pushSettledUp, setPushSettledUp] = useState(true);
  const [pushGroupInvites, setPushGroupInvites] = useState(true);

  const [biometricUnlock, setBiometricUnlock] = useState(false);
  const [requirePinOnOpen, setRequirePinOnOpen] = useState(false);

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

  const [selectedTheme, setSelectedTheme] = useState<'system' | 'light' | 'dark'>('system');
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
            <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search settings..."
              placeholderTextColor="#9CA3AF"
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
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Account</Text>
            <TouchableOpacity
              onPress={() => setIsSearchActive(true)}
              style={styles.headerSearchBtn}
              accessibilityLabel="Search settings"
              accessibilityRole="button"
            >
              <Search size={22} color="#1A1A1A" strokeWidth={2.2} />
            </TouchableOpacity>
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
              imageUrl={user?.imageUrl}
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
              <QrCode size={20} color="#111827" strokeWidth={2} style={styles.rowIcon} />
              <Text style={styles.quickActionText}>Scan code</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
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
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={hapticsEnabled ? '#059669' : '#F3F4F6'}
              />
            </TouchableOpacity>

            {/* Email settings */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setEmailSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Mail size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Email settings</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Device and push notification settings */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setNotificationSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Bell size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Device and push notification settings</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Security */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setSecuritySettingsVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Lock size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Security</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Appearance */}
            <TouchableOpacity
              style={styles.settingItemRow}
              onPress={() => setAppearanceVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Palette size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>{t('settings:appearance', { defaultValue: 'Appearance' })}</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity
              style={[styles.settingItemRow, { borderBottomWidth: 0 }]}
              onPress={() => setLanguageModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Globe size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>{t('settings:language', { defaultValue: 'Language' })}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6B7280', marginRight: 6 }}>
                  {isSystemLanguage
                    ? t('common:systemDefault', { defaultValue: 'System Default' })
                    : LOCALE_NATIVE_NAMES[currentLocale] || currentLocale}
                </Text>
                <ChevronRight size={18} color="#9CA3AF" />
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
                <CircleQuestionMark size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Help Center</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItemRow, { borderBottomWidth: 0 }]}
              onPress={() => setSupportModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <MessageSquare size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Contact Splitwise support</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>


        {/* Log Out Button */}
        {isGoogleLinked && (
          <TouchableOpacity
            style={styles.logOutBtn}
            onPress={() => setConfirmSignOutVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <LogOut size={18} color="#E11D48" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.logOutBtnText}>Log Out</Text>
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

      {/* ── Language Picker Modal ──────────────────────────────────────────── */}
      <LanguagePickerModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
      />

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
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={emailWeeklySummary ? '#059669' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>When someone adds an expense</Text>
              <Switch
                value={emailExpenseAdded}
                onValueChange={setEmailExpenseAdded}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={emailExpenseAdded ? '#059669' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>When someone records a settlement</Text>
              <Switch
                value={emailSettledUp}
                onValueChange={setEmailSettledUp}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={emailSettledUp ? '#059669' : '#F3F4F6'}
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

      {/* ── Push Notification Settings Modal ───────────────────────────────── */}
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
            <Text style={styles.dialogTitle}>Push Notifications</Text>
            <Text style={styles.dialogSub}>
              Control which alerts are delivered directly to your device.
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Expense updates & edits</Text>
              <Switch
                value={pushExpenseAdded}
                onValueChange={setPushExpenseAdded}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={pushExpenseAdded ? '#059669' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Settlement notifications</Text>
              <Switch
                value={pushSettledUp}
                onValueChange={setPushSettledUp}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={pushSettledUp ? '#059669' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Group invitations & friend requests</Text>
              <Switch
                value={pushGroupInvites}
                onValueChange={setPushGroupInvites}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={pushGroupInvites ? '#059669' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.switchLabel}>Haptic vibration</Text>
                <Text style={styles.switchSubLabel}>Vibrate on buttons, tabs and actions</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={hapticsEnabled ? '#059669' : '#F3F4F6'}
              />
            </View>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => setNotificationSettingsVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Security Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={securitySettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSecuritySettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSecuritySettingsVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>App Security</Text>
            <Text style={styles.dialogSub}>
              Protect your personal balances and financial history.
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Unlock with Face ID / Biometrics</Text>
              <Switch
                value={biometricUnlock}
                onValueChange={setBiometricUnlock}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={biometricUnlock ? '#059669' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Require Passcode when opening app</Text>
              <Switch
                value={requirePinOnOpen}
                onValueChange={setRequirePinOnOpen}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={requirePinOnOpen ? '#059669' : '#F3F4F6'}
              />
            </View>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => setSecuritySettingsVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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

            {(['system', 'light', 'dark'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.themeOptionRow,
                  selectedTheme === t && styles.themeOptionRowSelected,
                ]}
                onPress={() => setSelectedTheme(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.themeOptionText, selectedTheme === t && { color: '#059669', fontWeight: '700' }]}>
                  {t === 'system' ? 'System default' : t === 'light' ? 'Light mode' : 'Dark mode'}
                </Text>
                {selectedTheme === t && <Check size={18} color="#059669" strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}

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
              placeholderTextColor="#9CA3AF"
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
        title="Log Out?"
        message="Are you sure you want to log out of your Splitwiser account?"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  headerSearchBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  scrollContent: {
    paddingTop: 14,
  },
  // Profile Section
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
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
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileSub: {
    fontSize: 13,
    color: '#6B7280',
  },
  editProfileBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editProfileBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  // Quick Actions (Scan code)
  quickActionsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    marginBottom: 18,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  quickActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
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
    color: '#6B7280',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  sectionBody: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
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
    color: '#111827',
  },
  settingItemTextCol: {
    flex: 1,
  },
  settingItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // Log Out
  logOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  logOutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E11D48',
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Modals common styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  dialogSub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  dialogPrimaryBtn: {
    backgroundColor: '#059669',
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
    color: '#6B7280',
    fontWeight: '600',
  },
  // QR modal
  qrCodeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrUidText: {
    fontSize: 12,
    color: '#6B7280',
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
    borderBottomColor: '#F3F4F6',
  },
  switchLabel: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    marginRight: 10,
  },
  switchSubLabel: {
    fontSize: 12,
    color: '#6B7280',
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
    backgroundColor: '#ECFDF5',
  },
  themeOptionText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  // Help Center FAQs
  faqItem: {
    marginBottom: 14,
  },
  faqQ: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  faqA: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  // Feedback input
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default AccountScreen;
