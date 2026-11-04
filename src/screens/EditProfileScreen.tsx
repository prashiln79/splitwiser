import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Camera, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';

const EditProfileScreen = ({ navigation }: any) => {
  const { user, updateProfile } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [pickedImage, setPickedImage] = useState<{
    uri: string;
    base64?: string | null;
    mimeType?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Your display name cannot be blank.');
      return;
    }
    setIsSubmitting(true);
    try {
      const updates: { name?: string; imageUrl?: string } = { name: name.trim() };
      if (pickedImage?.base64) {
        const mime = pickedImage.mimeType ?? 'image/jpeg';
        updates.imageUrl = `data:${mime};base64,${pickedImage.base64}`;
      }
      await updateProfile(updates);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Profile Updated', 'Your profile details have been saved.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      let mimeType = asset.mimeType ?? 'image/jpeg';
      if (!/image\//.test(mimeType)) mimeType = 'image/jpeg';
      setPickedImage({ uri: asset.uri, base64: asset.base64, mimeType });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Edit Profile"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <MemberAvatar
              name={name || user?.name || 'User'}
              imageUrl={pickedImage?.uri || user?.imageUrl}
              size={96}
            />
            <TouchableOpacity
              style={[styles.cameraBadge, { backgroundColor: colors.primary }]}
              onPress={pickImage}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              <Camera size={18} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
            Tap camera to change photo
          </Text>
        </View>

        {/* Form */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.sm,
          ]}
        >
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Display Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            autoFocus
            accessibilityLabel="Full Name"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            shadows.md,
          ]}
          onPress={handleUpdateProfile}
          disabled={isSubmitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save Profile Changes"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base,
    borderRadius: radii.xl,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
});

export default EditProfileScreen;
