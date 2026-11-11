import React from 'react';
import OnboardingNavigator from '../navigation/OnboardingNavigator';

/**
 * OnboardingScreen wraps the modern multi-screen Splitwise-style onboarding flow.
 * Screens:
 * 1. WelcomeScreen - App logo, tagline, Get Started & Log In
 * 2. AuthSelectionScreen - Guest (instant access), Google, Email signup/login
 * 3. GuestProfileSetupScreen - Name, avatar picker, currency selection
 * 4. IntroSlidesScreen - 3 interactive walkthrough slides with Skip & dots
 * 5. FirstSetupSelectionScreen - "What would you like to do first?"
 * 6. OnboardingGroupCreationScreen - Group name, type, currency, create group
 */
const OnboardingScreen = () => {
  return <OnboardingNavigator />;
};

export default OnboardingScreen;
