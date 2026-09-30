// src/screens/LoginScreen.js
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

// ── Safe haptic feedback ───────────────────────────────────
const safeHaptic = (style = 'light') => {
  try {
    if (Haptics && Haptics.impactAsync) {
      const impactStyle =
        style === 'light'
          ? Haptics.ImpactFeedbackStyle.Light
          : style === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
      Haptics.impactAsync(impactStyle).catch(() => {});
    }
  } catch (error) {
    console.log('Haptic feedback not available');
  }
};

// ── Password strength calculator ───────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '#e0e0e0', checks: {} };

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  let label = 'Very Weak';
  let color = '#ff4444';
  if (score >= 5) {
    label = 'Strong';
    color = '#00b894';
  } else if (score >= 4) {
    label = 'Good';
    color = '#6C63FF';
  } else if (score >= 3) {
    label = 'Fair';
    color = '#fdcb6e';
  } else if (score >= 2) {
    label = 'Weak';
    color = '#ff7675';
  }

  return { score, label, color, checks };
};

// ── Animated error banner ──────────────────────────────────
const ErrorBanner = ({ message, type = 'error', onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [message]);

  if (!message) return null;

  const config = {
    error: { bg: '#fff0f0', border: '#ff4444', icon: 'alert-circle', color: '#ff4444' },
    success: { bg: '#f0fff4', border: '#00b894', icon: 'check-circle', color: '#00b894' },
    warning: { bg: '#fffbf0', border: '#fdcb6e', icon: 'alert-triangle', color: '#e17055' },
    info: { bg: '#f0f4ff', border: '#6C63FF', icon: 'info', color: '#6C63FF' },
  }[type] || config?.error;

  const c = {
    error: { bg: '#fff0f0', border: '#ff4444', icon: 'alert-circle', color: '#ff4444' },
    success: { bg: '#f0fff4', border: '#00b894', icon: 'check-circle', color: '#00b894' },
    warning: { bg: '#fffbf0', border: '#fdcb6e', icon: 'alert-triangle', color: '#e17055' },
    info: { bg: '#f0f4ff', border: '#6C63FF', icon: 'info', color: '#6C63FF' },
  }[type];

  return (
    <Animated.View
      style={[
        styles.errorBanner,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Feather name={c.icon} size={18} color={c.color} />
      <Text style={[styles.errorBannerText, { color: c.color }]} numberOfLines={3}>
        {message}
      </Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.errorBannerClose}>
          <Feather name="x" size={16} color={c.color} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ── Animated input field with inline error ─────────────────
const AnimatedInput = ({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  showToggle,
  onToggleSecure,
  error,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  keyboardType,
  autoCapitalize,
  maxLength,
  style,
  editable = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = error
    ? '#ff4444'
    : isFocused
    ? '#ff6b9d'
    : '#f0f0f0';

  return (
    <Animated.View style={[{ transform: [{ translateX: shakeAnim }] }, style]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            borderWidth: isFocused || error ? 1.8 : 1.5,
            backgroundColor: error ? '#fff8f8' : isFocused ? '#fffafc' : '#f8f8f8',
          },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={error ? '#ff4444' : isFocused ? '#ff6b9d' : '#b0b0b0'}
          style={styles.inputIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#c0c0c0"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={editable}
        />
        {showToggle && (
          <TouchableOpacity onPress={onToggleSecure} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather
              name={secureTextEntry ? 'eye-off' : 'eye'}
              size={18}
              color={error ? '#ff4444' : '#ff6b9d'}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <View style={styles.inlineError}>
          <Feather name="alert-circle" size={12} color="#ff4444" />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
};

// ── Password strength meter ────────────────────────────────
const PasswordStrengthMeter = ({ password }) => {
  const { score, label, color, checks } = getPasswordStrength(password);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: (score / 5) * 100,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [score]);

  if (!password) return null;

  return (
    <View style={styles.strengthContainer}>
      <View style={styles.strengthBarRow}>
        <View style={styles.strengthBarBg}>
          <Animated.View
            style={[
              styles.strengthBarFill,
              {
                width: widthAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: color,
              },
            ]}
          />
        </View>
        <Text style={[styles.strengthLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.strengthChecks}>
        {[
          { key: 'length', text: '8+ chars' },
          { key: 'uppercase', text: 'A-Z' },
          { key: 'lowercase', text: 'a-z' },
          { key: 'number', text: '0-9' },
          { key: 'special', text: '!@#' },
        ].map((item) => (
          <View key={item.key} style={styles.strengthCheckItem}>
            <Feather
              name={checks[item.key] ? 'check-circle' : 'circle'}
              size={10}
              color={checks[item.key] ? '#00b894' : '#d0d0d0'}
            />
            <Text
              style={[
                styles.strengthCheckText,
                checks[item.key] && { color: '#00b894' },
              ]}
            >
              {item.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Animated modal wrapper ─────────────────────────────────
const AnimatedModalContent = ({ visible, children, style }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const LoginScreen = ({ navigation }) => {
  const {
    login,
    register,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    setGuestMode,
  } = useAuth();

  const openMainApp = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });

  const openAttendanceTracking = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: 'AttendanceTracking' }],
    });

  const canOpenAttendance = (result) => {
    const role = String(result?.role || result?.user?.role || '').toLowerCase();
    return (
      !!result?.user?.canAccessAttendance ||
      ['admin', 'super-admin', 'administrator'].includes(role)
    );
  };

  // ── Login state ──────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── Field errors ─────────────────────────────────────────
  const [loginErrors, setLoginErrors] = useState({});
  const [loginBanner, setLoginBanner] = useState({ message: '', type: 'error' });

  // ── Register state ───────────────────────────────────────
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerErrors, setRegisterErrors] = useState({});
  const [registerBanner, setRegisterBanner] = useState({ message: '', type: 'error' });

  // ── Admin modal ──────────────────────────────────────────
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminGreeting, setAdminGreeting] = useState('');

  // ── Forgot password flow ─────────────────────────────────
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotUserId, setForgotUserId] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotErrors, setForgotErrors] = useState({});
  const [forgotBanner, setForgotBanner] = useState({ message: '', type: 'error' });

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  // ── Card entrance animation ──────────────────────────────
  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const clearLoginError = useCallback((field) => {
    setLoginErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════
  const handleGuestMode = async () => {
    try {
      safeHaptic('light');
      await setGuestMode();
      openMainApp();
    } catch (error) {
      setLoginBanner({
        message: 'Could not enter guest mode. Please try again.',
        type: 'error',
      });
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setLoginBanner({ message: '', type: 'error' });

    const errors = {};
    if (!email.trim()) errors.email = 'Please enter your email or username';
    if (!password) errors.password = 'Please enter your password';

    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors);
      safeHaptic('medium');
      return;
    }

    setLoginErrors({});
    safeHaptic('light');
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        const greeting = `Hello, ${result.user?.full_name || email}!`;
        setAdminGreeting(greeting);

        if (canOpenAttendance(result)) {
          setAdminModalVisible(true);
          safeHaptic('medium');
        } else {
          setLoginBanner({ message: `Welcome back! ${greeting}`, type: 'success' });
          setTimeout(() => openMainApp(), 800);
        }
      } else {
        // ── Detect which field is wrong based on error_code ──
        const msg = result.message || 'Invalid credentials';
        const lower = msg.toLowerCase();

        if (
          lower.includes('password') ||
          result.error_code === 'INVALID_PASSWORD'
        ) {
          setLoginErrors({ password: 'Incorrect password. Please try again.' });
        } else if (
          lower.includes('email') ||
          lower.includes('username') ||
          result.error_code === 'INVALID_EMAIL'
        ) {
          setLoginErrors({ email: 'Incorrect email or username.' });
        } else if (result.error_code === 'ACCOUNT_LOCKED') {
          setLoginBanner({ message: msg, type: 'warning' });
        } else if (result.error_code === 'ACCOUNT_BANNED') {
          setLoginBanner({ message: msg, type: 'error' });
        } else if (result.error_code === 'ACCOUNT_INACTIVE') {
          setLoginBanner({ message: msg, type: 'warning' });
        } else if (result.error_code === 'ROLE_MISMATCH') {
          setLoginBanner({ message: msg, type: 'error' });
        } else {
          setLoginBanner({ message: msg, type: 'error' });
        }
        safeHaptic('medium');
      }
    } catch (error) {
      setLoginBanner({
        message: 'Network error. Please check your internet connection.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    setRegisterBanner({ message: '', type: 'error' });

    const errors = {};

    if (!regFirstName.trim()) errors.firstName = 'First name is required';
    if (!regLastName.trim()) errors.lastName = 'Last name is required';
    if (!regUsername.trim()) {
      errors.username = 'Username is required';
    } else if (regUsername.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(regUsername.trim())) {
      errors.username = 'Only letters, numbers, and underscores allowed';
    }

    if (!regEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!regPassword) {
      errors.password = 'Password is required';
    } else if (regPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(regPassword)) {
      errors.password = 'Must include at least one uppercase letter';
    } else if (!/[a-z]/.test(regPassword)) {
      errors.password = 'Must include at least one lowercase letter';
    } else if (!/[0-9]/.test(regPassword)) {
      errors.password = 'Must include at least one number';
    } else if (!/[^A-Za-z0-9]/.test(regPassword)) {
      errors.password = 'Must include at least one special character';
    }

    if (!regConfirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (regPassword !== regConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!agreeTerms) errors.terms = 'Please agree to the Terms & Conditions';

    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors);
      safeHaptic('medium');
      return;
    }

    setRegisterErrors({});
    safeHaptic('light');
    setIsRegistering(true);

    try {
      const result = await register({
        first_name: regFirstName.trim(),
        last_name: regLastName.trim(),
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        password_confirmation: regConfirmPassword,
        phone_number: regPhone || null,
      });

      if (result.success) {
        setRegisterBanner({
          message: `Welcome to Dear Bab's Catering, ${regFirstName.trim()}!`,
          type: 'success',
        });
        safeHaptic('medium');
        setTimeout(() => {
          setRegisterModalVisible(false);
          openMainApp();
        }, 1200);
      } else {
        // ── Map server errors to specific fields ──
        const msg = result.message || 'Could not create account';
        const lower = msg.toLowerCase();

        if (lower.includes('email') && lower.includes('taken')) {
          setRegisterErrors({ email: 'This email is already registered.' });
        } else if (lower.includes('username') && lower.includes('taken')) {
          setRegisterErrors({ username: 'This username is already taken.' });
        } else if (lower.includes('password')) {
          setRegisterErrors({ password: msg });
        } else {
          setRegisterBanner({ message: msg, type: 'error' });
        }
        safeHaptic('medium');
      }
    } catch (error) {
      setRegisterBanner({
        message: 'Network error. Please check your internet connection.',
        type: 'error',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FORGOT PASSWORD FLOW
  // ═══════════════════════════════════════════════════════════
  const resetForgotFlow = () => {
    setForgotStep(1);
    setForgotUserId('');
    setForgotEmail('');
    setForgotOtp('');
    setForgotResetToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
    setIsForgotLoading(false);
    setForgotErrors({});
    setForgotBanner({ message: '', type: 'error' });
  };

  const closeForgotModal = () => {
    setForgotModalVisible(false);
    setTimeout(resetForgotFlow, 250);
  };

  const handleForgotSendOtp = async () => {
    Keyboard.dismiss();
    setForgotBanner({ message: '', type: 'error' });

    const errors = {};
    if (!forgotUserId.trim()) errors.userId = 'Username or email is required';
    if (!forgotEmail.trim()) {
      errors.email = 'Registered email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setForgotErrors(errors);
      safeHaptic('medium');
      return;
    }

    setForgotErrors({});
    safeHaptic('light');
    setIsForgotLoading(true);

    try {
      const result = await forgotPassword(forgotUserId.trim(), forgotEmail.trim());
      if (result.success) {
        safeHaptic('medium');
        setForgotStep(2);
        setForgotBanner({
          message: `OTP sent to ${forgotEmail.trim()}. Expires in 10 minutes.`,
          type: 'success',
        });
      } else {
        const msg = result.message || 'Please try again.';
        const lower = msg.toLowerCase();
        if (lower.includes('email') && lower.includes('match')) {
          setForgotErrors({ email: 'Email does not match our records.' });
        } else if (lower.includes('not found')) {
          setForgotErrors({ userId: 'No account found with this username/email.' });
        } else {
          setForgotBanner({ message: msg, type: 'error' });
        }
        safeHaptic('medium');
      }
    } catch (e) {
      setForgotBanner({
        message: 'Network error. Please check your internet connection.',
        type: 'error',
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotResendOtp = async () => {
    safeHaptic('light');
    setIsForgotLoading(true);
    setForgotBanner({ message: '', type: 'error' });
    try {
      const result = await forgotPassword(forgotUserId.trim(), forgotEmail.trim());
      if (result.success) {
        setForgotBanner({
          message: `New OTP sent to ${forgotEmail.trim()}.`,
          type: 'success',
        });
      } else {
        setForgotBanner({
          message: result.message || 'Please try again.',
          type: 'error',
        });
      }
    } catch (e) {
      setForgotBanner({
        message: 'Network error. Please check your internet connection.',
        type: 'error',
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotVerifyOtp = async () => {
    Keyboard.dismiss();
    setForgotBanner({ message: '', type: 'error' });

    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotErrors({ otp: 'Please enter the 6-digit OTP' });
      safeHaptic('medium');
      return;
    }

    setForgotErrors({});
    safeHaptic('light');
    setIsForgotLoading(true);

    try {
      const result = await verifyResetOtp(forgotUserId.trim(), forgotOtp.trim());
      if (result.success) {
        safeHaptic('medium');
        const token = result.data?.reset_token || '';
        if (!token) {
          setForgotBanner({
            message: 'No reset token received. Please start over.',
            type: 'error',
          });
          return;
        }
        setForgotResetToken(token);
        setForgotStep(3);
        setForgotBanner({
          message: 'OTP verified. You can now set a new password.',
          type: 'success',
        });
      } else {
        const msg = result.message || 'Invalid OTP';
        setForgotErrors({ otp: msg });
        safeHaptic('medium');
      }
    } catch (e) {
      setForgotBanner({
        message: 'Network error. Please check your internet connection.',
        type: 'error',
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleForgotResetPassword = async () => {
    Keyboard.dismiss();
    setForgotBanner({ message: '', type: 'error' });

    const errors = {};
    if (!forgotNewPassword) {
      errors.newPassword = 'New password is required';
    } else if (forgotNewPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(forgotNewPassword)) {
      errors.newPassword = 'Must include at least one uppercase letter';
    } else if (!/[a-z]/.test(forgotNewPassword)) {
      errors.newPassword = 'Must include at least one lowercase letter';
    } else if (!/[0-9]/.test(forgotNewPassword)) {
      errors.newPassword = 'Must include at least one number';
    } else if (!/[^A-Za-z0-9]/.test(forgotNewPassword)) {
      errors.newPassword = 'Must include at least one special character';
    }

    if (!forgotConfirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (forgotNewPassword !== forgotConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setForgotErrors(errors);
      safeHaptic('medium');
      return;
    }

    setForgotErrors({});
    safeHaptic('light');
    setIsForgotLoading(true);

    try {
      const result = await resetPassword(
        forgotUserId.trim(),
        forgotResetToken,
        forgotNewPassword,
        forgotConfirmPassword
      );

      if (result.success) {
        safeHaptic('heavy');
        setForgotBanner({
          message: 'Password reset successfully! You can now log in.',
          type: 'success',
        });
        setTimeout(() => {
          closeForgotModal();
          setPassword('');
        }, 1500);
      } else {
        setForgotBanner({
          message: result.message || 'Please try again.',
          type: 'error',
        });
      }
    } catch (e) {
      setForgotBanner({
        message: 'Network error. Please check your internet connection.',
        type: 'error',
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: cardAnim,
                  transform: [
                    {
                      translateY: cardAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                    {
                      scale: cardAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.header}>
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.subtitleText}>Sign in to continue</Text>
              </View>

              {/* Global error banner */}
              <ErrorBanner
                message={loginBanner.message}
                type={loginBanner.type}
                onDismiss={() => setLoginBanner({ message: '', type: 'error' })}
              />

              <AnimatedInput
                label="Email / Username"
                icon="mail"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearLoginError('email');
                }}
                placeholder="Enter your email or username"
                error={loginErrors.email}
                inputRef={emailInputRef}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                autoCapitalize="none"
              />

              <AnimatedInput
                label="Password"
                icon="lock"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearLoginError('password');
                }}
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                showToggle
                onToggleSecure={() => setShowPassword(!showPassword)}
                error={loginErrors.password}
                inputRef={passwordInputRef}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={styles.forgotPasswordLink}
                onPress={() => {
                  safeHaptic('light');
                  resetForgotFlow();
                  setForgotModalVisible(true);
                }}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#ff6b9d', '#ff8fb1']}
                  style={styles.loginGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Sign In</Text>
                      <Feather name="arrow-right" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.guestButton}
                onPress={handleGuestMode}
                activeOpacity={0.8}
              >
                <Feather name="user" size={18} color="#ff6b9d" />
                <Text style={styles.guestButtonText}>Continue as Guest</Text>
              </TouchableOpacity>

              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => {
                  safeHaptic('light');
                  setRegisterModalVisible(true);
                }}>
                  <Text style={styles.registerLink}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </LinearGradient>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ADMIN NAVIGATION MODAL                             */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={adminModalVisible}
          onRequestClose={() => setAdminModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setAdminModalVisible(false)}>
            <View style={styles.adminModalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <AnimatedModalContent
                  visible={adminModalVisible}
                  style={styles.adminModalContainer}
                >
                  <LinearGradient
                    colors={['#ff6b9d', '#ff8fb1', '#ff9bb3']}
                    style={styles.adminModalHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.adminHeaderContent}>
                      <View style={styles.adminAvatarContainer}>
                        <LinearGradient
                          colors={['#ffffff', '#fff0f5']}
                          style={styles.adminAvatar}
                        >
                          <Feather name="user" size={28} color="#ff6b9d" />
                        </LinearGradient>
                      </View>
                      <Text style={styles.adminGreeting} numberOfLines={1}>
                        {adminGreeting}
                      </Text>
                      <View style={styles.adminBadge}>
                        <Feather name="shield" size={12} color="#ff6b9d" />
                        <Text style={styles.adminBadgeText}>Administrator</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <View style={styles.adminModalBody}>
                    <Text style={styles.adminModalTitle}>Choose Your Destination</Text>
                    <Text style={styles.adminModalSubtitle}>
                      Where would you like to go today?
                    </Text>

                    <View style={styles.adminOptionsContainer}>
                      <TouchableOpacity
                        style={styles.adminOptionCard}
                        onPress={() => {
                          safeHaptic('light');
                          setAdminModalVisible(false);
                          openMainApp();
                        }}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#ff6b9d', '#ff8fb1']}
                          style={styles.adminOptionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.adminOptionContent}>
                            <View style={styles.adminOptionIconContainer}>
                              <Feather name="users" size={22} color="#fff" />
                            </View>
                            <View style={styles.adminOptionTextContainer}>
                              <Text style={styles.adminOptionTitle}>Customer Page</Text>
                              <Text style={styles.adminOptionDescription}>
                                Browse products, place orders, and manage your cart
                              </Text>
                            </View>
                            <View style={styles.adminOptionArrow}>
                              <Feather name="chevron-right" size={18} color="#fff" />
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.adminOptionCard}
                        onPress={() => {
                          safeHaptic('light');
                          setAdminModalVisible(false);
                          openAttendanceTracking();
                        }}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['#6C63FF', '#8B83FF']}
                          style={styles.adminOptionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.adminOptionContent}>
                            <View style={styles.adminOptionIconContainer}>
                              <Feather name="clock" size={22} color="#fff" />
                            </View>
                            <View style={styles.adminOptionTextContainer}>
                              <Text style={styles.adminOptionTitle}>
                                Attendance Tracking
                              </Text>
                              <Text style={styles.adminOptionDescription}>
                                Monitor attendance, manage timesheets, and track employee hours
                              </Text>
                            </View>
                            <View style={styles.adminOptionArrow}>
                              <Feather name="chevron-right" size={18} color="#fff" />
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.adminCancelButton}
                      onPress={() => setAdminModalVisible(false)}
                    >
                      <Text style={styles.adminCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </AnimatedModalContent>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* ═══════════════════════════════════════════════════ */}
        {/* REGISTER MODAL                                     */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={registerModalVisible}
          onRequestClose={() => setRegisterModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalKeyboardView}
              >
                <View style={styles.modalContent}>
                  <LinearGradient
                    colors={['#ff6b9d', '#ff8fb1']}
                    style={styles.modalHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.modalHeaderTitle}>Create Account</Text>
                    <TouchableOpacity
                      onPress={() => setRegisterModalVisible(false)}
                      style={styles.modalCloseButton}
                    >
                      <Feather name="x" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </LinearGradient>

                  <ScrollView
                    contentContainerStyle={styles.modalBody}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Text style={styles.modalSubtitle}>Sign up to Get Started</Text>

                    {/* Global banner */}
                    <ErrorBanner
                      message={registerBanner.message}
                      type={registerBanner.type}
                      onDismiss={() => setRegisterBanner({ message: '', type: 'error' })}
                    />

                    <View style={styles.modalRow}>
                      <AnimatedInput
                        label="First Name"
                        value={regFirstName}
                        onChangeText={(t) => {
                          setRegFirstName(t);
                          setRegisterErrors((p) => ({ ...p, firstName: '' }));
                        }}
                        placeholder="First name"
                        error={registerErrors.firstName}
                        style={styles.modalInputHalf}
                      />
                      <AnimatedInput
                        label="Last Name"
                        value={regLastName}
                        onChangeText={(t) => {
                          setRegLastName(t);
                          setRegisterErrors((p) => ({ ...p, lastName: '' }));
                        }}
                        placeholder="Last name"
                        error={registerErrors.lastName}
                        style={styles.modalInputHalf}
                      />
                    </View>

                    <AnimatedInput
                      label="Username"
                      icon="at-sign"
                      value={regUsername}
                      onChangeText={(t) => {
                        setRegUsername(t);
                        setRegisterErrors((p) => ({ ...p, username: '' }));
                      }}
                      placeholder="Choose a username"
                      error={registerErrors.username}
                      autoCapitalize="none"
                    />

                    <AnimatedInput
                      label="Email Address"
                      icon="mail"
                      value={regEmail}
                      onChangeText={(t) => {
                        setRegEmail(t);
                        setRegisterErrors((p) => ({ ...p, email: '' }));
                      }}
                      placeholder="Enter email address"
                      error={registerErrors.email}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <AnimatedInput
                      label="Phone Number (Optional)"
                      icon="phone"
                      value={regPhone}
                      onChangeText={setRegPhone}
                      placeholder="Enter phone number"
                      keyboardType="phone-pad"
                    />

                    {/* Password - vertical stack */}
                    <AnimatedInput
                      label="Password"
                      icon="lock"
                      value={regPassword}
                      onChangeText={(t) => {
                        setRegPassword(t);
                        setRegisterErrors((p) => ({ ...p, password: '' }));
                      }}
                      placeholder="Create a strong password"
                      secureTextEntry={!showRegPassword}
                      showToggle
                      onToggleSecure={() => setShowRegPassword(!showRegPassword)}
                      error={registerErrors.password}
                    />

                    {/* Password strength meter */}
                    <PasswordStrengthMeter password={regPassword} />

                    <AnimatedInput
                      label="Confirm Password"
                      icon="lock"
                      value={regConfirmPassword}
                      onChangeText={(t) => {
                        setRegConfirmPassword(t);
                        setRegisterErrors((p) => ({ ...p, confirmPassword: '' }));
                      }}
                      placeholder="Re-enter your password"
                      secureTextEntry={!showRegConfirmPassword}
                      showToggle
                      onToggleSecure={() =>
                        setShowRegConfirmPassword(!showRegConfirmPassword)
                      }
                      error={registerErrors.confirmPassword}
                    />

                    <TouchableOpacity
                      style={styles.termsContainer}
                      onPress={() => {
                        safeHaptic('light');
                        setAgreeTerms(!agreeTerms);
                        setRegisterErrors((p) => ({ ...p, terms: '' }));
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.termsCheckbox,
                          agreeTerms && styles.termsCheckboxChecked,
                          registerErrors.terms && { borderColor: '#ff4444' },
                        ]}
                      >
                        {agreeTerms && <Feather name="check" size={10} color="#fff" />}
                      </View>
                      <Text style={styles.termsText}>
                        I agree to the{' '}
                        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                        <Text style={styles.termsLink}>Privacy Policy</Text>
                      </Text>
                    </TouchableOpacity>
                    {registerErrors.terms ? (
                      <View style={styles.inlineError}>
                        <Feather name="alert-circle" size={12} color="#ff4444" />
                        <Text style={styles.inlineErrorText}>
                          {registerErrors.terms}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={styles.modalRegisterButton}
                      onPress={handleRegister}
                      disabled={isRegistering}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#ff6b9d', '#ff8fb1']}
                        style={styles.modalRegisterGradient}
                      >
                        {isRegistering ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalRegisterText}>Create Account</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.modalFooter}>
                      <Text style={styles.modalFooterText}>Already have an account? </Text>
                      <TouchableOpacity
                        onPress={() => setRegisterModalVisible(false)}
                      >
                        <Text style={styles.modalFooterLink}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* ═══════════════════════════════════════════════════ */}
        {/* FORGOT PASSWORD MODAL                              */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={forgotModalVisible}
          onRequestClose={closeForgotModal}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalKeyboardView}
              >
                <View style={styles.modalContent}>
                  <LinearGradient
                    colors={['#ff6b9d', '#ff8fb1']}
                    style={styles.modalHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.modalHeaderTitle}>Reset Password</Text>
                    <TouchableOpacity
                      onPress={closeForgotModal}
                      style={styles.modalCloseButton}
                    >
                      <Feather name="x" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </LinearGradient>

                  <ScrollView
                    contentContainerStyle={styles.modalBody}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Step indicator */}
                    <View style={styles.stepIndicator}>
                      {[1, 2, 3].map((s) => (
                        <View key={s} style={styles.stepItem}>
                          <View
                            style={[
                              styles.stepCircle,
                              forgotStep >= s && styles.stepCircleActive,
                            ]}
                          >
                            {forgotStep > s ? (
                              <Feather name="check" size={12} color="#fff" />
                            ) : (
                              <Text
                                style={[
                                  styles.stepNumber,
                                  forgotStep >= s && styles.stepNumberActive,
                                ]}
                              >
                                {s}
                              </Text>
                            )}
                          </View>
                          {s < 3 && (
                            <View
                              style={[
                                styles.stepLine,
                                forgotStep > s && styles.stepLineActive,
                              ]}
                            />
                          )}
                        </View>
                      ))}
                    </View>

                    <ErrorBanner
                      message={forgotBanner.message}
                      type={forgotBanner.type}
                      onDismiss={() => setForgotBanner({ message: '', type: 'error' })}
                    />

                    {/* STEP 1 */}
                    {forgotStep === 1 && (
                      <>
                        <Text style={styles.modalSubtitle}>
                          Enter your username/email and the registered email address
                          to receive an OTP.
                        </Text>

                        <AnimatedInput
                          label="Username or Email"
                          icon="user"
                          value={forgotUserId}
                          onChangeText={(t) => {
                            setForgotUserId(t);
                            setForgotErrors((p) => ({ ...p, userId: '' }));
                          }}
                          placeholder="Enter username or email"
                          error={forgotErrors.userId}
                          autoCapitalize="none"
                        />

                        <AnimatedInput
                          label="Registered Email"
                          icon="mail"
                          value={forgotEmail}
                          onChangeText={(t) => {
                            setForgotEmail(t);
                            setForgotErrors((p) => ({ ...p, email: '' }));
                          }}
                          placeholder="Enter registered email"
                          error={forgotErrors.email}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />

                        <TouchableOpacity
                          style={styles.modalRegisterButton}
                          onPress={handleForgotSendOtp}
                          disabled={isForgotLoading}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={['#ff6b9d', '#ff8fb1']}
                            style={styles.modalRegisterGradient}
                          >
                            {isForgotLoading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={styles.modalRegisterText}>Send OTP</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}

                    {/* STEP 2 */}
                    {forgotStep === 2 && (
                      <>
                        <Text style={styles.modalSubtitle}>
                          Enter the 6-digit OTP sent to{' '}
                          <Text style={{ fontWeight: '700', color: '#ff6b9d' }}>
                            {forgotEmail}
                          </Text>
                          .
                        </Text>

                        <AnimatedInput
                          label="OTP Code"
                          icon="key"
                          value={forgotOtp}
                          onChangeText={(t) => {
                            setForgotOtp(t.replace(/[^0-9]/g, '').slice(0, 6));
                            setForgotErrors((p) => ({ ...p, otp: '' }));
                          }}
                          placeholder="000000"
                          error={forgotErrors.otp}
                          keyboardType="number-pad"
                          maxLength={6}
                          style={{ marginBottom: 4 }}
                        />

                        <TouchableOpacity
                          style={styles.modalRegisterButton}
                          onPress={handleForgotVerifyOtp}
                          disabled={isForgotLoading}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={['#ff6b9d', '#ff8fb1']}
                            style={styles.modalRegisterGradient}
                          >
                            {isForgotLoading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={styles.modalRegisterText}>Verify OTP</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.forgotActionsRow}>
                          <TouchableOpacity
                            onPress={handleForgotResendOtp}
                            disabled={isForgotLoading}
                          >
                            <Text style={styles.modalFooterLink}>Resend OTP</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setForgotStep(1)}
                            disabled={isForgotLoading}
                          >
                            <Text style={styles.modalFooterText}>Change Email</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {/* STEP 3 */}
                    {forgotStep === 3 && (
                      <>
                        <Text style={styles.modalSubtitle}>
                          Set a strong new password. Must include uppercase,
                          lowercase, number, and special character.
                        </Text>

                        <AnimatedInput
                          label="New Password"
                          icon="lock"
                          value={forgotNewPassword}
                          onChangeText={(t) => {
                            setForgotNewPassword(t);
                            setForgotErrors((p) => ({ ...p, newPassword: '' }));
                          }}
                          placeholder="Enter new password"
                          secureTextEntry={!showForgotNewPassword}
                          showToggle
                          onToggleSecure={() =>
                            setShowForgotNewPassword(!showForgotNewPassword)
                          }
                          error={forgotErrors.newPassword}
                        />

                        <PasswordStrengthMeter password={forgotNewPassword} />

                        <AnimatedInput
                          label="Confirm New Password"
                          icon="lock"
                          value={forgotConfirmPassword}
                          onChangeText={(t) => {
                            setForgotConfirmPassword(t);
                            setForgotErrors((p) => ({ ...p, confirmPassword: '' }));
                          }}
                          placeholder="Confirm new password"
                          secureTextEntry={!showForgotConfirmPassword}
                          showToggle
                          onToggleSecure={() =>
                            setShowForgotConfirmPassword(!showForgotConfirmPassword)
                          }
                          error={forgotErrors.confirmPassword}
                        />

                        <TouchableOpacity
                          style={styles.modalRegisterButton}
                          onPress={handleForgotResetPassword}
                          disabled={isForgotLoading}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={['#ff6b9d', '#ff8fb1']}
                            style={styles.modalRegisterGradient}
                          >
                            {isForgotLoading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={styles.modalRegisterText}>
                                Reset Password
                              </Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}

                    <View style={styles.modalFooter}>
                      <Text style={styles.modalFooterText}>Remember your password? </Text>
                      <TouchableOpacity onPress={closeForgotModal}>
                        <Text style={styles.modalFooterLink}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.12,
    shadowRadius: 25,
    elevation: 15,
  },
  header: { marginBottom: 20 },
  welcomeText: { fontSize: 32, fontWeight: '800', color: '#2d2d2d', marginBottom: 4 },
  subtitleText: { fontSize: 14, color: '#8a8a8e' },

  // ── Error banner ─────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  errorBannerClose: {
    padding: 2,
  },

  // ── Input ────────────────────────────────────────────────
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5a5a5e',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#2d2d2d' },

  // ── Inline error ─────────────────────────────────────────
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 5,
    paddingLeft: 4,
  },
  inlineErrorText: {
    fontSize: 11.5,
    color: '#ff4444',
    fontWeight: '500',
    flex: 1,
  },

  // ── Password strength ────────────────────────────────────
  strengthContainer: {
    marginTop: -6,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  strengthBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  strengthBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
  },
  strengthChecks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  strengthCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  strengthCheckText: {
    fontSize: 10,
    color: '#b0b0b0',
    fontWeight: '500',
  },

  // ── Forgot link ──────────────────────────────────────────
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 12,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    padding:10,
    fontSize: 13,
    color: '#ff6b9d',
    fontWeight: '600',
  },

  // ── Buttons ──────────────────────────────────────────────
  loginButton: {
    marginTop: 8,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  loginGradient: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginRight: 6,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#ffd9e6',
    marginTop: 12,
    gap: 8,
  },
  guestButtonText: { fontSize: 15, fontWeight: '600', color: '#ff6b9d' },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: { fontSize: 13, color: '#8a8a8e' },
  registerLink: { fontSize: 13, color: '#ff6b9d', fontWeight: '700' },

  // ── Admin Modal ──────────────────────────────────────────
  adminModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  adminModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    width: width - 32,
    maxWidth: 420,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  adminModalHeader: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  adminHeaderContent: { alignItems: 'center' },
  adminAvatarContainer: { marginBottom: 10 },
  adminAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  adminGreeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
    maxWidth: '100%',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  adminModalBody: { padding: 20, paddingTop: 16 },
  adminModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2d2d2d',
    textAlign: 'center',
    marginBottom: 2,
  },
  adminModalSubtitle: {
    fontSize: 12,
    color: '#8a8a8e',
    textAlign: 'center',
    marginBottom: 16,
  },
  adminOptionsContainer: { gap: 12 },
  adminOptionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  adminOptionGradient: { padding: 14 },
  adminOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminOptionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminOptionTextContainer: { flex: 1 },
  adminOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 1,
  },
  adminOptionDescription: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 13,
  },
  adminOptionArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  adminCancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminCancelText: { fontSize: 13, fontWeight: '600', color: '#8a8a8e' },

  // ── Modal ────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalKeyboardView: { width: '100%', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 32,
    width: width - 32,
    maxHeight: height * 0.88,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalCloseButton: { padding: 4 },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8a8a8e',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  modalInputGroup: { marginBottom: 10 },
  modalInputHalf: { flex: 1 },

  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    marginTop: 4,
  },
  termsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ff6b9d',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  termsCheckboxChecked: { backgroundColor: '#ff6b9d', borderColor: '#ff6b9d' },
  termsText: { flex: 1, fontSize: 11, color: '#6b6b6e', lineHeight: 14 },
  termsLink: { color: '#ff6b9d', fontWeight: '600' },
  modalRegisterButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
  },
  modalRegisterGradient: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRegisterText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooterText: { fontSize: 12, color: '#8a8a8e' },
  modalFooterLink: { fontSize: 12, color: '#ff6b9d', fontWeight: '700' },

  // ── Step indicator ───────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#f0e0e8',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: '#ff6b9d', borderColor: '#ff6b9d' },
  stepNumber: { fontSize: 12, fontWeight: '700', color: '#b0b0b0' },
  stepNumberActive: { color: '#fff' },
  stepLine: {
    width: 34,
    height: 2,
    backgroundColor: '#f0e0e8',
    marginHorizontal: 4,
  },
  stepLineActive: { backgroundColor: '#ff6b9d' },

  forgotActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
});

export default LoginScreen;