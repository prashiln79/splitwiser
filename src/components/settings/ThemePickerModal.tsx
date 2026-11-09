import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { X, Check, Sun, Moon, Smartphone, Palette } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAppTheme, AppearanceMode } from '../../theme';
import { useAuth } from '../../context/AuthContext';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ThemePickerModal: React.FC<ThemePickerModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setThemeMode } = useAppTheme();
  const { user } = useAuth();
  const { t } = useTranslation(['settings', 'common']);

  const handleSelectMode = async (mode: AppearanceMode) => {
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore
    }
    await setThemeMode(mode, user?.uid);
  };

  const THEME_OPTIONS: Array<{
    mode: AppearanceMode;
    title: string;
    description: string;
    icon: typeof Sun;
    iconColor: string;
    iconBgLight: string;
    iconBgDark: string;
  }> = [
    {
      mode: 'system',
      title: t('settings:system', { defaultValue: 'System Default' }),
      description: t('settings:deviceLanguage', {
        defaultValue: 'Automatically match device appearance',
      }),
      icon: Smartphone,
      iconColor: '#3B82F6',
      iconBgLight: '#EFF6FF',
      iconBgDark: '#1E3A8A44',
    },
    {
      mode: 'light',
      title: t('settings:light', { defaultValue: 'Light Mode' }),
      description: 'Clean, bright aesthetic with high contrast',
      icon: Sun,
      iconColor: '#F59E0B',
      iconBgLight: '#FEF3C7',
      iconBgDark: '#78350F44',
    },
    {
      mode: 'dark',
      title: t('settings:dark', { defaultValue: 'Dark Mode' }),
      description: 'Dark slate background, easy on the eyes',
      icon: Moon,
      iconColor: '#A855F7',
      iconBgLight: '#F3E8FF',
      iconBgDark: '#581C8744',
    },
  ];

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
                  paddingBottom: Math.max(insets.bottom, 24),
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerLeft}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: isDark ? '#1E293B' : '#E0F2FE' },
                    ]}
                  >
                    <Palette size={20} color="#0284C7" />
                  </View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {t('settings:appearance', { defaultValue: 'Appearance' })}
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

              {/* Options */}
              <View style={styles.optionsList}>
                {THEME_OPTIONS.map((item) => {
                  const isSelected = themeMode === item.mode;
                  const Icon = item.icon;

                  return (
                    <TouchableOpacity
                      key={item.mode}
                      style={[
                        styles.themeCard,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#05966922'
                              : '#ECFDF5'
                            : isDark
                            ? '#1E293B'
                            : '#F8FAFC',
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleSelectMode(item.mode)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.modeIconBox,
                          {
                            backgroundColor: isDark
                              ? item.iconBgDark
                              : item.iconBgLight,
                          },
                        ]}
                      >
                        <Icon size={22} color={item.iconColor} strokeWidth={2.2} />
                      </View>

                      <View style={styles.themeInfo}>
                        <Text
                          style={[
                            styles.themeTitle,
                            {
                              color: isSelected
                                ? colors.primary
                                : colors.textPrimary,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[
                            styles.themeDesc,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {item.description}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View
                          style={[
                            styles.checkBadge,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Check size={16} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.uncheckBadge,
                            { borderColor: colors.border },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Done Button */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.doneButton, { backgroundColor: colors.primary }]}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.doneButtonText}>
                    {t('common:done', { defaultValue: 'Done' })}
                  </Text>
                </TouchableOpacity>
              </View>
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
  optionsList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  modeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  themeInfo: {
    flex: 1,
  },
  themeTitle: {
    fontSize: 16,
    marginBottom: 3,
  },
  themeDesc: {
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
  uncheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginLeft: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

