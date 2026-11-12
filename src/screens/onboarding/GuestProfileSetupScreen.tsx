import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';
import { compressAvatarPhoto } from '../../utils/imageCompressor';
import { setDefaultCurrency, getDefaultCurrency } from '../../utils/currency';

interface GuestProfileSetupScreenProps {
  navigation: any;
  route?: any;
}

const POPULAR_CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
];

export const GuestProfileSetupScreen: React.FC<GuestProfileSetupScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const { user, completeProfile } = useAuth();

  const suggestedName = route?.params?.suggestedName || user?.name || '';
  const suggestedPhoto = route?.params?.suggestedPhoto || user?.imageUrl || null;

  const [name, setName] = useState(suggestedName === 'Anonymous User' ? '' : suggestedName);
  const [avatarUri, setAvatarUri] = useState<string | null>(suggestedPhoto);
  const [currency, setCurrency] = useState(user?.currency || getDefaultCurrency() || 'INR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickAvatar = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow access to your photos to select an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const compressed = await compressAvatarPhoto(result.assets[0].uri, {
          size: 300,
          quality: 0.75,
        });
        setAvatarUri(compressed.base64 ? `data:image/jpeg;base64,${compressed.base64}` : compressed.uri);
      }
    } catch (e: any) {
      console.warn('[ProfileSetup] Avatar pick error:', e);
    }
  };

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name Required', 'Please enter your name so your group members know who paid.');
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert('Name Too Short', 'Your name must be at least 2 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (currency) {
        setDefaultCurrency(currency);
      }
      await completeProfile(trimmed, avatarUri || undefined, currency);
      navigation.navigate('IntroSlides');
    } catch (err: any) {
      Alert.alert('Setup Error', err.message || 'Could not save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = name.trim().length >= 2 && !isSubmitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step 1 of 3</Text>
        </View>
        <Text style={styles.topBarTitle}>Profile Setup</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBox}>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>
            Your display name is visible to group members when you add or split expenses.
          </Text>
        </View>

        {/* Avatar Picker */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Pick profile photo"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.avatarInitials, { color: colors.primary }]}>
                  {name.trim() ? name.trim().charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}

            <View style={styles.cameraBadge}>
              <Camera size={14} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Add photo (optional)</Text>
        </View>

        {/* Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Your Name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Alex Sharma"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={isFormValid ? handleContinue : undefined}
            />
          </View>
        </View>

        {/* Currency Selection */}
        <View style={styles.currencySection}>
          <Text style={styles.inputLabel}>Default Currency</Text>
          <View style={styles.currencyGrid}>
            {POPULAR_CURRENCIES.map((curr) => {
              const isSelected = currency === curr.code;
              return (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyPill,
                    isSelected && styles.currencyPillSelected,
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync().catch(() => {});
                    }
                    setCurrency(curr.code);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.currencyPillText,
                      isSelected && styles.currencyPillTextSelected,
                    ]}
                  >
                    {curr.label}
                  </Text>
                  {isSelected && (
                    <Check size={14} color="#FFFFFF" strokeWidth={2.6} style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.footerSection}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: isFormValid ? colors.primary : colors.surfaceSecondary },
            ]}
            onPress={handleContinue}
            disabled={!isFormValid}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text
                  style={[
                    styles.continueButtonText,
                    { color: isFormValid ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  Continue
                </Text>
                <ArrowRight
                  size={18}
                  color={isFormValid ? '#FFFFFF' : colors.textMuted}
                  strokeWidth={2.4}
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B132B' : '#F9FAFB',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    stepBadge: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.full,
    },
    stepBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    topBarTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 28,
    },
    headerBox: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 28,
    },
    avatarButton: {
      position: 'relative',
      marginBottom: 8,
    },
    avatarPlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 45,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    avatarImage: {
      width: 90,
      height: 90,
      borderRadius: 45,
    },
    avatarInitials: {
      fontSize: 34,
      fontWeight: '800',
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#0B132B' : '#FFFFFF',
    },
    avatarHint: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    inputSection: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputContainer: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.xl,
      paddingHorizontal: 16,
      height: 52,
      justifyContent: 'center',
      ...shadows.sm,
    },
    textInput: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    currencySection: {
      marginBottom: 32,
    },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    currencyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      ...shadows.sm,
    },
    currencyPillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    currencyPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    currencyPillTextSelected: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    footerSection: {
      marginTop: 'auto',
      paddingTop: 16,
    },
    continueButton: {
      height: 54,
      borderRadius: radii.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    continueButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
  });

