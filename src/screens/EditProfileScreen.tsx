import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Appbar, Avatar, TextInput, Title } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import HapticButton from '../components/ui/HapticButton';
import { HapticAppbarBackAction } from '../components/ui/HapticAppbar';
import { useAuth } from '../context/AuthContext';

const EditProfileScreen = ({ navigation }: any) => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64?: string | null; mimeType?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
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
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow media library access to select a photo.');
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
    <View style={styles.container}>
      <Appbar.Header>
        <HapticAppbarBackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Edit Profile" />
      </Appbar.Header>

      <View style={styles.content}>
        <Title>Edit Your Details</Title>

        <View style={styles.profilePictureSection}>
          {pickedImage?.uri ? (
            <Avatar.Image size={100} source={{ uri: pickedImage.uri }} />
          ) : user?.imageUrl && /^(https?:|data:image)/.test(user.imageUrl) ? (
            <Avatar.Image size={100} source={{ uri: user.imageUrl }} />
          ) : (
            <Avatar.Text size={100} label={(user?.name ?? '?').charAt(0)} />
          )}
          <HapticButton
            mode="outlined"
            onPress={pickImage}
            icon="camera"
            style={styles.imageButton}
          >
            {pickedImage ? 'Change Photo' : 'Add Photo'}
          </HapticButton>
        </View>

        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          accessibilityLabel="Full Name"
        />
        <HapticButton
          mode="contained"
          onPress={handleUpdateProfile}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.button}
        >
          Save Changes
        </HapticButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  profilePictureSection: { alignItems: 'center', marginBottom: 24 },
  imageButton: { marginTop: 12 },
  input: { marginBottom: 16 },
  button: { marginTop: 8 },
});

export default EditProfileScreen;
