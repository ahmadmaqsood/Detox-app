import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  interpolateColor,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { useAuth } from "@/store/AuthContext";

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  accentColor: string;
}

const slides: Slide[] = [
  {
    id: '1',
    emoji: '🛡️',
    title: 'Take Control\nof Your Life',
    subtitle:
      'Break free from harmful habits and reclaim your focus, energy, and peace of mind.',
    accentColor: '#4ADE80',
  },
  {
    id: '2',
    emoji: '🔍',
    title: 'Understand\nYour Triggers',
    subtitle:
      'Track patterns, identify what pulls you in, and build awareness to stay one step ahead.',
    accentColor: '#F59E0B',
  },
  {
    id: '3',
    emoji: '🔥',
    title: 'Stay\nConsistent',
    subtitle:
      'Build streaks, take on challenges, and watch yourself grow stronger every single day.',
    accentColor: '#818CF8',
  },
  {
    id: "4",
    emoji: "🌙",
    title: "Sleep before 11",
    subtitle:
      "Early sleep protects your mind and energy. Build a clean night routine and wake up strong.",
    accentColor: "#60A5FA",
  },
  {
    id: "5",
    emoji: "📈",
    title: "Track your streak",
    subtitle:
      "Small wins every day become your identity. Don’t break the chain — even 1% progress counts.",
    accentColor: "#34D399",
  },
  {
    id: "6",
    emoji: "🧱",
    title: "Actions > plans",
    subtitle:
      "You don’t need motivation. You need actions. Open the app, do the habits, close the app.",
    accentColor: "#F59E0B",
  },
  {
    id: "7",
    emoji: "🕌",
    title: "Prayer in masjid",
    subtitle:
      "Make it non‑negotiable. Structure your day around prayer — it protects you from slips.",
    accentColor: "#A78BFA",
  },
  {
    id: "8",
    emoji: "🚶",
    title: "More movement = freedom",
    subtitle:
      "Movement clears urges. Walk, breathe, and reset your nervous system — you become free again.",
    accentColor: "#4ADE80",
  },
];

const PARTICLES = [
  { x: -60, y: -80, size: 6, delay: 0 },
  { x: 70, y: -60, size: 4, delay: 200 },
  { x: -50, y: 50, size: 5, delay: 400 },
  { x: 80, y: 40, size: 3, delay: 600 },
  { x: -30, y: -40, size: 4, delay: 300 },
  { x: 40, y: 70, size: 5, delay: 500 },
];

function FloatingParticle({
  x,
  y,
  size,
  delay,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.4, { duration: 800 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 2000 + delay, easing: Easing.inOut(Easing.ease) }),
          withTiming(12, { duration: 2000 + delay, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: x,
          marginTop: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function SlideItem({
  item,
  index,
  scrollX,
}: {
  item: Slide;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const t = useAppTheme();

  const animStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.6, 1, 0.6],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [40, 0, 40],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }],
      opacity,
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];
    const ringScale = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    );
    const ringOpacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 0.15, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale: ringScale }],
      opacity: ringOpacity,
      backgroundColor: item.accentColor,
    };
  });

  const ring2Style = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];
    const s = interpolate(scrollX.value, inputRange, [0.1, 1.35, 0.1], Extrapolation.CLAMP);
    const o = interpolate(scrollX.value, inputRange, [0, 0.08, 0], Extrapolation.CLAMP);
    return { transform: [{ scale: s }], opacity: o, backgroundColor: item.accentColor };
  });

  const titleStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];
    const tY = interpolate(scrollX.value, inputRange, [20, 0, -20], Extrapolation.CLAMP);
    return { transform: [{ translateY: tY }] };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];
    const tY = interpolate(scrollX.value, inputRange, [30, 0, -30], Extrapolation.CLAMP);
    const o = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY: tY }], opacity: o };
  });

  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <Animated.View style={[styles.slideContent, animStyle]}>
        <View style={styles.iconWrapper}>
          <Animated.View style={[styles.iconRing, ringStyle]} />
          <Animated.View style={[styles.iconRing, ring2Style]} />
          {PARTICLES.map((p, i) => (
            <FloatingParticle key={i} {...p} color={item.accentColor} />
          ))}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: item.accentColor + '22' },
            ]}
          >
            <Animated.Text style={styles.emoji}>{item.emoji}</Animated.Text>
          </View>
        </View>

        <Animated.Text style={[styles.title, { color: t.textPrimary }, titleStyle]}>
          {item.title}
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { color: t.textSecondary }, subtitleStyle]}>
          {item.subtitle}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

function Dot({
  index,
  scrollX,
  color,
}: {
  index: number;
  scrollX: SharedValue<number>;
  color: string;
}) {
  const t = useAppTheme();

  const dotStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 28, 8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    );
    const bgColor = interpolateColor(
      scrollX.value,
      inputRange,
      [t.textMuted, color, t.textMuted]
    );

    return { width, opacity, backgroundColor: bgColor };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

export default function OnboardingScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonScale = useSharedValue(1);

  const isLast = activeIndex === slides.length - 1;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
    },
    []
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLast) {
      // Onboarding is intentionally shown on every app open (no one-time completion).
      router.replace(user ? "/(drawer)/(tabs)/today" : "/(auth)/login");
    } else {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (isLast) {
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      buttonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    }
  }, [isLast]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const buttonBgStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      scrollX.value,
      slides.map((_, i) => i * SCREEN_W),
      slides.map((s) => s.accentColor)
    );
    return { backgroundColor: color };
  });

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <SlideItem item={item} index={index} scrollX={scrollX} />
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <Dot
              key={slide.id}
              index={i}
              scrollX={scrollX}
              color={slide.accentColor}
            />
          ))}
        </View>

        <Animated.View style={[buttonAnimStyle, styles.buttonWrapper]}>
          <Pressable
            onPressIn={() => {
              buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            onPress={goNext}
          >
            <Animated.View style={[styles.button, buttonBgStyle]}>
              <Animated.Text
                key={isLast ? 'start' : 'next'}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(100)}
                style={[styles.buttonText, { color: t.textInverse }]}
              >
                {isLast ? 'Start Journey' : 'Next'}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        </Animated.View>

        <Pressable onPress={goNext} style={styles.skipRow}>
          {!isLast && (
            <Animated.Text
              entering={FadeIn}
              exiting={FadeOut}
              style={[styles.skipText, { color: t.textMuted }]}
            >
              Skip
            </Animated.Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  iconWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  iconRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 70,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 52,
    lineHeight: 60,
  },
  title: {
    ...typography.largeTitle,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    paddingVertical: spacing.lg + 2,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.headline,
    fontWeight: '700',
  },
  skipRow: {
    alignItems: 'center',
    minHeight: 20,
  },
  skipText: {
    ...typography.subhead,
  },
});
