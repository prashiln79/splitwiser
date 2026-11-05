import React, { useState } from 'react';
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
} from 'react-native';
import {
  Mail,
  Bell,
  Lock,
  Palette,
  QrCode,
  Gem,
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
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { GoogleIcon } from '../components/common/GoogleIcon';
import { ConnectGoogleModal } from '../components/common/ConnectGoogleModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

export const AccountScreen = ({ navigation }: any) => {
  const { user, signOut, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [confirmSignOutVisible, setConfirmSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Splitwise Pro Modal
  const [proModalVisible, setProModalVisible] = useState(false);

  // Scan / QR Code Modal
  const [qrModalVisible, setQrModalVisible] = useState(false);

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

  const [selectedTheme, setSelectedTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [feedbackText, setFeedbackText] = useState('');

  const isGoogleLinked = !user?.isAnonymous && user?.authProvider === 'google';

  const handlePickAvatar = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const mime = asset.mimeType ?? 'image/jpeg';
        const imageUrl = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
        await updateProfile({ imageUrl });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    } catch {
      // Ignored
    }
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
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              navigation.navigate('EditProfile');
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit Account"
          >
            <Text style={styles.editProfileBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Splitwise Pro Promotional Card */}
        <View style={styles.proCard}>
          <View style={styles.proCardIconWrap}>
            <Gem size={28} color="#7C3AED" strokeWidth={2} />
          </View>
          <Text style={styles.proCardTitle}>Do more with Splitwise Pro.</Text>
          <TouchableOpacity
            style={styles.proCardCta}
            onPress={() => setProModalVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Get Splitwise Pro"
          >
            <Text style={styles.proCardCtaText}>Get Splitwise Pro</Text>
          </TouchableOpacity>
        </View>

        {/* Top Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionRow}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.quickActionLeft}>
              <QrCode size={20} color="#111827" strokeWidth={2} style={styles.rowIcon} />
              <Text style={styles.quickActionText}>Scan code</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionRow, { borderBottomWidth: 0 }]}
            onPress={() => setProModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.quickActionLeft}>
              <Gem size={20} color="#7C3AED" strokeWidth={2} style={styles.rowIcon} />
              <Text style={styles.quickActionText}>Splitwise Pro</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Section: Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Preferences</Text>
          <View style={styles.sectionBody}>
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
              style={[styles.settingItemRow, { borderBottomWidth: 0 }]}
              onPress={() => setAppearanceVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <Palette size={19} color="#374151" strokeWidth={2} style={styles.rowIcon} />
                <Text style={styles.settingItemTitle}>Appearance</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
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

        {/* Google Link Banner (for Guest users) */}
        {!isGoogleLinked && (
          <View style={styles.guestBanner}>
            <View style={styles.guestBannerHeader}>
              <GoogleIcon size={18} />
              <Text style={styles.guestBannerTitle}>Sync across devices</Text>
            </View>
            <Text style={styles.guestBannerSub}>
              Link your Google Account so your expenses and friendships are saved securely.
            </Text>
            <TouchableOpacity
              style={styles.guestBannerBtn}
              onPress={() => setConnectModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.guestBannerBtnText}>Connect with Google</Text>
            </TouchableOpacity>
          </View>
        )}

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

      {/* ── Splitwise Pro Modal ────────────────────────────────────────────── */}
      <Modal
        visible={proModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setProModalVisible(false)}
        >
          <View style={styles.dialogCard}>
            <View style={styles.proModalHeader}>
              <View style={styles.proIconLarge}>
                <Gem size={32} color="#7C3AED" strokeWidth={2} />
              </View>
              <Text style={styles.dialogTitle}>Splitwise Pro</Text>
              <Text style={styles.dialogSub}>
                Supercharge your expense tracking with powerful premium features.
              </Text>
            </View>

            <View style={styles.proFeatureList}>
              <View style={styles.proFeatureItem}>
                <Check size={16} color="#059669" strokeWidth={2.5} style={{ marginRight: 10 }} />
                <Text style={styles.proFeatureText}>OCR Receipt scanning & automatic itemization</Text>
              </View>
              <View style={styles.proFeatureItem}>
                <Check size={16} color="#059669" strokeWidth={2.5} style={{ marginRight: 10 }} />
                <Text style={styles.proFeatureText}>Live currency conversion across 100+ currencies</Text>
              </View>
              <View style={styles.proFeatureItem}>
                <Check size={16} color="#059669" strokeWidth={2.5} style={{ marginRight: 10 }} />
                <Text style={styles.proFeatureText}>Advanced category charts & monthly spending analytics</Text>
              </View>
              <View style={styles.proFeatureItem}>
                <Check size={16} color="#059669" strokeWidth={2.5} style={{ marginRight: 10 }} />
                <Text style={styles.proFeatureText}>Full offline sync & high-resolution receipt storage</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => {
                setProModalVisible(false);
                Alert.alert('Splitwise Pro', 'Thank you! Pro subscriptions will be available in the upcoming release.');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dialogPrimaryBtnText}>Start 30-Day Free Trial</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogCancelBtn}
              onPress={() => setProModalVisible(false)}
            >
              <Text style={styles.dialogCancelBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Scan Code / QR Modal ───────────────────────────────────────────── */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQrModalVisible(false)}
        >
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Your Splitwise QR Code</Text>
            <Text style={styles.dialogSub}>
              Friends can scan this code to add you instantly on Splitwise.
            </Text>

            <View style={styles.qrCodeBox}>
              <QrCode size={140} color="#111827" strokeWidth={1.8} />
              <Text style={styles.qrUidText}>{user?.name || 'User'} • {user?.uid.slice(0, 10)}</Text>
            </View>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => {
                setQrModalVisible(false);
                Alert.alert('Scan QR Code', 'Point your camera at a friend’s QR code to connect.');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dialogPrimaryBtnText}>Scan a Friend's Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogCancelBtn}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.dialogCancelBtnText}>Done</Text>
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
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                }
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
            />

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => {
                setSupportModalVisible(false);
                setFeedbackText('');
                Alert.alert('Message Sent', 'Thank you for your feedback! Our team will review it shortly.');
              }}
            >
              <Text style={styles.dialogPrimaryBtnText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Google Connect Modal */}
      <ConnectGoogleModal
        visible={connectModalVisible}
        onDismiss={() => setConnectModalVisible(false)}
      />

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
  // Pro Card
  proCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  proCardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  proCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 14,
    textAlign: 'center',
  },
  proCardCta: {
    backgroundColor: '#6D28D9',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  proCardCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Quick Actions (Scan code, Splitwise Pro)
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
  // Guest Account Banner
  guestBanner: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  guestBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  guestBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  guestBannerSub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  guestBannerBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  // Pro Modal specifics
  proModalHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  proIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  proFeatureList: {
    gap: 10,
    marginVertical: 10,
  },
  proFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proFeatureText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    lineHeight: 18,
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
