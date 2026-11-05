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
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';

const EditProfileScreen = ({ navigation }: any) => {
  const { user, updateProfile } = useAuth();
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
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to change your avatar.');
        return;
      }
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
    <View style={styles.container}>
      <AppHeader
        title="Edit Profile"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={handleUpdateProfile}
            disabled={isSubmitting}
            style={styles.saveHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <Check size={22} color="#059669" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        }
      />

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <MemberAvatar
              name={name || user?.name || 'User'}
              imageUrl={pickedImage?.uri || user?.imageUrl}
              size={88}
            />
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={pickImage}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              <Camera size={16} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.avatarHint}>
            Tap camera to change photo
          </Text>
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9E9E9E"
            autoFocus
            accessibilityLabel="Full Name"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: name.trim() ? '#059669' : '#E8E8E8' },
          ]}
          onPress={handleUpdateProfile}
          disabled={isSubmitting || !name.trim()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save Profile Changes"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={[styles.saveButtonText, { color: name.trim() ? '#FFFFFF' : '#9E9E9E' }]}>
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  saveHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 8,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 6,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#059669',
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default EditProfileScreen;
