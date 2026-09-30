// src/screens/CartScreen.jsx
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  GestureHandlerRootView,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

const { width, height } = Dimensions.get('window');

// ============================================================
// HELPERS
// ============================================================

const formatPrice = (value) => {
  const num = Number(value);
  if (isNaN(num) || num === 0) return '₱0.00';
  return `₱${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

/**
 * ⭐ Unique key — allows the same menu_item_id to appear twice
 *    when pricing_type differs (per_pax vs per_tray).
 */
const buildCartLineKey = (item, index = 0) => {
  if (item?.cart_item_id) return `cart-${item.cart_item_id}`;
  const menuId = item?.menu_item_id || item?.id || 'unknown';
  const pricing = item?.pricing_type || 'per_pax';
  return `line-${menuId}-${pricing}-${index}`;
};

/**
 * ⭐ Pricing badge metadata — clearly shows "PER PAX" or "FOOD TRAY"
 */
const getPricingBadge = (item) => {
  const mode = (item?.pricing_type || 'per_pax').toLowerCase();

  if (mode === 'per_tray') {
    const min = safeNumber(item?.tray_min_pax, 0);
    const max = safeNumber(item?.tray_max_pax, 0);
    const servings = safeNumber(item?.tray_servings, 0);

    let hint = 'Per tray';
    if (min && max) hint = `Good for ${min} - ${max} pax`;
    else if (servings) hint = `Good for ${servings} servings`;

    return {
      label: 'FOOD TRAY',
      shortLabel: 'Tray',
      hint,
      icon: 'cube-outline',
      color: '#C2185B',
      bg: '#FFF0F5',
      border: '#FF6B9D',
    };
  }

  return {
    label: 'PER PAX',
    shortLabel: 'Pax',
    hint: 'Per person',
    icon: 'people',
    color: '#2E7D32',
    bg: '#E8F5E9',
    border: '#4CAF50',
  };
};

// ============================================================
// COMPONENT
// ============================================================

const CartScreen = () => {
  const navigation = useNavigation();
  const {
    cartItems,
    totalAmount,
    clearCart,
    updateQuantity,
    removeItem,
    addToCart,
    getItemQuantity,
  } = useCart();
  const { isAuthenticated, isGuest } = useAuth();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [savedForLater, setSavedForLater] = useState([]);

  // ⭐ Remove confirmation modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [pendingRemoveItem, setPendingRemoveItem] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const subtotal = safeNumber(totalAmount);
  const tax = subtotal * 0.12;
  const serviceFee = 50;
  const deliveryFee = subtotal > 1000 ? 0 : 100;
  const grandTotal = subtotal + tax + serviceFee + deliveryFee;
  const itemCount = cartItems.reduce((sum, item) => sum + safeNumber(item.quantity), 0);

  // ============================================================
  // ⭐ NAVIGATION — Start Shopping
  // ============================================================
  const goShopping = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Try MenuTab first, fall back to Menu
    try {
      navigation.navigate('MenuTab');
    } catch {
      navigation.navigate('Menu');
    }
  };

  const handleCheckout = () => {
    if (isGuest || !isAuthenticated) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Login Required', 'Please login to proceed with checkout', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    if (cartItems.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Cart Empty', 'Please add items to your cart before checkout');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      navigation.navigate('Payment');
    }, 500);
  };

  // ============================================================
  // ⭐ REMOVE ITEM — Dedicated UI + confirmation modal
  // ============================================================

  /**
   * Open the remove-confirmation modal (used by both the trash icon
   * and the swipe action).
   */
  const promptRemoveItem = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingRemoveItem(item);
    setShowRemoveModal(true);
  };

  /**
   * Confirmed removal — animates the row out, then removes it.
   */
  const confirmRemoveItem = () => {
    if (!pendingRemoveItem) return;

    const itemId = pendingRemoveItem.id;
    const pricingType = pendingRemoveItem.pricing_type || 'per_pax';

    setShowRemoveModal(false);
    setRemovingItemId(itemId);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      removeItem(itemId, pricingType);
      setRemovingItemId(null);
      setPendingRemoveItem(null);
      scaleAnim.setValue(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const cancelRemoveItem = () => {
    setShowRemoveModal(false);
    setPendingRemoveItem(null);
  };

  const handleUpdateQuantity = (itemId, delta, pricingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentQty = getItemQuantity(itemId, pricingType);
    const newQty = safeNumber(currentQty) + delta;

    if (newQty < 1) {
      const item = cartItems.find(
        (i) => i.id === itemId && (i.pricing_type || 'per_pax') === pricingType
      );
      if (item) promptRemoveItem(item);
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    updateQuantity(itemId, delta, pricingType);
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to manage your cart');
      return;
    }
    setShowClearModal(true);
  };

  const confirmClearCart = () => {
    setShowClearModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    clearCart();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveForLater = (item) => {
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to save items for later');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavedForLater([...savedForLater, { ...item, savedAt: new Date() }]);
    removeItem(item.id, item.pricing_type || 'per_pax');
    Alert.alert('Saved for Later', `${item.name || 'Item'} has been saved for later`);
  };

  const handleMoveToCart = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart(
      {
        id: item.id,
        name: item.name || 'Item',
        price: safeNumber(item.price),
        image: item.image || null,
        pricing_type: item.pricing_type || 'per_pax',
        tray_servings: item.tray_servings,
        tray_min_pax: item.tray_min_pax,
        tray_max_pax: item.tray_max_pax,
      },
      1
    );
    setSavedForLater(
      savedForLater.filter(
        (i) =>
          !(i.id === item.id && (i.pricing_type || 'per_pax') === (item.pricing_type || 'per_pax'))
      )
    );
    Alert.alert('Moved to Cart', `${item.name || 'Item'} has been moved back to your cart`);
  };

  const getDeliveryEstimate = () => {
    const baseTime = 30;
    const additionalTime = Math.floor(cartItems.length / 3) * 5;
    return baseTime + additionalTime;
  };

  const renderRightActions = (item) => {
    return (
      <View style={styles.swipeContainer}>
        <RectButton
          style={[styles.swipeAction, styles.swipeSave]}
          onPress={() => handleSaveForLater(item)}
        >
          <Feather name="clock" size={20} color="#FFF" />
          <Text style={styles.swipeActionText}>Save</Text>
        </RectButton>
        <RectButton
          style={[styles.swipeAction, styles.swipeDelete]}
          onPress={() => promptRemoveItem(item)}
        >
          <Feather name="trash-2" size={20} color="#FFF" />
          <Text style={styles.swipeActionText}>Remove</Text>
        </RectButton>
      </View>
    );
  };

  // ============================================================
  // ⭐ CART ITEM CARD
  // ============================================================
  const CartItemCard = ({ item }) => {
    const pricingType = item.pricing_type || 'per_pax';
    const isRemoving =
      removingItemId === item.id && removingItemId; // simple check
    const quantity = getItemQuantity(item.id, pricingType) || safeNumber(item.quantity, 0);
    const price = safeNumber(item.price);
    const itemTotal = price * quantity;
    const pricing = getPricingBadge(item);
    const qtySuffix = pricing.label === 'FOOD TRAY' ? 'tray' : 'pax';

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <Animated.View
          style={[
            styles.cartItemCard,
            { transform: [{ scale: isRemoving ? scaleAnim : 1 }] },
          ]}
        >
          {/* ---- TOP ROW: image + details ---- */}
          <View style={styles.cardTopRow}>
            <View style={styles.itemImageContainer}>
              <Image
                source={{
                  uri:
                    item.image ||
                    'https://via.placeholder.com/80x80/FF6B9D/FFFFFF?text=Food',
                }}
                style={styles.itemImage}
              />
              {quantity > 1 && (
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityBadgeText}>{quantity}</Text>
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)']}
                style={styles.imageOverlay}
              />
            </View>

            <View style={styles.itemDetails}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name || 'Menu Item'}
                </Text>

                {/* ⭐ Remove (trash) button — dedicated UI */}
                <TouchableOpacity
                  style={styles.removeIconButton}
                  onPress={() => promptRemoveItem(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>

              {/* ⭐ PRICING TYPE BADGE — shows PER PAX or FOOD TRAY */}
              <View
                style={[
                  styles.pricingBadge,
                  { backgroundColor: pricing.bg, borderColor: pricing.border },
                ]}
              >
                <Ionicons name={pricing.icon} size={12} color={pricing.color} />
                <Text style={[styles.pricingBadgeLabel, { color: pricing.color }]}>
                  {pricing.label}
                </Text>
                <View
                  style={[
                    styles.pricingBadgeDivider,
                    { backgroundColor: pricing.color },
                  ]}
                />
                <Text style={[styles.pricingBadgeHint, { color: pricing.color }]}>
                  {pricing.hint}
                </Text>
              </View>

              <View style={styles.itemMetaRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#FFB800" />
                  <Text style={styles.ratingText}>4.5</Text>
                </View>
                <View style={styles.itemMetaDivider} />
                <Text style={styles.itemUnitPrice}>
                  {formatPrice(price)} / {qtySuffix}
                </Text>
              </View>
            </View>
          </View>

          {/* ---- BOTTOM ROW: quantity stepper + line total ---- */}
          <View style={styles.cardBottomRow}>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  quantity <= 1 && styles.quantityButtonDisabled,
                ]}
                onPress={() => handleUpdateQuantity(item.id, -1, pricingType)}
                disabled={quantity <= 1}
                activeOpacity={0.7}
              >
                <Feather
                  name="minus"
                  size={14}
                  color={quantity <= 1 ? '#C6C6C8' : '#FF6B9D'}
                />
              </TouchableOpacity>

              <Text style={styles.quantityText}>{quantity}</Text>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleUpdateQuantity(item.id, 1, pricingType)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={14} color="#FF6B9D" />
              </TouchableOpacity>
            </View>

            <View style={styles.itemTotalWrapper}>
              <Text style={styles.itemTotalPrice}>{formatPrice(itemTotal)}</Text>
              <Text style={styles.itemTotalHint}>
                {quantity} × {formatPrice(price)} / {qtySuffix}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Swipeable>
    );
  };

  // ============================================================
  // SAVED ITEM CARD
  // ============================================================
  const SavedItemCard = ({ item }) => {
    const pricing = getPricingBadge(item);

    return (
      <View style={styles.savedItemCard}>
        <Image
          source={{
            uri:
              item.image ||
              'https://via.placeholder.com/40x40/FF6B9D/FFFFFF?text=Food',
          }}
          style={styles.savedItemImage}
        />
        <View style={styles.savedItemDetails}>
          <Text style={styles.savedItemName} numberOfLines={1}>
            {item.name || 'Item'}
          </Text>
          <View style={styles.savedItemMetaRow}>
            <View
              style={[
                styles.savedPricingBadge,
                { backgroundColor: pricing.bg, borderColor: pricing.border },
              ]}
            >
              <Ionicons name={pricing.icon} size={10} color={pricing.color} />
              <Text style={[styles.savedPricingText, { color: pricing.color }]}>
                {pricing.label}
              </Text>
            </View>
            <Text style={styles.savedItemPrice}>
              {formatPrice(safeNumber(item.price))}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.moveToCartButton}
          onPress={() => handleMoveToCart(item)}
          activeOpacity={0.7}
        >
          <Feather name="shopping-bag" size={16} color="#FF6B9D" />
          <Text style={styles.moveToCartText}>Move</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ============================================================
  // EMPTY CART — with "Start Shopping" button
  // ============================================================
  const EmptyCart = () => {
    const title = isGuest ? 'Login to View Cart' : 'Your cart is empty';
    const message = isGuest
      ? 'Please login to view and manage your cart items.\nCreate an account to save your favorites!'
      : "Looks like you haven't added any items to your cart yet.\nBrowse our menu and find something delicious!";
    const primaryAction = isGuest
      ? {
          label: 'Sign In',
          icon: 'log-in',
          onPress: () => navigation.navigate('Login'),
        }
      : {
          label: 'Start Shopping',
          icon: 'shopping-bag',
          onPress: goShopping,
        };

    return (
      <Animated.View
        style={[
          styles.emptyContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <LinearGradient
          colors={['#FFF0F5', '#FFE8EE', '#FFDCE6']}
          style={styles.emptyGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons name="cart-outline" size={72} color="#FF6B9D" />
            <View style={styles.emptyIconPulse} />
          </View>
          <Text style={styles.emptyTitle}>{title}</Text>
          <Text style={styles.emptyText}>{message}</Text>

          {/* Primary button */}
          <TouchableOpacity
            style={styles.shopButton}
            onPress={primaryAction.onPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8FB1', '#FFA0C0']}
              style={styles.shopGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Feather name={primaryAction.icon} size={18} color="#FFF" />
              <Text style={styles.shopButtonText}>{primaryAction.label}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary: browse menu even for guests */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={goShopping}
            activeOpacity={0.7}
          >
            <Feather name="grid" size={16} color="#FF6B9D" />
            <Text style={styles.secondaryButtonText}>Browse Menu</Text>
          </TouchableOpacity>

          <View style={styles.emptyFeatures}>
            <View style={styles.emptyFeature}>
              <MaterialCommunityIcons name="truck-delivery" size={20} color="#FF6B9D" />
              <Text style={styles.emptyFeatureText}>Free delivery over ₱1000</Text>
            </View>
            <View style={styles.emptyFeature}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#FF6B9D" />
              <Text style={styles.emptyFeatureText}>Secure payment</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (cartItems.length === 0) {
    return <EmptyCart />;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#FFFFFF', '#FFF8FA', '#FFF0F5']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#FF6B9D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        <TouchableOpacity
          onPress={handleClearCart}
          style={styles.clearHeaderButton}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <View style={styles.deliveryBar}>
        <View style={styles.deliveryInfo}>
          <MaterialCommunityIcons name="truck-fast" size={18} color="#FF6B9D" />
          <Text style={styles.deliveryText}>
            Delivery in ~{getDeliveryEstimate()} min
          </Text>
        </View>
        {subtotal < 1000 && (
          <View style={styles.deliveryInfo}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#FF9800" />
            <Text style={styles.deliveryWarning}>
              Add ₱{(1000 - subtotal).toLocaleString()} more for free delivery
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{itemCount}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatPrice(subtotal)}</Text>
          <Text style={styles.statLabel}>Subtotal</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{cartItems.length}</Text>
          <Text style={styles.statLabel}>Lines</Text>
        </View>
      </View>

      <FlatList
        data={cartItems}
        renderItem={({ item }) => <CartItemCard item={item} />}
        keyExtractor={(item, index) => buildCartLineKey(item, index)}
        contentContainerStyle={styles.cartList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          savedForLater.length > 0 ? (
            <View style={styles.savedSection}>
              <View style={styles.savedHeader}>
                <Feather name="clock" size={18} color="#8E8E93" />
                <Text style={styles.savedTitle}>Saved for Later</Text>
                <Text style={styles.savedCount}>{savedForLater.length}</Text>
              </View>
              {savedForLater.map((item, idx) => (
                <SavedItemCard
                  key={`saved-${item.id}-${item.pricing_type || 'per_pax'}-${idx}`}
                  item={item}
                />
              ))}
            </View>
          ) : null
        }
      />

      <View style={styles.footer}>
        <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <Text style={styles.summarySubtitle}>{itemCount} items</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (12%)</Text>
            <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Fee</Text>
            <Text style={styles.summaryValue}>{formatPrice(serviceFee)}</Text>
          </View>
          {deliveryFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>{formatPrice(deliveryFee)}</Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={[styles.summaryRow, styles.totalRow]}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalSubtext}>Including all fees</Text>
            </View>
            <Text style={styles.totalAmount}>{formatPrice(grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={handleCheckout}
            disabled={isCheckingOut}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8FB1']}
              style={styles.checkoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isCheckingOut ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                  <Feather name="arrow-right" size={18} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.footerFeatures}>
          <View style={styles.footerFeature}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#4CAF50" />
            <Text style={styles.footerFeatureText}>Secure payment</Text>
          </View>
          <View style={styles.footerFeature}>
            <MaterialCommunityIcons name="headset" size={14} color="#4CAF50" />
            <Text style={styles.footerFeatureText}>24/7 Support</Text>
          </View>
          <View style={styles.footerFeature}>
            <MaterialCommunityIcons name="refresh" size={14} color="#4CAF50" />
            <Text style={styles.footerFeatureText}>Easy returns</Text>
          </View>
        </View>
      </View>

      {/* ============================================================
          CLEAR CART MODAL
      ============================================================ */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons name="alert" size={48} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Clear Cart?</Text>
            <Text style={styles.modalText}>
              This action will remove all items from your cart. Are you sure you want to
              continue?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmClearCart}
              >
                <Text style={styles.modalDeleteText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================
          ⭐ REMOVE ITEM MODAL — shows name + pricing type
      ============================================================ */}
      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={cancelRemoveItem}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FFEBEE' }]}>
              <Feather name="trash-2" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Remove Item?</Text>

            {pendingRemoveItem && (
              <View style={styles.removePreviewCard}>
                <Image
                  source={{
                    uri:
                      pendingRemoveItem.image ||
                      'https://via.placeholder.com/48x48/FF6B9D/FFFFFF?text=Food',
                  }}
                  style={styles.removePreviewImage}
                />
                <View style={styles.removePreviewInfo}>
                  <Text style={styles.removePreviewName} numberOfLines={1}>
                    {pendingRemoveItem.name || 'Item'}
                  </Text>
                  {(() => {
                    const pb = getPricingBadge(pendingRemoveItem);
                    return (
                      <View
                        style={[
                          styles.removePreviewBadge,
                          { backgroundColor: pb.bg, borderColor: pb.border },
                        ]}
                      >
                        <Ionicons name={pb.icon} size={10} color={pb.color} />
                        <Text
                          style={[styles.removePreviewBadgeText, { color: pb.color }]}
                        >
                          {pb.label}
                        </Text>
                        <Text
                          style={[styles.removePreviewBadgeHint, { color: pb.color }]}
                        >
                          {pb.hint}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            )}

            <Text style={styles.modalText}>
              This item will be removed from your cart.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={cancelRemoveItem}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmRemoveItem}
              >
                <Feather name="trash-2" size={16} color="#FFF" />
                <Text style={styles.modalDeleteText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  clearHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  deliveryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deliveryInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryText: { fontSize: 12, color: '#1C1C1E', fontWeight: '500' },
  deliveryWarning: { fontSize: 11, color: '#FF9800', fontWeight: '500' },

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  statLabel: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E5E5EA' },

  cartList: { padding: 16, paddingBottom: 20 },
  separator: { height: 10 },

  cartItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Top row: image + details
  cardTopRow: { flexDirection: 'row' },
  itemImageContainer: { position: 'relative' },
  itemImage: { width: 80, height: 80, borderRadius: 12 },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B9D',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  itemDetails: { flex: 1, marginLeft: 12 },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },

  // ⭐ Remove (trash) icon button
  removeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ⭐ Pricing badge
  pricingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    marginBottom: 6,
  },
  pricingBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pricingBadgeDivider: {
    width: 1,
    height: 10,
    opacity: 0.5,
    marginHorizontal: 2,
  },
  pricingBadgeHint: { fontSize: 10, fontWeight: '500' },

  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 9, fontWeight: '600', color: '#8E8E93' },
  itemMetaDivider: { width: 1, height: 12, backgroundColor: '#E5E5EA' },
  itemUnitPrice: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },

  // Bottom row: stepper + total
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 4,
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: { backgroundColor: '#F5F5F5' },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    minWidth: 24,
    textAlign: 'center',
  },
  itemTotalWrapper: { alignItems: 'flex-end' },
  itemTotalPrice: { fontSize: 15, fontWeight: '700', color: '#FF6B9D' },
  itemTotalHint: { fontSize: 9, color: '#8E8E93', marginTop: 2 },

  // Swipe actions
  swipeContainer: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
  },
  swipeSave: { backgroundColor: '#4CAF50' },
  swipeDelete: { backgroundColor: '#FF3B30' },
  swipeActionText: { color: '#FFF', fontSize: 10, fontWeight: '600', marginTop: 4 },

  // Footer
  footer: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  summarySection: { marginBottom: 16 },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  summarySubtitle: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: '#8E8E93' },
  summaryValue: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  summaryDivider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 12 },
  totalRow: { marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  totalSubtext: { fontSize: 10, color: '#8E8E93', marginTop: 2 },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#FF6B9D' },
  buttonContainer: { gap: 12 },
  checkoutButton: { borderRadius: 28, overflow: 'hidden' },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  checkoutButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  footerFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  footerFeature: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerFeatureText: { fontSize: 10, color: '#8E8E93' },

  // Saved for later
  savedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savedTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  savedCount: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  savedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  savedItemImage: { width: 40, height: 40, borderRadius: 8 },
  savedItemDetails: { flex: 1, marginLeft: 10 },
  savedItemName: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  savedItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  savedPricingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savedPricingText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  savedItemPrice: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
  moveToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  moveToCartText: { fontSize: 11, fontWeight: '600', color: '#FF6B9D' },

  // Empty cart
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  emptyGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyIconPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#FF6B9D',
    opacity: 0.2,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  shopButton: { borderRadius: 28, overflow: 'hidden', marginBottom: 12 },
  shopGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 8,
  },
  shopButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // ⭐ Secondary "Browse Menu" button on empty state
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FF6B9D',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B9D',
  },

  emptyFeatures: { flexDirection: 'row', gap: 24, marginTop: 28 },
  emptyFeature: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptyFeatureText: { fontSize: 11, color: '#8E8E93' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  modalText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: { backgroundColor: '#F5F5F5' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  modalDeleteButton: { backgroundColor: '#FF3B30' },
  modalDeleteText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // ⭐ Remove-item preview card inside the modal
  removePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  removePreviewImage: { width: 48, height: 48, borderRadius: 10 },
  removePreviewInfo: { flex: 1, marginLeft: 10 },
  removePreviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  removePreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removePreviewBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  removePreviewBadgeHint: { fontSize: 9, fontWeight: '500' },
});

export default CartScreen;