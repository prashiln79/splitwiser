import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  Edit2,
  ChevronDown,
  X,
  Shield,
  Ban,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { GoogleIcon } from '../components/common/GoogleIcon';
import { ConnectGoogleModal } from '../components/common/ConnectGoogleModal';

const TIMEZONES = [
  '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi',
  '(GMT+00:00) London, Dublin, Edinburgh',
  '(GMT-05:00) Eastern Time (US & Canada)',
  '(GMT-08:00) Pacific Time (US & Canada)',
  '(GMT+01:00) Paris, Berlin, Rome, Madrid',
  '(GMT+08:00) Singapore, Beijing, Hong Kong',
  '(GMT+09:00) Tokyo, Seoul',
];

const CURRENCIES = [
  { code: 'INR', label: 'INR (₹)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'SGD', label: 'SGD (S$)' },
];

const LANGUAGES = [
  'English',
  'Español (Spanish)',
  'Français (French)',
  'Deutsch (German)',
  'Hindi (हिन्दी)',
  '日本語 (Japanese)',
];

export const EditProfileScreen = ({ navigation }: any) => {
  const { user, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Field values
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [password, setPassword] = useState('••••••••');
  const [timezone, setTimezone] = useState(
    user?.timezone || '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi'
  );
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [language, setLanguage] = useState(user?.language || 'English');
  const [allowFriendSuggestions, setAllowFriendSuggestions] = useState(true);

  // Edit toggles
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  // Selector modal states
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [blocklistModalVisible, setBlocklistModalVisible] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);

  const isGoogleLinked = !user?.isAnonymous && user?.authProvider === 'google';

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing =
    isEditingName || isEditingEmail || isEditingPhone || isEditingPassword;
  const hasChanges =
    name.trim() !== (user?.name ?? '').trim() ||
    email.trim() !== (user?.email ?? '').trim() ||
    phone.trim() !== (user?.phone ?? '').trim() ||
    currency !== (user?.currency || 'INR') ||
    timezone !==
      (user?.timezone ||
        '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi') ||
    language !== (user?.language || 'English');

  const isEditingOrChanged = isEditing || hasChanges;

  const handleDonePress = () => {
    if (isEditingOrChanged) {
      handleSaveChanges();
    } else {
      navigation.goBack();
    }
  };

  const handleSaveChanges = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Your full name cannot be blank.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        currency,
        timezone,
        language,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      setIsEditingName(false);
      setIsEditingEmail(false);
      setIsEditingPhone(false);
      setIsEditingPassword(false);

      Alert.alert('Settings Saved', 'Your account settings have been updated.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update settings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackBtn}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color="#111827" strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account settings</Text>
        <TouchableOpacity
          onPress={handleDonePress}
          disabled={isSubmitting || (isEditing && !name.trim())}
          style={styles.doneBtn}
          accessibilityLabel="Done"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Text
              style={[
                styles.doneBtnText,
                { color: isEditingOrChanged ? '#059669' : '#9E9E9E' },
              ]}
            >
              Done
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Full name */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Full name</Text>
          {isEditingName ? (
            <TextInput
              style={styles.activeTextInput}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          ) : (
            <View style={styles.fieldDisplayRow}>
              <Text style={styles.fieldValueText}>{name || 'None'}</Text>
              <TouchableOpacity
                onPress={() => setIsEditingName(true)}
                style={styles.editActionBtn}
              >
                <Edit2 size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2. Email address */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          {isEditingEmail ? (
            <TextInput
              style={styles.activeTextInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Your email address"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
          ) : (
            <View style={styles.fieldDisplayRow}>
              <Text style={styles.fieldValueText}>{email || 'None'}</Text>
              <TouchableOpacity
                onPress={() => setIsEditingEmail(true)}
                style={styles.editActionBtn}
              >
                <Edit2 size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 3. Phone number */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Phone number</Text>
          {isEditingPhone ? (
            <TextInput
              style={styles.activeTextInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoFocus
            />
          ) : (
            <View style={styles.fieldDisplayRow}>
              <Text style={styles.fieldValueText}>{phone || 'None'}</Text>
              <TouchableOpacity
                onPress={() => setIsEditingPhone(true)}
                style={styles.editActionBtn}
              >
                <Edit2 size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 4. Password */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          {isEditingPassword ? (
            <TextInput
              style={styles.activeTextInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoFocus
            />
          ) : (
            <View style={styles.fieldDisplayRow}>
              <Text style={styles.fieldValueText}>••••••••</Text>
              <TouchableOpacity
                onPress={() => setIsEditingPassword(true)}
                style={styles.editActionBtn}
              >
                <Edit2 size={13} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5. Time zone */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Time zone</Text>
          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setTimezoneModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectBoxText} numberOfLines={1}>
              {timezone}
            </Text>
            <ChevronDown size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* 6. Default currency */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Default currency</Text>
          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setCurrencyModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectBoxText}>{currency}</Text>
            <ChevronDown size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* 7. Language */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Language (for emails and notifications)</Text>
          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setLanguageModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectBoxText}>{language}</Text>
            <ChevronDown size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* 8. Privacy Settings (Splitwise verified) */}
        <View style={styles.privacySection}>
          <Text style={styles.privacySectionHeader}>Privacy settings</Text>
          <TouchableOpacity
            style={styles.privacyCheckboxRow}
            onPress={() => setAllowFriendSuggestions(!allowFriendSuggestions)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkboxBox,
                allowFriendSuggestions && styles.checkboxBoxChecked,
              ]}
            >
              {allowFriendSuggestions && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.privacyLabel}>
              Allow Splitwise to suggest me as a friend to other users
            </Text>
          </TouchableOpacity>
          <Text style={styles.privacyExplanation}>
            Splitwise will only recommend you to users who already have your email address or phone number in their phone's contact book.
          </Text>
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

        {/* 9. Save Changes Button (Splitwise coral/orange button) */}
        <TouchableOpacity
          style={styles.saveChangesBtn}
          onPress={handleSaveChanges}
          disabled={isSubmitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveChangesBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>

        {/* 10. Advanced Features Section */}
        <View style={styles.advancedSection}>
          <Text style={styles.advancedSectionHeader}>Advanced features</Text>
          <Text style={styles.advancedLabel}>Block other users</Text>
          <TouchableOpacity
            style={styles.blocklistBtn}
            onPress={() => setBlocklistModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.blocklistBtnText}>Manage your blocklist</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Timezone Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={timezoneModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimezoneModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setTimezoneModalVisible(false)}
        >
          <View style={styles.selectionModal}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Timezone</Text>
              <TouchableOpacity onPress={() => setTimezoneModalVisible(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {TIMEZONES.map((tz) => (
                <TouchableOpacity
                  key={tz}
                  style={[
                    styles.modalOptionRow,
                    timezone === tz && styles.modalOptionRowSelected,
                  ]}
                  onPress={() => {
                    setTimezone(tz);
                    setTimezoneModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      timezone === tz && styles.modalOptionTextSelected,
                    ]}
                  >
                    {tz}
                  </Text>
                  {timezone === tz && <Check size={18} color="#EA580C" strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Currency Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.selectionModal}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Default Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[
                  styles.modalOptionRow,
                  currency === c.code && styles.modalOptionRowSelected,
                ]}
                onPress={() => {
                  setCurrency(c.code);
                  setCurrencyModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    currency === c.code && styles.modalOptionTextSelected,
                  ]}
                >
                  {c.label}
                </Text>
                {currency === c.code && <Check size={18} color="#EA580C" strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
          <View style={styles.selectionModal}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.modalOptionRow,
                  language === l && styles.modalOptionRowSelected,
                ]}
                onPress={() => {
                  setLanguage(l);
                  setLanguageModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    language === l && styles.modalOptionTextSelected,
                  ]}
                >
                  {l}
                </Text>
                {language === l && <Check size={18} color="#EA580C" strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Blocklist Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={blocklistModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlocklistModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setBlocklistModalVisible(false)}
        >
          <View style={styles.selectionModal}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Blocked Users</Text>
              <TouchableOpacity onPress={() => setBlocklistModalVisible(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.emptyBlocklistBox}>
              <Ban size={36} color="#9CA3AF" strokeWidth={1.8} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyBlocklistTitle}>No blocked users</Text>
              <Text style={styles.emptyBlocklistSub}>
                Users you block won't be able to add you to groups or record expenses with you.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setBlocklistModalVisible(false)}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Connect Google Modal ────────────────────────────────────────── */}
      <ConnectGoogleModal
        visible={connectModalVisible}
        onDismiss={() => setConnectModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerBackBtn: {
    width: 44,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  doneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 44,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  formGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  fieldValueText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  activeTextInput: {
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  selectBoxText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  // Privacy section
  privacySection: {
    marginTop: 10,
    marginBottom: 24,
  },
  privacySectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  privacyCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  privacyLabel: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    lineHeight: 20,
  },
  privacyExplanation: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    paddingLeft: 30,
  },
  // Save Changes Button (Splitwise coral button)
  saveChangesBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveChangesBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Advanced features
  advancedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  advancedSectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  advancedLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  blocklistBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#F9FAFB',
  },
  blocklistBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectionModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionRowSelected: {
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  modalOptionTextSelected: {
    color: '#EA580C',
    fontWeight: '700',
  },
  emptyBlocklistBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyBlocklistTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptyBlocklistSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalDoneBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Guest Account Banner
  guestBanner: {
    backgroundColor: '#F9FAFB',
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
});

export default EditProfileScreen;
