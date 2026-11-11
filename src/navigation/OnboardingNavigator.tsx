import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { AuthSelectionScreen } from '../screens/onboarding/AuthSelectionScreen';
import { GuestProfileSetupScreen } from '../screens/onboarding/GuestProfileSetupScreen';
import { IntroSlidesScreen } from '../screens/onboarding/IntroSlidesScreen';
import { FirstSetupSelectionScreen } from '../screens/onboarding/FirstSetupSelectionScreen';
import { OnboardingGroupCreationScreen } from '../screens/onboarding/OnboardingGroupCreationScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';

const Stack = createNativeStackNavigator();

export const OnboardingNavigator: React.FC = () => {
  const { user } = useAuth();

  // Determine initial route based on existing session state:
  // 1. If user is logged in but has not completed profile -> GuestProfileSetup
  // 2. If user is logged in and has completed profile but not finished onboarding -> IntroSlides
  // 3. Otherwise -> Welcome screen
  let initialRoute = 'Welcome';
  if (user) {
    if (!user.hasCompletedProfile || !user.name || user.name === 'Anonymous User') {
      initialRoute = 'GuestProfileSetup';
    } else if (!user.onboardingCompleted) {
      initialRoute = 'IntroSlides';
    }
  }

  return (
    // @ts-ignore react-navigation v7 id prop
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="AuthSelection" component={AuthSelectionScreen} />
      <Stack.Screen name="GuestProfileSetup" component={GuestProfileSetupScreen} />
      <Stack.Screen name="IntroSlides" component={IntroSlidesScreen} />
      <Stack.Screen name="FirstSetupSelection" component={FirstSetupSelectionScreen} />
      <Stack.Screen
        name="OnboardingGroupCreation"
        component={OnboardingGroupCreationScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;

