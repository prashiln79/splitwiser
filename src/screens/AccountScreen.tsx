import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Appbar, Avatar, Divider, List, Text } from 'react-native-paper';
import { HapticListItem } from '../components/ui/HapticList';
import { useAuth } from '../context/AuthContext';

const AccountScreen = ({ navigation }: any) => {
  const { user, updateProfile } = useAuth();

  const handleComingSoon = () => {
    Alert.alert('Coming Soon', 'This feature is not yet implemented.');
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Account" />
      </Appbar.Header>

      <View style={styles.content}>
        <View style={styles.profileSection}>
          {user?.imageUrl && /^(https?:|data:image)/.test(user.imageUrl) ? (
            <Avatar.Image size={80} source={{ uri: user.imageUrl }} />
          ) : (
            <Avatar.Text size={80} label={user?.name?.charAt(0) ?? 'A'} />
          )}
          <Text variant="headlineSmall" style={styles.name}>
            {user?.name}
          </Text>
          <Text variant="bodyMedium" style={styles.anonBadge}>
            🔒 Anonymous Account
          </Text>
        </View>

        <List.Section>
          <HapticListItem
            title="Edit Profile"
            left={() => <List.Icon icon="account-edit" />}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityLabel="Edit Profile"
            accessibilityRole="button"
          />
          <Divider />
          <HapticListItem
            title="Send Feedback"
            left={() => <List.Icon icon="message-alert-outline" />}
            onPress={handleComingSoon}
            accessibilityLabel="Send Feedback"
            accessibilityRole="button"
          />
          <Divider />
          <HapticListItem
            title="About Splitwiser"
            left={() => <List.Icon icon="information-outline" />}
            onPress={handleComingSoon}
            accessibilityLabel="About Splitwiser"
            accessibilityRole="button"
          />
        </List.Section>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  profileSection: { alignItems: 'center', marginBottom: 24 },
  name: { marginTop: 16 },
  anonBadge: { marginTop: 4, color: 'gray' },
});

export default AccountScreen;
