import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, Check, Globe } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  LOCALE_NATIVE_NAMES,
  LOCALE_DISPLAY_NAMES,
} from '../../i18n';
import { useAppTheme } from '../../theme';

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { currentLocale, isSystemLanguage, changeLanguage } = useI18n();
  const { user } = useAuth();
  const { t } = useTranslation(['settings', 'common']);

  const handleSelectLanguage = async (locale: SupportedLocale | null) => {
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore
    }
    await changeLanguage(locale, user?.uid);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.surface,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: isDark ? '#333' : '#EEE' }]}>
                <View style={styles.headerLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: isDark ? '#1E293B' : '#E0F2FE' }]}>
                    <Globe size={20} color="#0284C7" />
                  </View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {t('settings:selectLanguage', { defaultValue: 'Select Language' })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  style={styles.closeBtn}
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Languages List */}
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {/* System Default Option */}
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    isSystemLanguage && {
                      backgroundColor: isDark ? '#0284C722' : '#E0F2FE',
                      borderColor: '#0284C7',
                    },
                    !isSystemLanguage && {
                      borderColor: isDark ? '#333' : '#EEE',
                    },
                  ]}
                  onPress={() => handleSelectLanguage(null)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionDetails}>
                    <Text
                      style={[
                        styles.nativeName,
                        { color: colors.textPrimary },
                        isSystemLanguage && { color: '#0284C7', fontWeight: '700' },
                      ]}
                    >
                      {t('settings:deviceLanguage', { defaultValue: 'Use Device Language' })}
                    </Text>
                    <Text style={[styles.subName, { color: colors.textSecondary }]}>
                      {t('common:systemDefault', { defaultValue: 'System Default' })}
                    </Text>
                  </View>
                  {isSystemLanguage && (
                    <View style={[styles.checkBadge, { backgroundColor: '#0284C7' }]}>
                      <Check size={16} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#E5E7EB' }]} />

                {/* 8 Supported Languages */}
                {SUPPORTED_LOCALES.map((locale) => {
                  const isSelected = !isSystemLanguage && currentLocale === locale;
                  const nativeName = LOCALE_NATIVE_NAMES[locale];
                  const englishName = LOCALE_DISPLAY_NAMES[locale];

                  return (
                    <TouchableOpacity
                      key={locale}
                      style={[
                        styles.languageOption,
                        isSelected && {
                          backgroundColor: isDark ? '#0284C722' : '#E0F2FE',
                          borderColor: '#0284C7',
                        },
                        !isSelected && {
                          borderColor: isDark ? '#333' : '#EEE',
                        },
                      ]}
                      onPress={() => handleSelectLanguage(locale)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionDetails}>
                        <Text
                          style={[
                            styles.nativeName,
                            { color: colors.textPrimary },
                            isSelected && { color: '#0284C7', fontWeight: '700' },
                          ]}
                        >
                          {nativeName}
                        </Text>
                        <Text style={[styles.subName, { color: colors.textSecondary }]}>
                          {englishName}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: '#0284C7' }]}>
                          <Check size={16} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  list: {
    paddingHorizontal: 20,
  },
  listContent: {
    paddingVertical: 14,
    gap: 10,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionDetails: {
    flex: 1,
  },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subName: {
    fontSize: 13,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});
