import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from 'react-native';
import {
  X,
  Camera,
  ImageIcon,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { MemberAvatar } from './MemberAvatar';
import { GoogleIcon } from './GoogleIcon';
import { UserProfilePhotoService } from '../../services/userProfilePhotoService';
import { AppUser } from '../../types';

interface ProfilePhotoModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (user: AppUser) => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [candidateUri, setCandidateUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset candidate when modal opens
  React.useEffect(() => {
    if (visible) {
      setCandidateUri(null);
      setIsSaving(false);
    }
  }, [visible]);

  const hasGooglePhoto = Boolean(user?.googlePhotoUrl && user.googlePhotoUrl.trim());
  const hasCustomPhoto = Boolean(user?.customPhotoUrl && user.customPhotoUrl.trim());
  const isCurrentlyGoogle = user?.photoSource === 'google';
  const isCurrentlyCustom = user?.photoSource === 'custom' || (!user?.photoSource && hasCustomPhoto);

  // Pick from Photo Gallery
  const handlePickFromGallery = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to choose a profile picture.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        setCandidateUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select photo.');
    }
  };

  // Capture with Camera
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is required to take a profile picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        setCandidateUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to take photo.');
    }
  };

  // Save candidate image
  const handleSaveCandidate = async () => {
    if (!candidateUri || !user) return;
    setIsSaving(true);

    try {
      const updated = await UserProfilePhotoService.setCustomProfilePhoto(
        user.uid,
        candidateUri
      );
      await refreshUser();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onSuccess?.(updated);
      onClose();
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Failed to save profile picture.');
    } finally {
      setIsSaving(false);
    }
  };

  // Switch to Google Account Photo
  const handleUseGooglePhoto = async () => {
    if (!user || !user.googlePhotoUrl) return;
    setIsSaving(true);

    try {
      const updated = await UserProfilePhotoService.switchToGooglePhoto(
        user.uid,
        user.googlePhotoUrl
      );
      await refreshUser();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onSuccess?.(updated);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to switch to Google picture.');
    } finally {
      setIsSaving(false);
    }
  };

  // Remove photo (falls back to Google or initials)
  const handleRemovePhoto = async () => {
    if (!user) return;

    Alert.alert(
      'Remove Photo',
      hasGooglePhoto
        ? 'Remove custom picture and switch back to your Google profile photo?'
        : 'Remove your profile picture and use initials instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              const updated = await UserProfilePhotoService.removeCustomPhoto(
                user.uid,
                user.googlePhotoUrl
              );
              await refreshUser();
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              onSuccess?.(updated);
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove picture.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            { paddingBottom: Math.max(insets.bottom + 16, 24) },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Profile Picture</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Avatar Preview */}
          <View style={styles.previewContainer}>
            <View style={styles.previewAvatarRing}>
              {candidateUri ? (
                <Image
                  source={{ uri: candidateUri }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                  resizeMode="cover"
                />
              ) : (
                <MemberAvatar
                  name={user?.name || 'User'}
                  imageUrl={user?.imageUrl}
                  size={100}
                />
              )}
            </View>

            {/* Source Pill Badge */}
            <View style={styles.sourceBadgeRow}>
              {candidateUri ? (
                <View style={[styles.sourceBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Sparkles size={11} color="#D97706" style={{ marginRight: 4 }} />
                  <Text style={[styles.sourceBadgeText, { color: '#B45309' }]}>
                    New Photo Selected (Unsaved)
                  </Text>
                </View>
              ) : isCurrentlyCustom && user?.imageUrl ? (
                <View style={[styles.sourceBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.sourceBadgeText, { color: '#059669' }]}>
                    Custom Picture
                  </Text>
                </View>
              ) : isCurrentlyGoogle && hasGooglePhoto ? (
                <View style={[styles.sourceBadge, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                  <GoogleIcon size={12} style={{ marginRight: 4 }} />
                  <Text style={[styles.sourceBadgeText, { color: '#0284C7' }]}>
                    Google Account Photo
                  </Text>
                </View>
              ) : (
                <View style={[styles.sourceBadge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                  <Text style={[styles.sourceBadgeText, { color: '#6B7280' }]}>
                    Initials Fallback
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action List */}
          <View style={styles.actionList}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handlePickFromGallery}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
                <ImageIcon size={18} color="#0284C7" strokeWidth={2.2} />
              </View>
              <Text style={styles.actionItemText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Camera size={18} color="#16A34A" strokeWidth={2.2} />
              </View>
              <Text style={styles.actionItemText}>Take Photo</Text>
            </TouchableOpacity>

            {/* Revert / Switch to Google Photo Option */}
            {hasGooglePhoto && !isCurrentlyGoogle && !candidateUri && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleUseGooglePhoto}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#F3F4F6' }]}>
                  <GoogleIcon size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionItemText}>Use Google Photo</Text>
                  <Text style={styles.actionItemSubText}>Switch back to your Google profile picture</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Remove Custom Photo Option */}
            {(hasCustomPhoto || user?.imageUrl) && !candidateUri && (
              <TouchableOpacity
                style={[styles.actionItem, { borderBottomWidth: 0 }]}
                onPress={handleRemovePhoto}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Trash2 size={18} color="#DC2626" strokeWidth={2.2} />
                </View>
                <Text style={[styles.actionItemText, { color: '#DC2626' }]}>
                  {hasGooglePhoto ? 'Remove Custom Picture' : 'Remove Picture'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Candidate Confirm or Cancel Bar */}
          {candidateUri && (
            <View style={styles.confirmBar}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCandidateUri(null)}
                disabled={isSaving}
              >
                <Text style={styles.cancelBtnText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveCandidate}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Save Picture</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  previewAvatarRing: {
    padding: 4,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sourceBadgeRow: {
    marginTop: 10,
    alignItems: 'center',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  sourceBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginVertical: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionItemSubText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

