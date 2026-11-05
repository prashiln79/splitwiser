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
import { Hash } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { joinGroup } from '../services/groups';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/common/AppHeader';

const JoinGroupScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Code Required', 'Please enter a 6-character group join code.');
      return;
    }
    if (!user) return;

    setIsJoining(true);
    try {
      const group = await joinGroup(code, user.uid, user.name);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      Alert.alert('Welcome!', `You have successfully joined "${group.name}".`);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Unable to Join', error.message || 'No group found with that code. Please verify and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Join a Group"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Hash size={28} color="#059669" strokeWidth={2.4} />
          </View>

          <Text style={styles.cardTitle}>
            Enter Group Code
          </Text>
          <Text style={styles.cardSubtitle}>
            Enter the 6-character code shared by the group creator.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              placeholder="e.g. 7X8K2M"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleJoinGroup}
              autoFocus
              accessibilityLabel="Group Join Code"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.joinButton,
              {
                backgroundColor: joinCode.trim().length >= 4 ? '#059669' : '#E8E8E8',
              },
            ]}
            onPress={handleJoinGroup}
            disabled={isJoining || joinCode.trim().length < 4}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {isJoining ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text
                style={[
                  styles.joinButtonText,
                  { color: joinCode.trim().length >= 4 ? '#FFFFFF' : '#9E9E9E' },
                ]}
              >
                Join Group
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
    marginTop: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0FAF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  codeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  joinButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default JoinGroupScreen;
