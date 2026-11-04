import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import {
  Text,
  TextInput,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import HapticButton from '../components/ui/HapticButton';
import { useAuth } from '../context/AuthContext';

const OnboardingScreen = () => {
  const { completeOnboarding, isLoading } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert('Name too short', 'Your name must be at least 2 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      await completeOnboarding(trimmed);
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('[Onboarding] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Logo / branding */}
        <View style={styles.brandContainer}>
          <View
            style={[
              styles.logoCircle,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Text style={styles.logoEmoji}>💸</Text>
          </View>
          <Text
            variant="displaySmall"
            style={[styles.appName, { color: theme.colors.primary }]}
          >
            Splitwiser
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}
          >
            Split expenses, stay friends.
          </Text>
        </View>

        {/* Name input */}
        <View style={styles.formContainer}>
          <Text variant="titleMedium" style={styles.label}>
            What should we call you?
          </Text>
          <TextInput
            label="Your name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            disabled={isSubmitting}
            accessibilityLabel="Enter your name"
          />

          <HapticButton
            mode="contained"
            onPress={handleContinue}
            loading={isSubmitting}
            disabled={isSubmitting || !name.trim()}
            style={styles.button}
            contentStyle={styles.buttonContent}
            accessibilityLabel="Continue to Splitwiser"
            accessibilityRole="button"
          >
            Get Started
          </HapticButton>

          <Text
            variant="bodySmall"
            style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}
          >
            No account required. Your session persists automatically.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 8,
  },
  formContainer: {
    gap: 8,
  },
  label: {
    marginBottom: 4,
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  disclaimer: {
    textAlign: 'center',
    marginTop: 16,
  },
});

export default OnboardingScreen;
