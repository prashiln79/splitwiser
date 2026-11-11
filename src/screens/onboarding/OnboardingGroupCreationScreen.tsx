import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Plane,
  Home,
  Heart,
  Grid,
  Camera,
  ArrowRight,
  Sparkles,
  ChevronLeft,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';
import { createGroup } from '../../services/groups';
import { createGroupLocal, getLocalGroups } from '../../repositories/groupRepository';
import { networkMonitor } from '../../sync/networkMonitor';
import { compressAvatarPhoto } from '../../utils/imageCompressor';
import { GroupCoverPhoto } from '../../types';

type GroupType = 'trip' | 'home' | 'couple' | 'other';

const GROUP_TYPES: { id: GroupType; label: string; icon: any }[] = [
  { id: 'home', label: 'Home / Flat', icon: Home },
  { id: 'trip', label: 'Trip', icon: Plane },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'other', label: 'Other', icon: Grid },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR' },
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
];

interface OnboardingGroupCreationScreenProps {
  navigation: any;
  route: any;
}

export const OnboardingGroupCreationScreen: React.FC<OnboardingGroupCreationScreenProps> = ({
  navigation,
  route,
}) => {
  const { user, finishOnboarding } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const initialType: GroupType = route?.params?.initialType || 'home';
  const suggestedName: string = route?.params?.suggestedName || '';

  const [name, setName] = useState(suggestedName);
  const [selectedType, setSelectedType] = useState<GroupType>(initialType);
  const [currency, setCurrency] = useState('INR');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64?: string | null } | null>(null);
  const [pickedCover, setPickedCover] = useState<GroupCoverPhoto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickAvatar = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Allow access to your photos to choose a group icon.');
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
        setPickedImage({
          uri: compressed.uri,
          base64: compressed.base64,
        });
      }
    } catch (e: any) {
      console.warn('[OnboardingGroup] Image pick error:', e);
    }
  };

  const handleSkip = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      await finishOnboarding();
    } catch (e) {
      console.warn('[OnboardingGroup] Skip error:', e);
    }
  };

  const handleCreateGroup = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user) {
      Alert.alert('Group Name Required', 'Please enter a name for your group.');
      return;
    }

    setIsSubmitting(true);
    try {
      const imagePayload = pickedImage?.base64
        ? `data:image/jpeg;base64,${pickedImage.base64}`
        : pickedImage?.uri;

      let createdGroupId = '';
      if (networkMonitor.isCurrentlyOnline()) {
        const created = await createGroup(
          trimmed,
          user.uid,
          user.name,
          currency,
          imagePayload,
          selectedType,
          pickedCover || undefined
        );
        createdGroupId = created.id;
      } else {
        const created = await createGroupLocal(
          trimmed,
          user.uid,
          user.name,
          currency,
          imagePayload,
          selectedType,
          pickedCover || undefined
        );
        createdGroupId = created.id;
        await getLocalGroups(user.uid);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Mark onboarding completed
      await finishOnboarding();

      // AppNavigator switches to MainNavigator where the newly created group is already in SQLite!
    } catch (err: any) {
      Alert.alert('Group Creation Failed', err.message || 'Could not create group.');
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Create Group</Text>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipTopButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Skip group creation"
        >
          <Text style={styles.skipTopText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Picker & Title */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Pick group photo"
          >
            {pickedImage?.uri ? (
              <Image source={{ uri: pickedImage.uri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Camera size={28} color="#A5B4FC" strokeWidth={2} />
                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Group Name Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>GROUP NAME</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. 221B Baker St, Goa Trip..."
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
            maxLength={40}
            autoFocus
          />
        </View>

        {/* Group Type Selector */}
        <View style={styles.section}>
          <Text style={styles.inputLabel}>GROUP TYPE</Text>
          <View style={styles.typeGrid}>
            {GROUP_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    isSelected && styles.typeCardSelected,
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    setSelectedType(type.id);
                  }}
                  activeOpacity={0.8}
                >
                  <Icon
                    size={22}
                    color={isSelected ? '#34D399' : 'rgba(255, 255, 255, 0.6)'}
                    strokeWidth={isSelected ? 2.4 : 2}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      isSelected && styles.typeLabelSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Currency Selector */}
        <View style={styles.section}>
          <Text style={styles.inputLabel}>DEFAULT CURRENCY</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map((cur) => {
              const isSelected = currency === cur.code;
              return (
                <TouchableOpacity
                  key={cur.code}
                  style={[
                    styles.currencyPill,
                    isSelected && styles.currencyPillSelected,
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    setCurrency(cur.code);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      isSelected && styles.currencyTextSelected,
                    ]}
                  >
                    {cur.symbol} {cur.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Info callout */}
        <View style={styles.calloutCard}>
          <Sparkles size={18} color="#34D399" strokeWidth={2.2} />
          <Text style={styles.calloutText}>
            You will receive a shareable 6-character code to invite members right after creating.
          </Text>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[
            styles.createButton,
            (!name.trim() || isSubmitting) && styles.createButtonDisabled,
          ]}
          onPress={handleCreateGroup}
          disabled={!name.trim() || isSubmitting}
          activeOpacity={0.88}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.createButtonText}>Create Group</Text>
              <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#070D1F' : '#0B132B',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    topBarTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    skipTopButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    skipTopText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.8)',
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(5, 150, 105, 0.4)',
      ...shadows.md,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#A5B4FC',
      marginTop: 4,
      letterSpacing: 0.2,
    },
    inputGroup: {
      marginBottom: 24,
    },
    section: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: '#A5B4FC',
      letterSpacing: 1,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: radii.xl,
      height: 52,
      paddingHorizontal: 18,
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    typeCard: {
      flex: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.05)',
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 10,
    },
    typeCardSelected: {
      borderColor: '#059669',
      backgroundColor: 'rgba(5, 150, 105, 0.15)',
    },
    typeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
    },
    typeLabelSelected: {
      color: '#34D399',
      fontWeight: '700',
    },
    currencyRow: {
      flexDirection: 'row',
      gap: 10,
    },
    currencyPill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.05)',
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    currencyPillSelected: {
      borderColor: '#059669',
      backgroundColor: 'rgba(5, 150, 105, 0.15)',
    },
    currencyText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.7)',
    },
    currencyTextSelected: {
      color: '#34D399',
      fontWeight: '700',
    },
    calloutCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(5, 150, 105, 0.12)',
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: 'rgba(5, 150, 105, 0.25)',
      padding: 14,
      marginBottom: 28,
      gap: 12,
    },
    calloutText: {
      flex: 1,
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.85)',
      lineHeight: 18,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#059669',
      height: 52,
      borderRadius: radii.lg,
      ...shadows.md,
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

