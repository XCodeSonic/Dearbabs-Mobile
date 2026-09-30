import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  // Use shared values instead of useRef
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const titleTranslateY = useSharedValue(50);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.3);
  const ringOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const lineWidth = useSharedValue(0);
  
  // Floating elegant shapes
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);
  const float3 = useSharedValue(0);
  const float4 = useSharedValue(0);

  useEffect(() => {
    // Main logo entrance animation
    logoScale.value = withSequence(
      withTiming(1.2, { duration: 600, easing: Easing.bezier(0.34, 1.2, 0.64, 1) }),
      withTiming(1, { duration: 200, easing: Easing.ease })
    );
    logoOpacity.value = withTiming(1, { duration: 800 });
    
    // Elegant ring animation
    ringScale.value = withSequence(
      withTiming(1.2, { duration: 1000, easing: Easing.out(Easing.ease) }),
      withTiming(1.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
    );
    ringOpacity.value = withTiming(0.6, { duration: 1000 });
    
    // Glow effect
    glowOpacity.value = withSequence(
      withTiming(0.5, { duration: 800 }),
      withTiming(0.2, { duration: 800 }),
      withTiming(0.5, { duration: 800 })
    );
    
    // Line animation
    lineWidth.value = withDelay(600, withTiming(60, {
      duration: 800,
      easing: Easing.out(Easing.ease),
    }));
    
    // Title animation
    titleTranslateY.value = withDelay(400, withTiming(0, {
      duration: 700,
      easing: Easing.out(Easing.back()),
    }));
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 700 }));
    
    // Subtitle animation
    subtitleOpacity.value = withDelay(800, withTiming(1, { duration: 600 }));
    
    // Elegant floating shapes - using withRepeat for continuous animation
    float1.value = withSequence(
      withTiming(15, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
    );
    float2.value = withSequence(
      withTiming(-12, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) })
    );
    float3.value = withSequence(
      withTiming(18, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) })
    );
    float4.value = withSequence(
      withTiming(-10, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) })
    );

    // After 3 seconds, fade out and navigate
    const timeout = setTimeout(() => {
      containerOpacity.value = withTiming(0, {
        duration: 600,
        easing: Easing.inOut(Easing.ease),
      }, () => {
        runOnJS(navigation.replace)('Welcome');
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  // Animated styles using useAnimatedStyle
  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const animatedTitleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY.value }],
    opacity: titleOpacity.value,
  }));

  const animatedSubtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const animatedLineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }));

  const animatedFloat1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float1.value }],
  }));
  
  const animatedFloat2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float2.value }],
  }));
  
  const animatedFloat3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float3.value }],
  }));
  
  const animatedFloat4Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float4.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#ffffff', '#fff8fa', '#fff0f5', '#ffe8f0']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Elegant floating abstract shapes */}
        <Animated.View style={[styles.elegantShape1, animatedFloat1Style]} />
        <Animated.View style={[styles.elegantShape2, animatedFloat2Style]} />
        <Animated.View style={[styles.elegantShape3, animatedFloat3Style]} />
        <Animated.View style={[styles.elegantShape4, animatedFloat4Style]} />
        
        {/* Decorative gradient orbs */}
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <View style={styles.orb3} />
        
        {/* Minimalist circles */}
        <View style={styles.minimalCircle1} />
        <View style={styles.minimalCircle2} />
        <View style={styles.minimalCircle3} />

        {/* Glow effect behind logo */}
        <Animated.View style={[styles.glowEffect, animatedGlowStyle]} />

        {/* Main Logo Container */}
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../images/index-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Animated.View style={[styles.elegantRing, animatedRingStyle]}>
              <View style={styles.ringDot} />
            </Animated.View>
          </View>
          
          <Animated.View style={animatedTitleStyle}>
            <Text style={styles.logoText}>Dear Bab's</Text>
          </Animated.View>
          
          <Animated.View style={animatedLineStyle}>
            <View style={styles.dividerLine} />
          </Animated.View>
          
          <Animated.View style={animatedSubtitleStyle}>
            <Text style={styles.subtitleText}> Fastfood & Catering Services</Text>
          </Animated.View>
        </Animated.View>
        
        {/* Elegant loading indicator */}
        <View style={styles.loadingContainer}>
          <View style={styles.loadingDot1} />
          <View style={styles.loadingDot2} />
          <View style={styles.loadingDot3} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 25,
    position: 'relative',
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    zIndex: 2,
  },
  elegantRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: '#ffb6d1',
    opacity: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringDot: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b9d',
  },
  glowEffect: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ffb6d1',
    opacity: 0,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 50,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#2d2d2d',
    marginTop: 28,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(255, 107, 157, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  dividerLine: {
    width: '100%',
    height: 1.5,
    backgroundColor: '#ffb6d1',
    marginVertical: 12,
  },
  subtitleText: {
    fontSize: 13,
    color: '#ff8fb1',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  elegantShape1: {
    position: 'absolute',
    top: '12%',
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ffb6d1',
    opacity: 0.12,
  },
  elegantShape2: {
    position: 'absolute',
    bottom: '18%',
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ff9ec0',
    opacity: 0.08,
  },
  elegantShape3: {
    position: 'absolute',
    top: '45%',
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffd1e4',
    opacity: 0.1,
  },
  elegantShape4: {
    position: 'absolute',
    bottom: '35%',
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffc0d9',
    opacity: 0.12,
  },
  orb1: {
    position: 'absolute',
    top: '20%',
    right: '15%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffb6d1',
    opacity: 0.06,
  },
  orb2: {
    position: 'absolute',
    bottom: '25%',
    left: '10%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff9ec0',
    opacity: 0.06,
  },
  orb3: {
    position: 'absolute',
    top: '60%',
    right: '20%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffd1e4',
    opacity: 0.08,
  },
  minimalCircle1: {
    position: 'absolute',
    top: '8%',
    left: '20%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffb6d1',
    opacity: 0.4,
  },
  minimalCircle2: {
    position: 'absolute',
    bottom: '12%',
    right: '25%',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#ff9ec0',
    opacity: 0.3,
  },
  minimalCircle3: {
    position: 'absolute',
    top: '35%',
    left: '15%',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ffd1e4',
    opacity: 0.35,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 10,
  },
  loadingDot1: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffb6d1',
    opacity: 0.6,
  },
  loadingDot2: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff6b9d',
    opacity: 1,
  },
  loadingDot3: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffb6d1',
    opacity: 0.6,
  },
});

export default SplashScreen;