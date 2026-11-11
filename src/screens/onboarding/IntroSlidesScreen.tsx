import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Divide,
  Scale,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Sparkles,
  ArrowRightLeft,
  ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';

interface IntroSlidesScreenProps {
  navigation: any;
}

interface SlideItem {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: any;
  bulletPoints: { icon: any; text: string }[];
  accentColor: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES: SlideItem[] = [
  {
    id: 'slide_1',
    title: 'Share Expenses with Anyone',
    tagline: 'Groups, Trips & Daily Living',
    description:
      'Organize shared finances effortlessly. Keep track of apartment bills, road trips, group dinners, and household groceries without the awkward reminders.',
    icon: Users,
    accentColor: '#059669', // Emerald
    bulletPoints: [
      { icon: Receipt, text: 'Real-time multi-currency expense ledger' },
      { icon: Users, text: 'Unlimited members with instant invite codes' },
      { icon: ShieldCheck, text: 'Works completely offline with automatic sync' },
    ],
  },
  {
    id: 'slide_2',
    title: 'Split Expenses Fairly',
    tagline: 'Equally, Unequally, or Custom',
    description:
      'Not every bill is equal. Split costs equally, by exact currency amounts, percentage shares, or itemized contributions so everyone pays their fair share.',
    icon: Scale,
    accentColor: '#10B981', // Mint/Emerald
    bulletPoints: [
      { icon: Divide, text: 'Split equally or adjust exact member shares' },
      { icon: Sparkles, text: 'Smart tip and tax distribution calculations' },
      { icon: Receipt, text: 'Attach receipts and itemized breakdown notes' },
    ],
  },
  {
    id: 'slide_3',
    title: 'Track Balances & Settle Up',
    tagline: 'Smart Debt Simplification',
    description:
      'See who owes who at a glance. Our debt minimization engine automatically condenses tangled group IOUs into the fewest possible payments.',
    icon: ArrowRightLeft,
    accentColor: '#34D399', // Bright emerald
    bulletPoints: [
      { icon: Sparkles, text: 'Fewer transactions required to settle the whole group' },
      { icon: CheckCircle2, text: 'One-tap settlement records with instant receipting' },
      { icon: ArrowRightLeft, text: 'Comprehensive payment history and audit trail' },
    ],
  },
];

export const IntroSlidesScreen: React.FC<IntroSlidesScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    handleComplete();
  };

  const handleComplete = () => {
    navigation.navigate('FirstSetupSelection');
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    if (slideSize > 0) {
      const index = Math.round(offset / slideSize);
      if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
        setActiveIndex(index);
      }
    }
  };

  const renderSlide = ({ item }: { item: SlideItem }) => {
    const IconComponent = item.icon;
    return (
      <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
        {/* Visual Badge Banner */}
        <View style={styles.cardVisualWrapper}>
          <View style={styles.illustrationCard}>
            <View style={[styles.iconHalo, { backgroundColor: `${item.accentColor}18` }]}>
              <View style={[styles.iconCenter, { backgroundColor: item.accentColor }]}>
                <IconComponent size={42} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>

            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{item.tagline}</Text>
            </View>
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>

          {/* Bullet points */}
          <View style={styles.bulletList}>
            {item.bulletPoints.map((bp, i) => {
              const BpIcon = bp.icon;
              return (
                <View key={i} style={styles.bulletItem}>
                  <View style={[styles.bulletIconWrap, { backgroundColor: `${item.accentColor}15` }]}>
                    <BpIcon size={16} color={item.accentColor} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.bulletText}>{bp.text}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header with Skip */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepIndicatorText}>
            {activeIndex + 1} of {SLIDES.length}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        style={styles.flatList}
      />

      {/* Bottom Navigation Controls */}
      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
        >
          <Text style={styles.nextButtonText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#070D1F' : '#0B132B',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 8,
      zIndex: 10,
    },
    stepIndicator: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    stepIndicatorText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#A5B4FC',
      letterSpacing: 0.3,
    },
    skipButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    skipButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.75)',
    },
    flatList: {
      flex: 1,
    },
    slideContainer: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: 'center',
    },
    cardVisualWrapper: {
      alignItems: 'center',
      marginBottom: 32,
    },
    illustrationCard: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.05)',
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      paddingVertical: 36,
      paddingHorizontal: 24,
      alignItems: 'center',
      ...shadows.md,
    },
    iconHalo: {
      width: 108,
      height: 108,
      borderRadius: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    iconCenter: {
      width: 74,
      height: 74,
      borderRadius: 37,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.lg,
    },
    badgePill: {
      backgroundColor: 'rgba(5, 150, 105, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(5, 150, 105, 0.35)',
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: radii.full,
    },
    badgePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#34D399',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    textContent: {
      alignItems: 'center',
    },
    slideTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
      letterSpacing: -0.4,
      marginBottom: 10,
    },
    slideDescription: {
      fontSize: 14.5,
      lineHeight: 22,
      color: 'rgba(255, 255, 255, 0.72)',
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 6,
    },
    bulletList: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(255, 255, 255, 0.03)',
      borderRadius: radii.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      gap: 12,
    },
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bulletIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.88)',
      lineHeight: 18,
    },
    bottomControls: {
      paddingHorizontal: 28,
      paddingTop: 16,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      gap: 8,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      width: 24,
      backgroundColor: '#059669',
    },
    dotInactive: {
      width: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#059669',
      height: 52,
      borderRadius: radii.lg,
      ...shadows.md,
    },
    nextButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
  });
