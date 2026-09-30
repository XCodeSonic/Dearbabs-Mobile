// src/navigation/AppNavigator.js
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef } from './navigationRef';
import { useCart } from '../contexts/CartContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';

// Import ALL screens - CHECK EACH ONE EXISTS
import BookingScreen from '../screens/BookingScreen';
import CalendarScreen from '../screens/CalendarScreen';
import CateringOrderScreen from '../screens/CateringOrderScreen';
import ChatScreen from '../screens/ChatScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import MenuScreen from '../screens/MenuScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import PaymentScreen from '../screens/PaymentScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QuotationScreen from '../screens/QuotationScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import AttendanceTrackingApp from '../Attendance-tracking/attendance';

// ✅ FIX: Safe Haptic Function
const safeHaptic = (style = 'light') => {
  try {
    const Haptics = require('expo-haptics');
    if (Haptics && Haptics.impactAsync) {
      let impactStyle;
      if (style === 'light') {
        impactStyle = Haptics.ImpactFeedbackStyle.Light;
      } else if (style === 'medium') {
        impactStyle = Haptics.ImpactFeedbackStyle.Medium;
      } else if (style === 'heavy') {
        impactStyle = Haptics.ImpactFeedbackStyle.Heavy;
      } else {
        impactStyle = Haptics.ImpactFeedbackStyle.Light;
      }
      Haptics.impactAsync(impactStyle).catch(() => {});
    }
  } catch (error) {
    // Silently fail - app works without haptics
  }
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window');

// ✅ Safe number formatter
const formatPrice = (value) => {
  const num = Number(value);
  if (isNaN(num) || num === 0) return '₱0.00';
  return `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ✅ Safe number getter
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// ============================================================
// DRAWER MENU ITEMS
// ============================================================
const menuItems = [
  { id: 'home', name: 'Home', icon: 'home', screen: 'HomeTab' },
  { id: 'menu', name: 'Menu', icon: 'grid', screen: 'MenuTab' },
  { id: 'booking', name: 'Book Event', icon: 'calendar-plus', screen: 'BookingTab' },
  { id: 'calendar', name: 'Calendar', icon: 'calendar', screen: 'CalendarScreen' },
  { id: 'catering', name: 'Catering', icon: 'truck', screen: 'CateringOrder' },
  { id: 'tracking', name: 'Track Order', icon: 'map-pin', screen: 'OrderTracking' },
  { id: 'quotation', name: 'Quotations', icon: 'file-text', screen: 'Quotation' },
  { id: 'chat', name: 'Support', icon: 'message-circle', screen: 'Chat' },
  { id: 'reviews', name: 'Reviews', icon: 'star', screen: 'Reviews' },
  { id: 'profile', name: 'Profile', icon: 'user', screen: 'ProfileTab' },
  { id: 'attendance', name: 'Attendance Tracking', icon: 'clock', screen: 'AttendanceTracking', requiresAttendanceAccess: true },
];

// ============================================================
// GLOBAL HEADER COMPONENT
// ============================================================
const GlobalHeader = ({ 
  onOpenDrawer, 
  onOpenCart, 
  onOpenNotifications, 
  cartCount, 
  unreadCount, 
  colors,
}) => {
  return (
    <View style={[styles.headerContainer, { 
      backgroundColor: colors.surface,
      borderBottomColor: colors.divider 
    }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onOpenDrawer} 
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            activeOpacity={0.7}
          >
            <Feather name="menu" size={22} color={colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <View style={[styles.logoWrapper, { backgroundColor: colors.primary + '15' }]}>
              <Image source={require('../images/index-logo.png')} style={styles.headerLogo} resizeMode="contain" />
            </View>
            <View>
              <Text style={[styles.companyName, { color: colors.text }]}>Dear Bab's</Text>
              <Text style={[styles.companyTagline, { color: colors.textSecondary }]}>Premium Catering Services</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.card }]} 
              onPress={onOpenNotifications}
              activeOpacity={0.7}
            >
              <Feather name="bell" size={20} color={colors.primary} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.card }]} 
              onPress={onOpenCart}
              activeOpacity={0.7}
            >
              <Feather name="shopping-cart" size={20} color={colors.primary} />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

// ============================================================
// WITH GLOBAL HEADER WRAPPER
// ============================================================
const WithGlobalHeader = ({ 
  children, 
  onOpenDrawer, 
  onOpenCart, 
  onOpenNotifications, 
  cartCount, 
  unreadCount, 
  colors,
}) => {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GlobalHeader 
        onOpenDrawer={onOpenDrawer}
        onOpenCart={onOpenCart}
        onOpenNotifications={onOpenNotifications}
        cartCount={cartCount}
        unreadCount={unreadCount}
        colors={colors}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {children}
      </View>
    </View>
  );
};

// ============================================================
// MAIN TABS NAVIGATOR
// ============================================================
const MainTabs = ({ navigation, onOpenDrawer, onOpenCart, onOpenNotifications }) => {
  const { getCartCount } = useCart();
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();
  const cartCount = getCartCount();

  const getTabIcon = (routeName, focused, color) => {
    const size = focused ? 24 : 22;
    const iconColor = focused ? colors.primary : color;
    
    switch (routeName) {
      case 'HomeTab':
        return <Feather name="home" size={size} color={iconColor} />;
      case 'MenuTab':
        return <Feather name="grid" size={size} color={iconColor} />;
      case 'BookingTab':
        return <MaterialCommunityIcons name="calendar-plus" size={size} color={iconColor} />;
      case 'CalendarTab':
        return <Feather name="calendar" size={size} color={iconColor} />;
      case 'OrdersTab':
        return <Feather name="clipboard" size={size} color={iconColor} />;
      case 'ProfileTab':
        return <Feather name="user" size={size} color={iconColor} />;
      default:
        return <Feather name="circle" size={size} color={iconColor} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color }) => getTabIcon(route.name, focused, color),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary || '#B0B0B0',
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 85 : 65,
            paddingBottom: Platform.OS === 'ios' ? 25 : 8,
            paddingTop: 8,
            elevation: 10,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          },
          tabBarLabelStyle: { 
            fontSize: 10, 
            fontWeight: '600', 
            marginTop: 4,
            letterSpacing: 0.3,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          headerShown: false,
          tabBarHideOnKeyboard: true,
        })}
        initialRouteName="HomeTab"
      >
        <Tab.Screen name="HomeTab" options={{ title: 'Home' }}>
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={onOpenDrawer}
              onOpenCart={onOpenCart}
              onOpenNotifications={onOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <HomeScreen {...props} />
            </WithGlobalHeader>
          )}
        </Tab.Screen>
        
        <Tab.Screen name="MenuTab" options={{ title: 'Menu' }}>
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={onOpenDrawer}
              onOpenCart={onOpenCart}
              onOpenNotifications={onOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <MenuScreen {...props} />
            </WithGlobalHeader>
          )}
        </Tab.Screen>
        
        <Tab.Screen name="BookingTab" options={{ title: 'Book Event' }}>
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={onOpenDrawer}
              onOpenCart={onOpenCart}
              onOpenNotifications={onOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <BookingScreen {...props} />
            </WithGlobalHeader>
          )}
        </Tab.Screen>
        
        <Tab.Screen name="CalendarTab" options={{ title: 'Calendar' }}>
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={onOpenDrawer}
              onOpenCart={onOpenCart}
              onOpenNotifications={onOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <CalendarScreen {...props} />
            </WithGlobalHeader>
          )}
        </Tab.Screen>
        
        <Tab.Screen name="OrdersTab" options={{ title: 'Orders' }}>
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={onOpenDrawer}
              onOpenCart={onOpenCart}
              onOpenNotifications={onOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <OrdersScreen {...props} />
            </WithGlobalHeader>
          )}
        </Tab.Screen>
        
        <Tab.Screen name="ProfileTab" options={{ title: 'Profile' }}>
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={onOpenDrawer}
              onOpenCart={onOpenCart}
              onOpenNotifications={onOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <ProfileScreen {...props} />
            </WithGlobalHeader>
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
};

// ============================================================
// GLOBAL DRAWER COMPONENT
// ============================================================
const GlobalDrawer = ({ isOpen, onClose, onNavigate, colors, user, logout, hasAttendanceAccess }) => {
  const drawerAnim = useRef(new Animated.Value(-width * 0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activeItem, setActiveItem] = useState('home');

  useEffect(() => {
    if (isOpen) {
      Animated.spring(drawerAnim, { 
        toValue: 0, 
        useNativeDriver: true, 
        tension: 65, 
        friction: 11 
      }).start();
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 300, 
        useNativeDriver: true 
      }).start();
    } else {
      Animated.spring(drawerAnim, { 
        toValue: -width * 0.85, 
        useNativeDriver: true, 
        tension: 65, 
        friction: 11 
      }).start();
      Animated.timing(fadeAnim, { 
        toValue: 0, 
        duration: 300, 
        useNativeDriver: true 
      }).start();
    }
  }, [isOpen]);

  const handleMenuItemPress = (item) => {
    safeHaptic('light');
    setActiveItem(item.id);
    onNavigate(item.screen);
    setTimeout(onClose, 300);
  };

  const handleLogout = () => {
    onClose();
    safeHaptic('medium');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' }
      ]
    );
  };

  const getDisplayName = () => {
    if (user?.full_name) return user.full_name;
    if (user?.name) return user.name;
    if (user?.username) return user.username;
    return 'Guest User';
  };

  const getDisplayEmail = () => {
    if (user?.email) return user.email;
    return 'guest@dearbabs.com';
  };

  const getUserRole = () => {
    const role = user?.role || user?.userRole;
    if (hasAttendanceAccess) return 'Attendance Manager';
    if (role === 'admin' || role === 'ADMIN') return 'Administrator';
    if (role === 'staff' || role === 'STAFF') return 'Staff';
    return 'Customer';
  };

  if (!isOpen) return null;

  return (
    <>
      <Animated.View style={[styles.drawerOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.drawerOverlayTouch} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.drawer, { 
        transform: [{ translateX: drawerAnim }], 
        backgroundColor: colors.surface 
      }]}>
        <LinearGradient 
          colors={['#FF6B9D', '#FF8FB1', '#FFA0C0']} 
          style={styles.drawerHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.drawerLogoContainer}>
            <View style={styles.drawerLogoCircle}>
              <Image source={require('../images/index-logo.png')} style={styles.drawerLogoImage} resizeMode="contain" />
            </View>
            <Text style={styles.drawerCompanyName}>Dear Bab's</Text>
            <Text style={styles.drawerTagline}>Premium Catering Services</Text>
          </View>
          {user && (
            <View style={styles.drawerUserInfo}>
              <Text style={styles.drawerUserName}>{getDisplayName()}</Text>
              <Text style={styles.drawerUserEmail}>{getDisplayEmail()}</Text>
              <View style={styles.drawerRoleBadge}>
                <Text style={styles.drawerRoleText}>{getUserRole()}</Text>
              </View>
            </View>
          )}
        </LinearGradient>
        
        <ScrollView 
          style={styles.drawerMenuContainer} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.drawerMenuContent}
        >
          {menuItems.filter((item) => !item.requiresAttendanceAccess || hasAttendanceAccess).map((item) => {
            const isActive = activeItem === item.id;
            return (
              <TouchableOpacity 
                key={item.id} 
                style={[
                  styles.drawerMenuItem,
                  isActive && styles.drawerMenuItemActive,
                  isActive && { backgroundColor: colors.primary + '10' }
                ]} 
                onPress={() => handleMenuItemPress(item)} 
                activeOpacity={0.7}
              >
                <View style={[
                  styles.drawerIconContainer, 
                  isActive && styles.drawerIconContainerActive,
                  { backgroundColor: isActive ? colors.primary : colors.primary + '10' }
                ]}>
                  <Feather 
                    name={item.icon} 
                    size={20} 
                    color={isActive ? '#FFF' : colors.primary} 
                  />
                </View>
                <Text style={[
                  styles.drawerMenuItemText, 
                  { color: isActive ? colors.primary : colors.text },
                  isActive && styles.drawerMenuItemTextActive
                ]}>
                  {item.name}
                </Text>
                {isActive && (
                  <View style={styles.drawerActiveIndicator} />
                )}
                <Feather 
                  name="chevron-right" 
                  size={16} 
                  color={isActive ? colors.primary : colors.textSecondary} 
                />
              </TouchableOpacity>
            );
          })}
          
          <View style={[styles.drawerDivider, { backgroundColor: colors.divider }]} />
          
          <TouchableOpacity 
            style={[styles.drawerMenuItem, styles.drawerLogoutItem]} 
            onPress={handleLogout} 
            activeOpacity={0.7}
          >
            <View style={[styles.drawerIconContainer, { backgroundColor: '#FF444415' }]}>
              <Feather name="log-out" size={20} color="#FF4444" />
            </View>
            <Text style={[styles.drawerMenuItemText, { color: '#FF4444' }]}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
        
        <View style={[styles.drawerFooter, { borderTopColor: colors.divider }]}>
          <Text style={styles.drawerVersion}>Version 3.0.0</Text>
          <Text style={styles.drawerCopyright}>© 2024 Dear Bab's</Text>
        </View>
      </Animated.View>
    </>
  );
};

// ============================================================
// GLOBAL CART MODAL
// ============================================================
const GlobalCartModal = ({ 
  isVisible, 
  onClose, 
  cartItems, 
  cartTotal, 
  cartCount, 
  colors, 
  onProceed,
  isGuest,
  onLoginPress,
  updateQuantity,
  removeItem,
  getItemQuantity
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const handleUpdateQuantity = (itemId, delta) => {
    const currentQty = getItemQuantity(itemId);
    const newQty = safeNumber(currentQty) + delta;
    
    if (newQty < 1) {
      Alert.alert(
        'Remove Item',
        'Do you want to remove this item from your cart?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeItem(itemId) }
        ]
      );
      return;
    }
    
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    updateQuantity(itemId, delta);
  };

  const handleRemoveItem = (itemId, itemName) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${itemName}" from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(itemId) }
      ]
    );
  };

  const CartItem = ({ item }) => {
    const quantity = getItemQuantity(item.id) || safeNumber(item.quantity, 0);
    const price = safeNumber(item.price);
    const itemTotal = price * quantity;

    return (
      <View style={[styles.cartItem, { borderBottomColor: colors.divider }]}>
        <Image source={{ uri: item.image || 'https://via.placeholder.com/56x56/FF6B9D/FFFFFF?text=Food' }} style={styles.cartItemImage} />
        <View style={styles.cartItemInfo}>
          <Text style={[styles.cartItemName, { color: colors.text }]} numberOfLines={1}>{item.name || 'Item'}</Text>
          <Text style={styles.cartItemPrice}>{formatPrice(price)}</Text>
        </View>
        <View style={styles.cartItemControls}>
          <View style={styles.quantityControl}>
            <TouchableOpacity 
              style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
              onPress={() => handleUpdateQuantity(item.id, -1)}
              disabled={quantity <= 1}
              activeOpacity={0.7}
            >
              <Feather name="minus" size={14} color={quantity <= 1 ? '#C6C6C8' : '#FF6B9D'} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity 
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, 1)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color="#FF6B9D" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.id, item.name)}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={14} color="#FF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const displayCartItems = isGuest ? [] : cartItems;
  const displayCartCount = isGuest ? 0 : cartCount;
  const displayCartTotal = isGuest ? 0 : cartTotal;

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View 
          style={[
            styles.modalContent, 
            { 
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient 
            colors={['#FF6B9D', '#FF8FB1']} 
            style={styles.modalHeaderGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.modalHeaderTitle}>
              {isGuest ? 'Guest Cart' : 'Your Cart'} ({displayCartCount})
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton} activeOpacity={0.7}>
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>
          
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {displayCartItems.length === 0 ? (
              <View style={styles.emptyCart}>
                <View style={[styles.emptyCartIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name="shopping-cart" size={50} color={colors.primary} />
                </View>
                <Text style={[styles.emptyCartTitle, { color: colors.text }]}>
                  {isGuest ? 'Guest cart is empty' : 'Your cart is empty'}
                </Text>
                <Text style={[styles.emptyCartText, { color: colors.textSecondary }]}>
                  {isGuest ? 'Login to add items to your cart' : 'Add items to get started'}
                </Text>
                {isGuest && (
                  <TouchableOpacity 
                    style={styles.guestLoginButton}
                    onPress={onLoginPress}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#FF6B9D', '#FF8FB1']}
                      style={styles.guestLoginGradient}
                    >
                      <Text style={styles.guestLoginText}>Sign In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              displayCartItems.map((item) => (
                <CartItem key={item.id} item={item} />
              ))
            )}
          </ScrollView>
          
          {displayCartItems.length > 0 && (
            <View style={[styles.modalFooter, { borderTopColor: colors.divider }]}>
              <View style={styles.modalTotal}>
                <View>
                  <Text style={[styles.modalTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={styles.modalTotalSubtext}>Including all fees</Text>
                </View>
                <Text style={styles.modalTotalAmount}>{formatPrice(displayCartTotal)}</Text>
              </View>
              {!isGuest ? (
                <TouchableOpacity 
                  style={styles.proceedButton} 
                  onPress={onProceed}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={['#FF6B9D', '#FF8FB1']} 
                    style={styles.proceedGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.proceedButtonText}>Proceed to Catering</Text>
                    <Feather name="arrow-right" size={16} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.proceedButton} 
                  onPress={onLoginPress}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={['#FF6B9D', '#FF8FB1']} 
                    style={styles.proceedGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.proceedButtonText}>Login to Checkout</Text>
                    <Feather name="log-in" size={16} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============================================================
// GLOBAL NOTIFICATIONS MODAL
// ============================================================
const GlobalNotificationsModal = ({ isVisible, onClose, notifications, colors, onMarkRead, onMarkAllRead }) => {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Modal animationType="none" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View 
          style={[
            styles.modalContent, 
            { 
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient 
            colors={['#FF6B9D', '#FF8FB1']} 
            style={styles.modalHeaderGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.modalHeaderTitle}>Notifications</Text>
            <View style={styles.modalHeaderActions}>
              {notifications.filter(n => !n.read).length > 0 && (
                <TouchableOpacity onPress={onMarkAllRead} style={styles.markAllButton}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.modalCloseButton} activeOpacity={0.7}>
                <Feather name="x" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {notifications?.length === 0 ? (
              <View style={styles.emptyCart}>
                <View style={[styles.emptyCartIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name="bell-off" size={50} color={colors.primary} />
                </View>
                <Text style={[styles.emptyCartTitle, { color: colors.text }]}>No notifications</Text>
                <Text style={[styles.emptyCartText, { color: colors.textSecondary }]}>You're all caught up!</Text>
              </View>
            ) : (
              notifications?.map((notif, index) => (
                <TouchableOpacity 
                  key={notif.id || index} 
                  style={[styles.notificationItem, { borderBottomColor: colors.divider }]}
                  onPress={() => {
                    if (!notif.read) onMarkRead(notif.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.notificationIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Feather name="bell" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>{notif.title}</Text>
                    <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                      {notif.message}
                    </Text>
                    <Text style={styles.notificationTime}>{formatTime(notif.created_at)}</Text>
                  </View>
                  {!notif.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============================================================
// ACCESS DENIED SCREEN
// ============================================================
const AccessDeniedScreen = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.accessDeniedContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.accessDeniedCard, { backgroundColor: colors.surface }]}>
        <View style={styles.accessDeniedIcon}>
          <Feather name="lock" size={38} color="#FF4444" />
        </View>
        <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>Attendance Access Only</Text>
        <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
Login using an admin account to open the Attendance Tracking module.
        </Text>
        <TouchableOpacity
          style={styles.accessDeniedButton}
          onPress={() => navigation.replace('Main')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#FF6B9D', '#FF8FB1']} style={styles.accessDeniedButtonGradient}>
            <Feather name="arrow-left" size={16} color="#FFF" />
            <Text style={styles.accessDeniedButtonText}>Back to Mobile App</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============================================================
// MAIN APP NAVIGATOR
// ============================================================
const AppNavigator = () => {
  const { isLoading, user, logout, isGuest, isAuthenticated, hasAttendanceAccess } = useAuth();
  const { 
    cartItems, 
    getCartCount, 
    getTotalAmount,
    updateQuantity,
    removeItem,
    getItemQuantity
  } = useCart();
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
  const { colors } = useTheme();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  
  const cartCount = getCartCount();
  const totalCartAmount = getTotalAmount();

  const handleOpenDrawer = () => {
    safeHaptic('light');
    setIsDrawerOpen(true);
  };
  const handleCloseDrawer = () => setIsDrawerOpen(false);
  
  const handleOpenCart = () => {
    safeHaptic('light');
    setIsCartModalOpen(true);
  };
  const handleCloseCart = () => setIsCartModalOpen(false);
  
  const handleOpenNotifications = () => {
    safeHaptic('light');
    setIsNotificationsModalOpen(true);
  };
  const handleCloseNotifications = () => setIsNotificationsModalOpen(false);

  const handleLoginPress = () => {
    handleCloseCart();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Login');
    }
  };

  const handleProceedToBook = () => {
    if (isGuest || !isAuthenticated) {
      Alert.alert(
        'Login Required',
        'Please login to proceed with booking.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => {
              handleCloseCart();
              if (navigationRef.isReady()) {
                navigationRef.navigate('Login');
              }
            }
          }
        ]
      );
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to your cart before booking');
      return;
    }
    
    setIsCartModalOpen(false);
    if (navigationRef.isReady()) {
      navigationRef.navigate('CateringOrder');
    }
  };

  const handleBackToMainApp = () => {
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  };

  const handleNavigate = (screenName) => {
    if (screenName === 'AttendanceTracking' && !hasAttendanceAccess) {
      Alert.alert('Access Denied', 'Only an admin account can open Attendance Tracking.');
      return;
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate(screenName);
    }
  };

  const handleAppLogout = async () => {
    handleCloseDrawer();
    await logout();
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  if (isLoading) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          cardStyle: { backgroundColor: colors.background }
        }} 
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        
        <Stack.Screen name="Main">
          {(props) => (
            <MainTabs 
              {...props}
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
            />
          )}
        </Stack.Screen>
        
        <Stack.Screen name="CateringOrder">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <CateringOrderScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
        
        <Stack.Screen name="Payment">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <PaymentScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
        
        <Stack.Screen name="OrderTracking">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <OrderTrackingScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
        
        <Stack.Screen name="Quotation">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <QuotationScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
        
        <Stack.Screen name="Chat">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <ChatScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
        
        <Stack.Screen name="Reviews">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <ReviewsScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
        
        <Stack.Screen name="AttendanceTracking">
          {(props) => hasAttendanceAccess ? (
            <AttendanceTrackingApp
              {...props}
              onAppLogout={handleAppLogout}
              onBackToMainApp={handleBackToMainApp}
            />
          ) : (
            <AccessDeniedScreen navigation={props.navigation} />
          )}
        </Stack.Screen>

        <Stack.Screen name="CalendarScreen">
          {(props) => (
            <WithGlobalHeader 
              onOpenDrawer={handleOpenDrawer}
              onOpenCart={handleOpenCart}
              onOpenNotifications={handleOpenNotifications}
              cartCount={cartCount}
              unreadCount={unreadCount}
              colors={colors}
            >
              <CalendarScreen {...props} />
            </WithGlobalHeader>
          )}
        </Stack.Screen>
      </Stack.Navigator>
      
      <GlobalDrawer 
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onNavigate={handleNavigate}
        colors={colors}
        user={user}
        logout={handleAppLogout}
        hasAttendanceAccess={hasAttendanceAccess}
      />
      
      <GlobalCartModal 
        isVisible={isCartModalOpen}
        onClose={handleCloseCart}
        cartItems={cartItems}
        cartTotal={totalCartAmount}
        cartCount={cartCount}
        colors={colors}
        onProceed={handleProceedToBook}
        isGuest={isGuest}
        onLoginPress={handleLoginPress}
        updateQuantity={updateQuantity}
        removeItem={removeItem}
        getItemQuantity={getItemQuantity}
      />
      
      <GlobalNotificationsModal 
        isVisible={isNotificationsModalOpen}
        onClose={handleCloseNotifications}
        notifications={notifications}
        colors={colors}
        onMarkRead={markAsRead}
        onMarkAllRead={markAllAsRead}
      />
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accessDeniedCard: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
  accessDeniedIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FF444415',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  accessDeniedTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  accessDeniedButton: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
  },
  accessDeniedButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  accessDeniedButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  headerContainer: {
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButton: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    flex: 1, 
    justifyContent: 'center' 
  },
  logoWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: { width: 34, height: 34, borderRadius: 17 },
  companyName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  companyTagline: { fontSize: 8, marginTop: 1, opacity: 0.7 },
  headerActions: { flexDirection: 'row', gap: 10 },
  
  cartBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#FF6B9D', 
    borderRadius: 10, 
    minWidth: 20, 
    height: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#FF4444', 
    borderRadius: 10, 
    minWidth: 20, 
    height: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  
  drawerOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 998 
  },
  drawerOverlayTouch: { flex: 1 },
  drawer: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    bottom: 0, 
    width: width * 0.85, 
    zIndex: 999, 
    shadowColor: '#000', 
    shadowOffset: { width: 4, height: 0 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 20, 
    elevation: 15,
  },
  drawerHeader: { 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 24, 
    alignItems: 'center', 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24,
  },
  drawerLogoContainer: { alignItems: 'center' },
  drawerLogoCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  drawerLogoImage: { width: 56, height: 56, borderRadius: 28 },
  drawerCompanyName: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  drawerTagline: { fontSize: 11, color: '#FFF', opacity: 0.9 },
  drawerUserInfo: { 
    alignItems: 'center', 
    marginTop: 14, 
    paddingTop: 14, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.2)', 
    width: '100%' 
  },
  drawerUserName: { fontSize: 15, fontWeight: '600', color: '#FFF', textAlign: 'center' },
  drawerUserEmail: { fontSize: 11, color: '#FFF', opacity: 0.8, marginTop: 2, textAlign: 'center' },
  drawerRoleBadge: { 
    backgroundColor: 'rgba(255,255,255,0.25)', 
    paddingHorizontal: 14, 
    paddingVertical: 4, 
    borderRadius: 14, 
    marginTop: 6 
  },
  drawerRoleText: { fontSize: 10, color: '#FFF', fontWeight: '600', letterSpacing: 0.5 },
  drawerMenuContainer: { flex: 1 },
  drawerMenuContent: { paddingVertical: 8 },
  drawerMenuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 13, 
    paddingHorizontal: 20, 
    gap: 14,
    marginHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  drawerMenuItemActive: {
    backgroundColor: '#FFF0F5',
  },
  drawerIconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  drawerIconContainerActive: {
    backgroundColor: '#FF6B9D',
  },
  drawerMenuItemText: { 
    fontSize: 14, 
    fontWeight: '500', 
    flex: 1 
  },
  drawerMenuItemTextActive: {
    fontWeight: '600',
  },
  drawerActiveIndicator: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    backgroundColor: '#FF6B9D',
    marginRight: 4,
  },
  drawerLogoutItem: {
    marginTop: 4,
  },
  drawerDivider: { 
    height: 1, 
    marginVertical: 8, 
    marginHorizontal: 20 
  },
  drawerFooter: { 
    padding: 16, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 16, 
    borderTopWidth: 1, 
    alignItems: 'center' 
  },
  drawerVersion: { fontSize: 10, color: '#B0B0B0' },
  drawerCopyright: { fontSize: 9, color: '#C0C0C0', marginTop: 2 },
  
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end' 
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: { 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    maxHeight: height * 0.85, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeaderGradient: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
  },
  modalHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  modalCloseButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
  },
  markAllText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  modalBody: { padding: 16, maxHeight: 450 },
  emptyCart: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyCartIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyCartTitle: { fontSize: 16, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  emptyCartText: { fontSize: 13, textAlign: 'center' },
  guestLoginButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 16,
    width: '80%',
  },
  guestLoginGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestLoginText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cartItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    paddingBottom: 12, 
    borderBottomWidth: 1 
  },
  cartItemImage: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cartItemPrice: { fontSize: 12, color: '#FF6B9D' },
  cartItemControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 2,
    gap: 6,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: { 
    padding: 16, 
    borderTopWidth: 1, 
    backgroundColor: '#FFF',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  modalTotal: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  modalTotalLabel: { fontSize: 14, fontWeight: '600' },
  modalTotalSubtext: { fontSize: 10, color: '#8E8E93', marginTop: 2 },
  modalTotalAmount: { fontSize: 22, fontWeight: '800', color: '#FF6B9D' },
  proceedButton: { borderRadius: 28, overflow: 'hidden' },
  proceedGradient: { 
    flexDirection: 'row', 
    paddingVertical: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8 
  },
  proceedButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  
  notificationItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 14, 
    paddingBottom: 14, 
    borderBottomWidth: 1, 
    position: 'relative' 
  },
  notificationIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  notificationMessage: { fontSize: 12, marginBottom: 2 },
  notificationTime: { fontSize: 10, color: '#B0B0B0' },
  unreadDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    position: 'absolute', 
    right: 0, 
    top: 4,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default AppNavigator;