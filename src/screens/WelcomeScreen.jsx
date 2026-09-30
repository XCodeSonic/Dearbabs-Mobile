import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const { setGuestMode } = useAuth();
  
  // Use shared values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const buttonScale = useSharedValue(1);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const subtitleOpacity = useSharedValue(0);
  const dividerScale = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(300, withTiming(0, { duration: 600 }));
    dividerScale.value = withDelay(600, withTiming(1, { duration: 500 }));
    subtitleOpacity.value = withDelay(800, withTiming(1, { duration: 600 }));
    fadeAnim.value = withDelay(200, withTiming(1, { duration: 800 }));
    slideAnim.value = withDelay(200, withTiming(0, { duration: 800 }));
  }, []);

  const handleGuestPress = async () => {
    buttonScale.value = withSequence(
      withSpring(0.95),
      withSpring(1)
    );
    await setGuestMode();
    setTimeout(() => {
      navigation.replace('Main');
    }, 150);
  };

  const handleSignInPress = () => {
    buttonScale.value = withSequence(
      withSpring(0.95),
      withSpring(1)
    );
    setTimeout(() => {
      navigation.navigate('Login');
    }, 150);
  };

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const animatedTitleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const animatedSubtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const animatedDividerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: dividerScale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#ffffff', '#fff8fa', '#fff0f5', '#ffe8f0']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.premiumShape1} />
        <View style={styles.premiumShape2} />
        <View style={styles.premiumShape3} />
        <View style={styles.premiumShape4} />
        <View style={styles.premiumShape5} />
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <View style={styles.orb3} />

        <Animated.View style={[styles.content, animatedContainerStyle]}>
          <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
            <View style={styles.logoWrapper}>
              <View style={styles.logoRing} />
              <Image
                source={require('../images/index-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View style={styles.logoGlow} />
            </View>
          </Animated.View>
          
          <Animated.View style={animatedTitleStyle}>
            <Text style={styles.welcomePrefix}>Welcome to</Text>
            <Text style={styles.companyName}>Dear Bab's</Text>
            <Text style={styles.companySubtitle}>Fastfood and Catering Services</Text>
          </Animated.View>
          
          <Animated.View style={[styles.dividerContainer, animatedDividerStyle]}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </Animated.View>
          
          <Animated.View style={animatedSubtitleStyle}>
            <Text style={styles.description}>
              Experience the finest flavors crafted with passion and served with excellence
            </Text>
          </Animated.View>

          <Animated.View style={[styles.buttonsContainer, animatedSubtitleStyle]}>
            <Animated.View style={[styles.buttonWrapper, animatedButtonStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleGuestPress}
                style={styles.guestButton}
              >
                <Feather name="users" size={18} color="#ff6b9d" style={styles.buttonIcon} />
                <Text style={styles.guestButtonText}>Continue as Guest</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.buttonWrapper, animatedButtonStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSignInPress}
                style={styles.signInButton}
              >
                <LinearGradient
                  colors={['#ff6b9d', '#ff8fb1', '#ffa0c0']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Feather name="log-in" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.signInButtonText}>Sign In to Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
          
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>Premium Quality • Exceptional Service</Text>
            <View style={styles.footerLine} />
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
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
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    width: '100%',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 20,
    position: 'relative',
  },
  logoRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: '#ffb6d1',
    opacity: 0.4,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#ffb6d1',
    opacity: 0.08,
  },
  welcomePrefix: {
    fontSize: 16,
    color: '#8a8a8e',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 44,
    fontWeight: '800',
    color: '#ff6b9d',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 107, 157, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  companySubtitle: {
    fontSize: 14,
    color: '#ff8fb1',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
    width: 120,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ffd1e4',
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff6b9d',
    marginHorizontal: 8,
  },
  description: {
    fontSize: 16,
    color: '#5a5a5e',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 40,
    fontWeight: '400',
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 20,
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  guestButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffd9e6',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: 'row',
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b9d',
  },
  signInButton: {
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonIcon: {
    marginRight: 10,
  },
  footer: {
    position: 'absolute',
    bottom: -height * 0.35,
    width: width - 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  footerLine: {
    width: 40,
    height: 1,
    backgroundColor: '#ffd1e4',
  },
  footerText: {
    fontSize: 10,
    color: '#c0a0b0',
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  premiumShape1: {
    position: 'absolute',
    top: '8%',
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ffb6d1',
    opacity: 0.12,
  },
  premiumShape2: {
    position: 'absolute',
    bottom: '15%',
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ff9ec0',
    opacity: 0.08,
  },
  premiumShape3: {
    position: 'absolute',
    top: '40%',
    right: '5%',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#ffd1e4',
    opacity: 0.1,
  },
  premiumShape4: {
    position: 'absolute',
    bottom: '30%',
    left: '5%',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffc0d9',
    opacity: 0.12,
  },
  premiumShape5: {
    position: 'absolute',
    top: '55%',
    left: '15%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffe0ed',
    opacity: 0.15,
  },
  orb1: {
    position: 'absolute',
    top: '20%',
    right: '12%',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ffb6d1',
    opacity: 0.06,
  },
  orb2: {
    position: 'absolute',
    bottom: '25%',
    left: '10%',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff9ec0',
    opacity: 0.06,
  },
  orb3: {
    position: 'absolute',
    top: '65%',
    right: '15%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffd1e4',
    opacity: 0.08,
  },
});

export default WelcomeScreen;