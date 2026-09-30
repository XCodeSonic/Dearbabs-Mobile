// src/contexts/CartContext.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { cartAPI, apiHelpers } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext();

// ============================================================
// ⭐ HELPERS
// ============================================================

/**
 * Unique key for a cart line — combines menu_item_id + pricing_type
 * so the same dish with different pricing lives as two separate rows.
 */
const lineKey = (item) => {
  const id = item?.menu_item_id || item?.id;
  const pricing = (item?.pricing_type || 'per_pax').toLowerCase();
  return `${id}__${pricing}`;
};

/**
 * Normalize the payload shape returned by the backend cart API.
 * Always keeps `pricing_type`, tray metadata, and pricing fields.
 */
const normalizeCartPayload = (payload) => {
  const data = payload?.data?.data || payload?.data || payload || {};
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item) => {
    const pricingType = (item.pricing_type || 'per_pax').toLowerCase();
    const unitPrice =
      parseFloat(item.unit_price) ||
      parseFloat(item.price) ||
      (pricingType === 'per_tray'
        ? parseFloat(item.tray_price) || 0
        : parseFloat(item.per_pax_price) || 0);

    return {
      ...item,
      id: item.menu_item_id || item.id,
      menu_item_id: item.menu_item_id || item.id,
      cart_item_id: item.cart_item_id,
      name: item.name || 'Menu Item',
      pricing_type: pricingType,
      price: unitPrice,
      unit_price: unitPrice,
      per_pax_price: parseFloat(item.per_pax_price) || 0,
      tray_price: parseFloat(item.tray_price) || 0,
      tray_servings: parseInt(item.tray_servings, 10) || 0,
      tray_min_pax: parseInt(item.tray_min_pax, 10) || 0,
      tray_max_pax: parseInt(item.tray_max_pax, 10) || 0,
      tray_description: item.tray_description || '',
      quantity: parseInt(item.quantity, 10) || 1,
      image: item.image || item.image_url,
    };
  });
};

/**
 * Safe price resolver — reads the right price based on pricing_type.
 */
const resolveUnitPrice = (item) => {
  const mode = (item?.pricing_type || 'per_pax').toLowerCase();
  if (mode === 'per_tray') {
    return (
      parseFloat(item?.unit_price) ||
      parseFloat(item?.price) ||
      parseFloat(item?.tray_price) ||
      0
    );
  }
  return (
    parseFloat(item?.unit_price) ||
    parseFloat(item?.price) ||
    parseFloat(item?.per_pax_price) ||
    0
  );
};

// ============================================================
// PROVIDER
// ============================================================

export const CartProvider = ({ children }) => {
  const { isGuest, user, getUserId } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getCartKey = () => {
    if (isGuest) return '@guest_cart_items';
    const userId = getUserId();
    return userId ? `@cart_items_${userId}` : '@cart_items';
  };

  const isCustomerAccount = () => {
    if (isGuest || !user) return false;
    const role = String(user.role || user.primary_role || user.user_role || '').toLowerCase();
    return Boolean(user.customer_id) || role === 'customer' || role === 'client';
  };

  // ---------- Lifecycle ----------
  useEffect(() => {
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, user?.id, user?.user_id, user?.customer_id]);

  useEffect(() => {
    if (!isLoading && !isGuest) saveCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, isLoading, isGuest]);

  // ---------- Persistence ----------
  const loadCart = async () => {
    try {
      setIsLoading(true);
      const key = getCartKey();

      if (!isCustomerAccount()) {
        setCartItems([]);
        await AsyncStorage.setItem(key, JSON.stringify([]));
        return;
      }

      // Try backend first
      try {
        const response = await cartAPI.getCart();
        const backendItems = normalizeCartPayload(response);
        setCartItems(backendItems);
        await AsyncStorage.setItem(key, JSON.stringify(backendItems));
        return;
      } catch (backendError) {
        console.log(
          'Cart backend unavailable, using local cache:',
          backendError?.message || backendError
        );
      }

      // Fallback to local cache
      const stored = await AsyncStorage.getItem(key);
      setCartItems(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.log('Error loading cart:', error);
      setCartItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCart = async () => {
    try {
      if (!isCustomerAccount()) return;
      await AsyncStorage.setItem(getCartKey(), JSON.stringify(cartItems));
    } catch (error) {
      console.log('Error saving cart:', error);
    }
  };

  // ---------- Backend sync ----------
  const syncAdd = async (item, quantity) => {
    const menuItemId = item.menu_item_id || item.id;
    if (!menuItemId) return;

    try {
      const response = await cartAPI.addItem({
        menu_item_id: menuItemId,
        // ⭐ Send pricing_type so the backend can store the right price
        pricing_type: item.pricing_type || 'per_pax',
        quantity,
      });
      const backendItems = normalizeCartPayload(response);
      // ⭐ Only replace if the backend returned a valid list
      if (Array.isArray(backendItems) && backendItems.length) {
        setCartItems(backendItems);
      }
    } catch (error) {
      console.log('Error syncing cart add:', apiHelpers.handleError(error));
    }
  };

  const syncUpdate = async (item, quantity) => {
    try {
      if (item.cart_item_id) {
        const response =
          quantity <= 0
            ? await cartAPI.removeItem(item.cart_item_id)
            : await cartAPI.updateItem(item.cart_item_id, { quantity });
        const backendItems = normalizeCartPayload(response);
        setCartItems(backendItems);
      } else if (quantity > 0) {
        await syncAdd(item, quantity);
      }
    } catch (error) {
      console.log('Error syncing cart update:', apiHelpers.handleError(error));
    }
  };

  // ---------- Local storage helpers ----------
  const clearUserCart = async (userId) => {
    try {
      await AsyncStorage.removeItem(`@cart_items_${userId}`);
    } catch (error) {
      console.log('Error clearing user cart:', error);
    }
  };

  const clearGuestCart = async () => {
    try {
      await AsyncStorage.removeItem('@guest_cart_items');
    } catch (error) {
      console.log('Error clearing guest cart:', error);
    }
  };

  // ============================================================
  // PUBLIC ACTIONS
  // ============================================================

  /**
   * Add item to cart.
   * ⭐ Two items with the same menu_item_id but different pricing_type
   *    are treated as separate lines.
   */
  const addToCart = (item, quantity = 1) => {
    if (!isCustomerAccount()) {
      Alert.alert(
        'Customer Account Required',
        'Please login using a customer account to add items to your cart.'
      );
      return;
    }

    const itemId = item.menu_item_id || item.id;
    const pricingType = (item.pricing_type || 'per_pax').toLowerCase();
    const unitPrice = resolveUnitPrice({ ...item, pricing_type: pricingType });

    const normalized = {
      ...item,
      id: itemId,
      menu_item_id: item.menu_item_id || itemId,
      pricing_type: pricingType,
      price: unitPrice,
      unit_price: unitPrice,
      per_pax_price: parseFloat(item.per_pax_price) || 0,
      tray_price: parseFloat(item.tray_price) || 0,
      tray_servings: parseInt(item.tray_servings, 10) || 0,
      tray_min_pax: parseInt(item.tray_min_pax, 10) || 0,
      tray_max_pax: parseInt(item.tray_max_pax, 10) || 0,
      tray_description: item.tray_description || '',
    };

    setCartItems((prev) => {
      const key = lineKey(normalized);
      const existing = prev.find((i) => lineKey(i) === key);

      if (existing) {
        return prev.map((i) =>
          lineKey(i) === key
            ? { ...i, quantity: (parseInt(i.quantity, 10) || 0) + quantity }
            : i
        );
      }
      return [...prev, { ...normalized, quantity }];
    });

    syncAdd(normalized, quantity);
  };

  /**
   * Update the quantity of a specific line.
   * ⭐ `pricingType` scopes the update to the correct row.
   */
  const updateQuantity = (itemId, delta, pricingType = null) => {
    if (!isCustomerAccount()) {
      Alert.alert(
        'Customer Account Required',
        'Please login using a customer account to update your cart.'
      );
      return;
    }

    let changedItem = null;
    let nextQuantity = 0;

    setCartItems((prev) =>
      prev
        .map((item) => {
          const matchesId = (item.menu_item_id || item.id) === itemId;
          const matchesPricing =
            pricingType == null ||
            (item.pricing_type || 'per_pax') === pricingType;

          if (matchesId && matchesPricing) {
            nextQuantity = (parseInt(item.quantity, 10) || 0) + delta;
            changedItem = item;
            if (nextQuantity <= 0) return null;
            return { ...item, quantity: nextQuantity };
          }
          return item;
        })
        .filter(Boolean)
    );

    if (changedItem) syncUpdate(changedItem, nextQuantity);
  };

  /**
   * Remove a specific line.
   * ⭐ `pricingType` scopes the removal to the correct row.
   */
  const removeItem = (itemId, pricingType = null) => {
    if (!isCustomerAccount()) {
      Alert.alert(
        'Customer Account Required',
        'Please login using a customer account to remove items from your cart.'
      );
      return;
    }

    const item = cartItems.find((i) => {
      const matchesId = (i.menu_item_id || i.id) === itemId;
      const matchesPricing =
        pricingType == null || (i.pricing_type || 'per_pax') === pricingType;
      return matchesId && matchesPricing;
    });

    setCartItems((prev) =>
      prev.filter((i) => {
        const matchesId = (i.menu_item_id || i.id) === itemId;
        const matchesPricing =
          pricingType == null || (i.pricing_type || 'per_pax') === pricingType;
        return !(matchesId && matchesPricing);
      })
    );

    if (item) syncUpdate(item, 0);
  };

  /**
   * Clear entire cart.
   */
  const clearCart = () => {
    if (!isCustomerAccount()) {
      Alert.alert(
        'Customer Account Required',
        'Please login using a customer account to clear your cart.'
      );
      return;
    }

    setCartItems([]);
    cartAPI
      .clearCart()
      .catch((error) => console.log('Error clearing backend cart:', error));
  };

  // ============================================================
  // DERIVED GETTERS
  // ============================================================

  const getCartCount = () =>
    !isCustomerAccount()
      ? 0
      : cartItems.reduce(
          (sum, item) => sum + (parseInt(item.quantity, 10) || 0),
          0
        );

  const getTotalAmount = () =>
    !isCustomerAccount()
      ? 0
      : cartItems.reduce(
          (sum, item) =>
            sum + resolveUnitPrice(item) * (parseInt(item.quantity, 10) || 0),
          0
        );

  /**
   * ⭐ Checks whether a specific (item + pricing) combination is in the cart.
   */
  const isItemInCart = (itemId, pricingType = null) => {
    if (!isCustomerAccount()) return false;
    return cartItems.some((item) => {
      const matchesId = (item.menu_item_id || item.id) === itemId;
      const matchesPricing =
        pricingType == null || (item.pricing_type || 'per_pax') === pricingType;
      return matchesId && matchesPricing;
    });
  };

  /**
   * ⭐ Returns the quantity of a specific (item + pricing) combination.
   *    If pricingType is omitted, sums across all pricing variants.
   */
  const getItemQuantity = (itemId, pricingType = null) => {
    if (!isCustomerAccount()) return 0;

    if (pricingType == null) {
      // Sum across all pricing variants of the same menu item
      return cartItems
        .filter((i) => (i.menu_item_id || i.id) === itemId)
        .reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
    }

    const item = cartItems.find(
      (i) =>
        (i.menu_item_id || i.id) === itemId &&
        (i.pricing_type || 'per_pax') === pricingType
    );
    return item ? parseInt(item.quantity, 10) || 0 : 0;
  };

  // ============================================================
  // GUEST CART TRANSFER
  // ============================================================

  const transferGuestCartToUser = async (userId) => {
    try {
      if (!userId) return false;
      const guestCart = await AsyncStorage.getItem('@guest_cart_items');
      if (!guestCart) return false;

      const guestItems = JSON.parse(guestCart);
      if (!guestItems.length) return false;

      await AsyncStorage.setItem(`@cart_items_${userId}`, guestCart);
      await AsyncStorage.removeItem('@guest_cart_items');
      setCartItems(guestItems);
      return true;
    } catch (error) {
      console.log('Error transferring guest cart:', error);
      return false;
    }
  };

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value = {
    cartItems,
    isLoading,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    getCartCount,
    getTotalAmount,
    isItemInCart,
    getItemQuantity,
    clearUserCart,
    clearGuestCart,
    transferGuestCartToUser,
    getCartKey,
    reloadCart: loadCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};