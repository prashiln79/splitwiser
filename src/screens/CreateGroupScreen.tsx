import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  X,
  Camera,
  Plane,
  Home,
  Heart,
  Grid,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, ThemeColors } from '../theme';
import { createGroup } from '../services/groups';
import { createGroupLocal, getLocalGroups } from '../repositories/groupRepository';
import { networkMonitor } from '../sync/networkMonitor';
import { GroupCoverPhotoModal } from '../components/common/GroupCoverPhotoModal';
import { compressAvatarPhoto } from '../utils/imageCompressor';
import { getDefaultCoverPhoto } from '../constants/presetCovers';
import { GroupCoverPhoto } from '../types';
import { APP_LIMITS } from '../constants/limits';

type GroupType = 'trip' | 'home' | 'couple' | 'other';

const GROUP_TYPES: { id: GroupType; label: string; icon: any }[] = [
  { id: 'trip', label: 'Trip', icon: Plane },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'other', label: 'Other', icon: Grid },
];

export const CreateGroupScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<GroupType>('home');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64?: string | null } | null>(null);
  const [pickedCover, setPickedCover] = useState<GroupCoverPhoto | null>(null);
  const [coverModalVisible, setCoverModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Allow photo library access to choose a group image.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const compressed = await compressAvatarPhoto(result.assets[0].uri);
      setPickedImage({ uri: compressed.uri, base64: compressed.base64 });
    }
  };

  const handleDone = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user) return;

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
          'INR',
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
          'INR',
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

      // Replace current screen with the newly created Group Details page (Step 5 in Splitwise flow)
      navigation.replace('GroupDetails', {
        groupId: createdGroupId,
        groupName: trimmed,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group.');
      setIsSubmitting(false);
    }
  };

  const isDoneEnabled = name.trim().length > 0 && !isSubmitting;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <X size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Create a group</Text>

        <TouchableOpacity
          onPress={handleDone}
          disabled={!isDoneEnabled}
          style={styles.doneBtn}
          accessibilityLabel="Done"
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.doneBtnText, { color: isDoneEnabled ? colors.primary : colors.textMuted }]}>
              Done
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group Photo + Name Input Row */}
          <View style={styles.inputSection}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={pickImage}
              activeOpacity={0.7}
              accessibilityLabel="Choose group photo"
              accessibilityRole="button"
            >
              {pickedImage ? (
                <Image source={{ uri: pickedImage.uri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.cameraIconBox}>
                  <Camera size={24} color="#6B7280" strokeWidth={1.8} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.nameInputCol}>
              <Text style={styles.nameInputLabel}>Group name</Text>
              <TextInput
                style={styles.nameTextInput}
                placeholder=""
                placeholderTextColor="#9E9E9E"
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                maxLength={APP_LIMITS.GROUP.MAX_NAME_LENGTH}
                onSubmitEditing={isDoneEnabled ? handleDone : undefined}
                accessibilityLabel="Group name"
              />
            </View>
          </View>

          {/* Type Selection */}
          <View style={styles.typeSection}>
            <Text style={styles.typeSectionTitle}>Type</Text>

            <View style={styles.typeGrid}>
              {GROUP_TYPES.map((type) => {
                const IconComponent = type.icon;
                const isSelected = selectedType === type.id;

                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeChip,
                      isSelected && styles.typeChipSelected,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }
                      setSelectedType(type.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <IconComponent
                      size={18}
                      color={isSelected ? '#059669' : '#4B5563'}
                      strokeWidth={2}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        isSelected && styles.typeChipTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Optional Cover Photo Selection */}
          <View style={styles.coverSection}>
            <Text style={styles.typeSectionTitle}>Cover Photo (Optional)</Text>
            <TouchableOpacity
              style={styles.coverPreviewCard}
              onPress={() => setCoverModalVisible(true)}
              activeOpacity={0.85}
            >
              <Image
                source={{
                  uri:
                    pickedCover?.imageUrl ||
                    getDefaultCoverPhoto('new', selectedType, name).imageUrl,
                }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={styles.coverScrim} />
              <View style={styles.coverOverlayContent}>
                <Camera size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.coverPickerText}>
                  {pickedCover ? 'Change Cover Photo' : 'Select Cover Photo'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Cover Photo Selection Modal */}
      <GroupCoverPhotoModal
        visible={coverModalVisible}
        group={{
          id: 'temp_new',
          name: name || 'New Group',
          currency: 'INR',
          joinCode: '',
          createdBy: user?.uid || '',
          createdAt: new Date(),
          imageUrl: pickedImage?.uri,
          memberIds: [user?.uid || ''],
          coverPhoto: pickedCover || undefined,
        }}
        currentUserId={user?.uid || ''}
        onClose={() => setCoverModalVisible(false)}
        onSuccess={(updatedCover) => {
          setPickedCover(updatedCover);
        }}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  doneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 50,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  photoButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  cameraIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  nameInputCol: {
    flex: 1,
    marginLeft: 18,
  },
  nameInputLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  nameTextInput: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary, // Distinctive Splitwise teal underline
  },
  typeSection: {
    marginTop: 8,
  },
  typeSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 14,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? colors.surfaceSecondary : '#ECFDF5',
  },
  typeChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  typeChipTextSelected: {
    color: colors.primary,
  },
  coverSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  coverPreviewCard: {
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: isDark ? colors.surfaceSecondary : '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  coverScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  coverOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 2,
  },
  coverPickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CreateGroupScreen;

