import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, GroupCoverPhoto } from '../../types';
import {
  PRESET_CATEGORIES,
  PRESET_COVERS,
  PresetCategory,
  PresetCoverItem,
  getSuggestedPresetCategory,
} from '../../constants/presetCovers';
import { GroupCoverService } from '../../services/groupCoverService';
import { MemberAvatar } from './MemberAvatar';
import { compressCoverPhoto } from '../../utils/imageCompressor';
import { useAppTheme, ThemeColors } from '../../theme';

interface GroupCoverPhotoModalProps {
  visible: boolean;
  group: Group | null;
  currentUserId?: string;
  onClose: () => void;
  onSuccess: (updatedCover: GroupCoverPhoto | null) => void;
}

export const GroupCoverPhotoModal: React.FC<GroupCoverPhotoModalProps> = ({
  visible,
  group,
  currentUserId = '',
  onClose,
  onSuccess,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Automatically detect the most appropriate preset category for this group
  const suggestedCategory = useMemo(() => {
    return getSuggestedPresetCategory(group?.icon, group?.name);
  }, [group?.icon, group?.name]);

  // Active Category Filter for Presets (initialized to suggested category)
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>(suggestedCategory);

  // Sync category filter when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedCategory(getSuggestedPresetCategory(group?.icon, group?.name));
      setCandidateCover(null);
    }
  }, [visible, group?.icon, group?.name]);

  // Currently selected candidate cover (either preset or newly picked custom)
  const [candidateCover, setCandidateCover] = useState<{
    type: 'preset' | 'custom';
    imageUrl: string;
    presetId?: string;
    base64?: string | null;
    isRemoved?: boolean;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Active cover currently used (no default cover if none set)
  const activeCoverUrl = useMemo(() => {
    if (candidateCover) {
      if (candidateCover.isRemoved) return null;
      return candidateCover.imageUrl;
    }
    if (group?.coverPhoto?.imageUrl?.trim()) return group.coverPhoto.imageUrl.trim();
    if (group?.bannerUrl?.trim()) return group.bannerUrl.trim();
    return null; // No default cover photo
  }, [candidateCover, group]);

  // Filter presets by category
  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'All') return PRESET_COVERS;
    return PRESET_COVERS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  // Pick image from gallery with 16:9 landscape cropping and compression
  const handlePickFromGallery = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to choose a cover photo.');
        return;
      }
    }

    try {
      // Don't request base64 from picker directly - large gallery photos can exhaust memory
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
        base64: false,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setIsProcessingImage(true);
        const asset = result.assets[0];

        // Downscale to 1280px wide and optimize quality to prevent payload/Firestore failures
        const compressed = await compressCoverPhoto(asset.uri);

        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        setCandidateCover({
          type: 'custom',
          imageUrl: compressed.uri,
          base64: compressed.base64,
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Capture new photo using camera
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take a cover photo.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
        base64: false,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setIsProcessingImage(true);
        const asset = result.assets[0];

        // Compress and optimize to lightweight resolution
        const compressed = await compressCoverPhoto(asset.uri);

        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        setCandidateCover({
          type: 'custom',
          imageUrl: compressed.uri,
          base64: compressed.base64,
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to capture photo.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Select a preset cover
  const handleSelectPreset = (preset: PresetCoverItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setCandidateCover({
      type: 'preset',
      imageUrl: preset.imageUrl,
      presetId: preset.id,
    });
  };

  // Revert / Remove custom cover
  const handleRemoveCover = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setCandidateCover({
      type: 'preset',
      imageUrl: '',
      isRemoved: true,
    });
  };

  // Save changes
  const handleSave = async () => {
    if (!group) return;
    setIsSaving(true);

    try {
      let finalCover: GroupCoverPhoto | null = null;

      if (candidateCover?.isRemoved) {
        // Revert to null / default
        finalCover = null;
      } else if (candidateCover?.type === 'custom') {
        // Upload to Firebase Storage
        finalCover = await GroupCoverService.uploadCustomCoverPhoto(
          group.id,
          candidateCover.imageUrl,
          candidateCover.base64,
          currentUserId
        );
      } else if (candidateCover?.type === 'preset') {
        finalCover = {
          type: 'preset',
          imageUrl: candidateCover.imageUrl,
          presetId: candidateCover.presetId,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserId,
        };
      }

      await GroupCoverService.saveGroupCoverPhoto(
        group.id,
        finalCover,
        group.coverPhoto?.storagePath
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      onSuccess(finalCover);
      onClose();
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not update cover photo.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = candidateCover !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? insets.top + 8 : 16 }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Close"
          >
            <X size={22} color={colors.textPrimary} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Cover Photo</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 84, 100) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Live Preview Card */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionHeading}>PREVIEW</Text>
            <View style={styles.previewCard}>
              {activeCoverUrl ? (
                <>
                  <Image
                    source={{ uri: activeCoverUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <View style={styles.previewScrim} />
                </>
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0F172A' }]} />
              )}

              <View style={styles.previewInnerContent}>
                <View style={styles.previewAvatarBorder}>
                  <MemberAvatar
                    name={group?.name || 'Group'}
                    imageUrl={group?.imageUrl}
                    size={46}
                  />
                </View>
                <Text style={styles.previewGroupName} numberOfLines={1}>
                  {group?.name || 'Group'}
                </Text>
                {activeCoverUrl ? (
                  <Text style={styles.previewSubtitle}>Splitwise Group Header</Text>
                ) : (
                  <Text style={styles.previewSubtitleEmpty}>No cover photo selected</Text>
                )}
              </View>

              {isProcessingImage && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10,
                    },
                  ]}
                >
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 8 }}>
                    Optimizing image...
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Actions (Gallery, Camera, Remove) */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE' }]}>
                <ImageIcon size={20} color="#0284C7" strokeWidth={2.2} />
              </View>
              <Text style={styles.actionBtnText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7' }]}>
                <Camera size={20} color="#16A34A" strokeWidth={2.2} />
              </View>
              <Text style={styles.actionBtnText}>Camera</Text>
            </TouchableOpacity>

            {(group?.coverPhoto || group?.bannerUrl || candidateCover) && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleRemoveCover}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2' }]}>
                  <Trash2 size={20} color="#DC2626" strokeWidth={2.2} />
                </View>
                <Text style={styles.actionBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Preset Gallery Section */}
          <View style={styles.presetSection}>
            <View style={styles.presetHeaderRow}>
              <Sparkles size={16} color="#059669" strokeWidth={2.4} />
              <Text style={styles.sectionHeading}>
                PRESET COVERS GALLERY
                {suggestedCategory !== 'All' ? ` • ${suggestedCategory.toUpperCase()} RECOMMENDED` : ''}
              </Text>
            </View>

            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPillsScroll}
            >
              {PRESET_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const isSuggested = suggestedCategory === cat && cat !== 'All';

                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryPill,
                      isSelected && styles.categoryPillActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat} {isSuggested ? '★' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Presets Grid */}
            <View style={styles.presetsGrid}>
              {filteredPresets.map((preset) => {
                const isCurrent =
                  candidateCover?.presetId === preset.id ||
                  (!candidateCover && group?.coverPhoto?.presetId === preset.id);

                const itemWidth = (screenWidth - 48) / 2;

                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.presetGridItem, { width: itemWidth }]}
                    onPress={() => handleSelectPreset(preset)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: preset.thumbnailUrl }}
                      style={styles.presetThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.presetTitleBar}>
                      <Text style={styles.presetTitleText} numberOfLines={1}>
                        {preset.title}
                      </Text>
                    </View>

                    {isCurrent && (
                      <View style={styles.presetSelectedBadge}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Save Bar */}
        <View style={[styles.bottomSaveBar, { paddingBottom: Math.max(insets.bottom + 8, 14) }]}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              hasChanges && !isSaving ? styles.saveBtnActive : styles.saveBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.saveBtnText,
                  hasChanges ? styles.saveBtnTextActive : styles.saveBtnTextDisabled,
                ]}
              >
                Apply Cover Photo
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    sectionHeading: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    previewSection: {
      marginBottom: 16,
    },
    previewCard: {
      height: 140,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#1E293B',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    previewScrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    previewInnerContent: {
      alignItems: 'center',
      zIndex: 2,
    },
    previewAvatarBorder: {
      borderRadius: 26,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      marginBottom: 6,
    },
    previewGroupName: {
      fontSize: 17,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    previewSubtitle: {
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: 2,
    },
    previewSubtitleEmpty: {
      fontSize: 11,
      color: '#94A3B8',
      marginTop: 2,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionBtn: {
      alignItems: 'center',
      gap: 6,
    },
    actionIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    presetSection: {
      marginTop: 4,
    },
    presetHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    categoryPillsScroll: {
      gap: 8,
      paddingBottom: 12,
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryPillTextActive: {
      color: '#FFFFFF',
    },
    presetsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 4,
    },
    presetGridItem: {
      height: 96,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.border,
    },
    presetThumbnail: {
      width: '100%',
      height: '100%',
    },
    presetTitleBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    presetTitleText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    presetSelectedBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
    },
    bottomSaveBar: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnActive: {
      backgroundColor: colors.primary,
    },
    saveBtnDisabled: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#E5E7EB',
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: '700',
    },
    saveBtnTextActive: {
      color: '#FFFFFF',
    },
    saveBtnTextDisabled: {
      color: colors.textMuted,
    },
  });
