import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Appbar, TextInput, Title } from 'react-native-paper';
import HapticButton from '../components/ui/HapticButton';
import { HapticAppbarBackAction } from '../components/ui/HapticAppbar';
import { joinGroup } from '../services/groups';
import { useAuth } from '../context/AuthContext';

const JoinGroupScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter a join code.');
      return;
    }
    if (!user) return;
    setIsJoining(true);
    try {
      await joinGroup(joinCode.trim(), user.uid, user.name);
      Alert.alert('Success', 'You have joined the group!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group. Please check the code.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <HapticAppbarBackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Join a Group" />
      </Appbar.Header>
      <View style={styles.content}>
        <Title>Enter Group Code</Title>
        <TextInput
          label="Join Code"
          value={joinCode}
          onChangeText={setJoinCode}
          style={styles.input}
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={handleJoinGroup}
          accessibilityLabel="Group Join Code"
        />
        <HapticButton
          mode="contained"
          onPress={handleJoinGroup}
          loading={isJoining}
          disabled={isJoining}
          style={styles.button}
          accessibilityLabel="Join Group"
          accessibilityRole="button"
        >
          Join Group
        </HapticButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  input: { marginBottom: 16 },
  button: { marginTop: 8 },
});

export default JoinGroupScreen;
