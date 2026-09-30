// src/screens/MenuScreen.jsx
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useAllergies } from '../contexts/AllergyContext';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { getMatchingAllergies, humanizeAllergen } from '../utils/allergyHelper';
import { categoryService } from '../services/categoryService';
import { menuService } from '../services/menuService';
import { packageService } from '../services/packageService';
import { promotionService } from '../services/promotionService';
import { getRandomBannerImage, getThemedBannerImage } from '../utils/imageHelper';

const SCREEN_WIDTH = Dimensions.get('window')?.width || 375;

// ============================================================
// PRICING HELPERS
// ============================================================

const normalizePricing = (item) => {
  const pricingType = item.pricing_type || 'both';
  const perPaxPrice = parseFloat(item.price) || 0;
  const trayPrice = parseFloat(item.tray_price) || 0;
  const trayServings = parseInt(item.tray_servings) || 25;
  const trayMinPax = parseInt(item.tray_min_pax) || 20;
  const trayMaxPax = parseInt(item.tray_max_pax) || trayServings;

  const hasPerPax =
    item.has_per_pax_pricing !== undefined
      ? !!item.has_per_pax_pricing
      : pricingType === 'per_pax' || pricingType === 'both';

  const hasTray =
    item.has_tray_pricing !== undefined
      ? !!item.has_tray_pricing
      : (pricingType === 'per_tray' || pricingType === 'both') && trayPrice > 0;

  return {
    pricingType,
    perPaxPrice,
    trayPrice,
    trayServings,
    trayMinPax,
    trayMaxPax,
    trayDescription: item.tray_description || '',
    trayDisplayDescription: item.tray_display_description || '',
    hasPerPax,
    hasTray,
    defaultMode: hasPerPax ? 'per_pax' : hasTray ? 'per_tray' : 'per_pax',
  };
};

const effectivePrice = (item, mode) => {
  const p = normalizePricing(item);
  if (mode === 'per_tray' && p.hasTray) return p.trayPrice;
  return p.perPaxPrice;
};

// ============================================================
// COMPONENT
// ============================================================

const MenuScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { isGuest } = useAuth();
  const { myAllergies } = useAllergies();
  const { addToCart, getItemQuantity, removeItem } = useCart();

  // ⭐ Fast lookup — recomputed only when myAllergies changes
  const customerAllergies = React.useMemo(
    () => (Array.isArray(myAllergies) ? myAllergies : []),
    [myAllergies]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [packages, setPackages] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTab, setSelectedTab] = useState('menu');
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [viewMode, setViewMode] = useState('grid');

  // Global pricing mode — default to Food Tray pricing on load
  const [globalPricingMode, setGlobalPricingMode] = useState('per_tray');

  // Detail modals
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageItems, setPackageItems] = useState([]);
  const [loadingPackageItems, setLoadingPackageItems] = useState(false);

  // Quantity stepper inside detail modal
  const [detailQuantity, setDetailQuantity] = useState(1);

  // Custom alert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    icon: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null,
    type: 'info',
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const [categoryScrollOffset, setCategoryScrollOffset] = useState(0);
  const [categoryContentWidth, setCategoryContentWidth] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading menu data...');

      const categoriesResult = await categoryService.getPublicCategories();
      if (categoriesResult.success) {
        const cats = categoriesResult.data || [];
        const formattedCats = cats.map((cat) => ({
          ...cat,
          category_id: cat.category_id || cat.id,
        }));
        setCategories([{ category_id: 'all', name: 'All' }, ...formattedCats]);
      }

      const menuResult = await menuService.getPublicMenuItems({ is_available: true });
      if (menuResult.success) {
        setMenuItems(menuResult.data || []);
      }

      const packageResult = await packageService.getPublicPackages();
      if (packageResult.success) {
        setPackages(packageResult.data || []);
      }

      const promoResult = await promotionService.getPublicPromotions();
      if (promoResult.success) {
        setPromotions(promoResult.data || []);
      }
    } catch (error) {
      console.error('❌ Error loading menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' ||
      item.category_id === parseInt(selectedCategory) ||
      item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredPackages = packages.filter((item) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPromotions = promotions.filter((item) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedItems = [...filteredMenuItems].sort((a, b) => {
    const aP = effectivePrice(a, globalPricingMode);
    const bP = effectivePrice(b, globalPricingMode);
    switch (sortBy) {
      case 'popular':
        return (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      case 'price_low':
        return aP - bP;
      case 'price_high':
        return bP - aP;
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  const renderStars = (rating, size = 14) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Ionicons key={`star-${i}`} name="star" size={size} color="#FFB800" />);
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<Ionicons key={`star-${i}`} name="star-half" size={size} color="#FFB800" />);
      } else {
        stars.push(<Ionicons key={`star-${i}`} name="star-outline" size={size} color="#ccc" />);
      }
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const toggleFavorite = (itemId) => {
    setFavorites((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ============================================================
  // OPEN / CLOSE DETAIL MODAL
  // ============================================================

  const openMenuItemDetail = (item) => {
    setSelectedMenuItem(item);
    setDetailQuantity(1);
  };

  const closeMenuItemDetail = () => {
    setSelectedMenuItem(null);
    setDetailQuantity(1);
  };

  const openPackageDetail = async (pkg) => {
    setSelectedPackage(pkg);
    setLoadingPackageItems(true);
    try {
      const packageId = pkg.package_id || pkg.id;
      const result = await packageService.getPackageItems(packageId);
      if (result.success) {
        setPackageItems(result.data || []);
      } else {
        setPackageItems([]);
      }
    } catch (error) {
      console.error('❌ Error loading package items:', error);
      setPackageItems([]);
    } finally {
      setLoadingPackageItems(false);
    }
  };

  const closePackageDetail = () => {
    setSelectedPackage(null);
    setPackageItems([]);
  };

  const showCustomAlert = (config) => {
    setAlertConfig({
      ...config,
      onConfirm: config.onConfirm || null,
      onCancel: config.onCancel || null,
    });
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
    setAlertConfig({
      title: '',
      message: '',
      icon: null,
      confirmText: 'OK',
      cancelText: 'Cancel',
      onConfirm: null,
      onCancel: null,
      type: 'info',
    });
  };

  const handleAlertConfirm = () => {
    if (alertConfig.onConfirm) alertConfig.onConfirm();
    closeAlert();
  };

  const handleAlertCancel = () => {
    if (alertConfig.onCancel) alertConfig.onCancel();
    closeAlert();
  };

  const getAlertColors = (type) => {
    switch (type) {
      case 'success':
        return { main: '#4CAF50', light: '#E8F5E9' };
      case 'warning':
        return { main: '#FF9800', light: '#FFF3E0' };
      case 'error':
        return { main: '#F44336', light: '#FFEBEE' };
      default:
        return { main: '#2196F3', light: '#E3F2FD' };
    }
  };

  // ============================================================
  // ADD TO CART
  // ============================================================

  const resolveMode = (item, preferredMode) => {
    const p = normalizePricing(item);
    if (preferredMode === 'per_tray' && p.hasTray) return 'per_tray';
    if (preferredMode === 'per_pax' && p.hasPerPax) return 'per_pax';
    return p.defaultMode;
  };

  /**
   * ⭐ Build a cart line that cannot be misread downstream.
   *    - `line_id`        : composite key (`<menu_item_id>__<pricing_type>`)
   *    - `pricing_type`   : normalized lowercase
   *    - `unit_price`     : the resolved price for the chosen mode (string)
   *    - `price`          : same as unit_price for backward compat
   *    - `per_pax_price` / `tray_price` : keep both bases
   */
  const buildCartItem = (item, mode, qty) => {
    const p = normalizePricing(item);
    const isTray = mode === 'per_tray' && p.hasTray;
    const pricingType = isTray ? 'per_tray' : 'per_pax';
    const unitPrice = isTray ? p.trayPrice : p.perPaxPrice;
    const menuItemId = item.menu_item_id || item.id;

    return {
      line_id: `${menuItemId}__${pricingType}`,
      id: menuItemId,
      menu_item_id: menuItemId,
      name: item.name,

      // ⭐ pricing metadata — everything downstream depends on these
      pricing_type: pricingType,
      unit_price: unitPrice,
      price: unitPrice,

      per_pax_price: p.perPaxPrice,
      tray_price: p.trayPrice,
      tray_servings: p.trayServings,
      tray_min_pax: p.trayMinPax,
      tray_max_pax: p.trayMaxPax,
      tray_description: p.trayDescription,

      quantity: qty,
      price_label: isTray ? `₱${p.trayPrice}/tray` : `₱${p.perPaxPrice}/pax`,
      image: item.image_url || item.image,
    };
  };

  const handleQuickAdd = (item) => {
    if (isGuest) {
      showCustomAlert({
        title: 'Guest Mode',
        message: 'Please login to add items to your cart',
        icon: 'lock',
        confirmText: 'Login',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => navigation.navigate('Login'),
      });
      return;
    }

    const p = normalizePricing(item);
    const mode = resolveMode(item, globalPricingMode);
    const itemId = item.menu_item_id || item.id;
    // ⭐ Only count quantity for the SAME pricing line
    const existingQty = getItemQuantity(itemId, mode);
    const cartItem = buildCartItem(item, mode, 1);
    const priceText =
      mode === 'per_tray' ? `₱${p.trayPrice}/tray` : `₱${p.perPaxPrice}/pax`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart(cartItem, 1);

    showCustomAlert({
      title: 'Added to Cart',
      message: `${item.name} (${priceText}) has been added to your cart.`,
      icon: 'checkmark',
      confirmText: existingQty > 0 ? 'OK' : 'Continue Shopping',
      type: 'success',
    });
  };

  const handleAddToCartFromModal = (item, qty) => {
    if (isGuest) {
      showCustomAlert({
        title: 'Guest Mode',
        message: 'Please login to add items to your cart',
        icon: 'lock',
        confirmText: 'Login',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => navigation.navigate('Login'),
      });
      return;
    }

    const mode = resolveMode(item, globalPricingMode);
    const p = normalizePricing(item);
    const cartItem = buildCartItem(item, mode, qty);
    const priceText =
      mode === 'per_tray' ? `₱${p.trayPrice}/tray` : `₱${p.perPaxPrice}/pax`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart(cartItem, qty);

    closeMenuItemDetail();

    showCustomAlert({
      title: 'Added to Cart',
      message: `${qty} × ${item.name} (${priceText}) has been added to your cart.`,
      icon: 'checkmark',
      confirmText: 'Continue Shopping',
      type: 'success',
    });
  };

  const handleRemoveFromCart = (itemId, itemName, pricingType) => {
    showCustomAlert({
      title: 'Remove from Cart',
      message: `Are you sure you want to remove ${itemName} from your cart?`,
      icon: 'trash',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: () => {
        // ⭐ Remove only the matching pricing line
        removeItem(itemId, pricingType);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    });
  };

  // ============================================================
  // GRID MENU ITEM
  // ============================================================

  const GridMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id]
      ? getRandomBannerImage()
      : item.image_url || item.image || getRandomBannerImage();

    const isFavorite = favorites.includes(item.menu_item_id || item.id);
    const itemId = item.menu_item_id || item.id;
    const pricing = normalizePricing(item);

    // ⭐ Pricing-aware display
    let displayPrice;
    let displaySuffix;
    if (globalPricingMode === 'per_tray' && pricing.hasTray) {
      displayPrice = pricing.trayPrice;
      displaySuffix = '/tray';
    } else if (globalPricingMode === 'per_pax' && pricing.hasPerPax) {
      displayPrice = pricing.perPaxPrice;
      displaySuffix = '/pax';
    } else if (pricing.hasTray) {
      displayPrice = pricing.trayPrice;
      displaySuffix = '/tray';
    } else {
      displayPrice = pricing.perPaxPrice;
      displaySuffix = '/pax';
    }

    // ⭐ Cart quantity for the CURRENT pricing view only
    const cartQuantity = getItemQuantity(itemId, globalPricingMode);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.gridCard, { backgroundColor: colors.card }]}
        onPress={() => openMenuItemDetail(item)}
      >
        <View style={styles.gridImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.gridImage} />
          {item.is_popular && (
            <View style={styles.gridPopularBadge}>
              <MaterialCommunityIcons name="fire" size={10} color="#FF6B9D" />
              <Text style={styles.gridPopularText}>Popular</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.gridFavoriteButton}
            onPress={() => toggleFavorite(itemId)}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? '#FF6B9D' : '#fff'}
            />
          </TouchableOpacity>

          {/* ⭐ Food allergy warning badge */}
          {(() => {
            const matches = getMatchingAllergies(item, customerAllergies);
            if (matches.length === 0) return null;
            return (
              <View style={styles.gridAllergyBadge}>
                <MaterialCommunityIcons name="alert" size={10} color="#FFF" />
                <Text style={styles.gridAllergyBadgeText}>
                  {matches.length} allergen{matches.length > 1 ? 's' : ''}
                </Text>
              </View>
            );
          })()}
          <TouchableOpacity
            style={[styles.gridCartButton, cartQuantity > 0 && styles.gridCartButtonActive]}
            onPress={() => handleQuickAdd(item)}
          >
            {cartQuantity > 0 ? (
              <View style={styles.gridCartQuantity}>
                <Feather name="shopping-bag" size={14} color="#fff" />
                <Text style={styles.gridCartQuantityText}>{cartQuantity}</Text>
              </View>
            ) : (
              <Feather name="shopping-bag" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.gridInfo}>
          <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.gridRating}>
            {renderStars(item.rating || 0, 12)}
            <Text style={styles.gridRatingText}>({item.rating || 0})</Text>
          </View>
          <View style={styles.gridPriceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gridPrice} numberOfLines={1}>
                ₱{displayPrice}
                {displaySuffix}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // LIST MENU ITEM
  // ============================================================

  const ListMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id]
      ? getRandomBannerImage()
      : item.image_url || item.image || getRandomBannerImage();

    const isFavorite = favorites.includes(item.menu_item_id || item.id);
    const itemId = item.menu_item_id || item.id;
    const pricing = normalizePricing(item);

    let displayPrice;
    let displaySuffix;
    if (globalPricingMode === 'per_tray' && pricing.hasTray) {
      displayPrice = pricing.trayPrice;
      displaySuffix = '/tray';
    } else if (globalPricingMode === 'per_pax' && pricing.hasPerPax) {
      displayPrice = pricing.perPaxPrice;
      displaySuffix = '/pax';
    } else if (pricing.hasTray) {
      displayPrice = pricing.trayPrice;
      displaySuffix = '/tray';
    } else {
      displayPrice = pricing.perPaxPrice;
      displaySuffix = '/pax';
    }

    const cartQuantity = getItemQuantity(itemId, globalPricingMode);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.listCard, { backgroundColor: colors.card }]}
        onPress={() => openMenuItemDetail(item)}
      >
        <View style={styles.listImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.listImage} />
          {item.is_popular && (
            <View style={styles.listPopularBadge}>
              <MaterialCommunityIcons name="fire" size={10} color="#FF6B9D" />
              <Text style={styles.listPopularText}>Popular</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.listCartButton, cartQuantity > 0 && styles.listCartButtonActive]}
            onPress={() => handleQuickAdd(item)}
          >
            {cartQuantity > 0 ? (
              <View style={styles.listCartQuantity}>
                <Feather name="shopping-bag" size={12} color="#fff" />
                <Text style={styles.listCartQuantityText}>{cartQuantity}</Text>
              </View>
            ) : (
              <Feather name="shopping-bag" size={14} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.listInfo}>
          <View style={styles.listHeader}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
                      <TouchableOpacity onPress={() => toggleFavorite(itemId)}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? '#FF6B9D' : '#ccc'}
              />
            </TouchableOpacity>
          </View>

          {/* ⭐ Food allergy warning line */}
          {(() => {
            const matches = getMatchingAllergies(item, customerAllergies);
            if (matches.length === 0) return null;
            return (
              <View style={styles.listAllergyBadge}>
                <MaterialCommunityIcons name="alert" size={12} color="#FFF" />
                <Text style={styles.listAllergyBadgeText} numberOfLines={1}>
                  Contains: {matches.map((m) => humanizeAllergen(m)).join(', ')}
                </Text>
              </View>
            );
          })()}

          <Text
            style={[styles.listDescription, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {item.description || 'Delicious dish prepared with love'}
          </Text>

          <View style={styles.listMeta}>
            <View style={styles.listMetaItem}>
              <Feather name="clock" size={12} color="#B0B0B0" />
              <Text style={styles.listMetaText}>{item.prep_time_minutes || 0} min</Text>
            </View>
            <View style={styles.listMetaItem}>{renderStars(item.rating || 0, 12)}</View>
          </View>

          <View style={styles.listPriceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listPrice} numberOfLines={1}>
                ₱{displayPrice}
                {displaySuffix}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // PACKAGE / PROMOTION CARDS
  // ============================================================

  const PackageCard = ({ item }) => {
    const imageUrl = getThemedBannerImage(item.name);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.packageCard, { backgroundColor: colors.card }]}
        onPress={() => openPackageDetail(item)}
      >
        <Image source={{ uri: imageUrl }} style={styles.packageImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.packageOverlay}
        >
          <Text style={styles.packageName}>{item.name}</Text>
          <Text style={styles.packagePrice}>₱{item.base_price_per_pax || 0}/pax</Text>
          <View style={styles.packageFeatures}>
            <Text style={styles.packageFeature}>
              {item.min_pax || 0} - {item.max_pax || 0} pax
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const PromotionCard = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.promotionCard, { backgroundColor: colors.card }]}
      onPress={() =>
        navigation.navigate('PromotionDetail', {
          promotionId: item.promotion_id || item.id,
        })
      }
    >
      <Image source={{ uri: getRandomBannerImage() }} style={styles.promotionImage} />
      <View style={styles.promotionInfo}>
        <View style={styles.promotionDiscountBadge}>
          <Text style={styles.promotionDiscountText}>
            {item.discount_type === 'percentage'
              ? `${item.discount_value}% OFF`
              : `₱${item.discount_value} OFF`}
          </Text>
        </View>
        <Text style={[styles.promotionName, { color: colors.text }]}>{item.name}</Text>
        <Text
          style={[styles.promotionDescription, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.description || 'Special promotion available now'}
        </Text>
        <Text style={styles.promotionValidity}>
          Valid until:{' '}
          {item.valid_until ? new Date(item.valid_until).toLocaleDateString() : 'Ongoing'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const CategoryItem = ({ item, isSelected, onPress }) => (
    <TouchableOpacity
      style={[styles.categoryItem, isSelected && styles.categoryItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.categoryName, { color: isSelected ? '#FFF' : colors.textSecondary }]}
      >
        {typeof item.name === 'string' ? item.name : item.name?.name || 'Category'}
      </Text>
      {isSelected && <View style={styles.categoryActiveIndicator} />}
    </TouchableOpacity>
  );

  const TabItem = ({ label, value, isSelected, onPress }) => (
    <TouchableOpacity
      style={[styles.tabItem, isSelected && styles.tabItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabLabel, { color: isSelected ? '#FF6B9D' : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ============================================================
  // GLOBAL PRICING MODE TOGGLE
  // ============================================================

  const GlobalPricingToggle = () => {
    return (
      <View style={styles.globalPricingWrapper}>
        <Text style={styles.globalPricingLabel}>Pricing View</Text>
        <View style={styles.globalPricingToggle}>
          <TouchableOpacity
            style={[
              styles.globalPricingOption,
              globalPricingMode === 'per_tray' && styles.globalPricingOptionActive,
            ]}
            onPress={() => {
              setGlobalPricingMode('per_tray');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="food-turkey"
              size={14}
              color={globalPricingMode === 'per_tray' ? '#FFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.globalPricingOptionText,
                globalPricingMode === 'per_tray' && styles.globalPricingOptionTextActive,
              ]}
            >
              Food Tray
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.globalPricingOption,
              globalPricingMode === 'per_pax' && styles.globalPricingOptionActive,
            ]}
            onPress={() => {
              setGlobalPricingMode('per_pax');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people"
              size={14}
              color={globalPricingMode === 'per_pax' ? '#FFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.globalPricingOptionText,
                globalPricingMode === 'per_pax' && styles.globalPricingOptionTextActive,
              ]}
            >
              Per Pax
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ============================================================
  // HEADER
  // ============================================================

  const HeaderComponent = () => {
    const canScrollLeft = categoryScrollOffset > 10;
    const canScrollRight =
      categoryContentWidth > 0 &&
      categoryScrollOffset < categoryContentWidth - SCREEN_WIDTH + 40;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.heroSection}>
          <View>
            <Text style={styles.heroTitle}>Our Menu</Text>
            <Text style={styles.heroSubtitle}>Discover our signature dishes</Text>
          </View>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Feather name="search" size={20} color="#B0B0B0" />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor="#B0B0B0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color="#B0B0B0" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowFilters(true)}>
            <Feather name="sliders" size={20} color="#FF6B9D" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TabItem
            label="Menu"
            value="menu"
            isSelected={selectedTab === 'menu'}
            onPress={() => setSelectedTab('menu')}
          />
          <TabItem
            label="Packages"
            value="packages"
            isSelected={selectedTab === 'packages'}
            onPress={() => setSelectedTab('packages')}
          />
          <TabItem
            label="Promotions"
            value="promotions"
            isSelected={selectedTab === 'promotions'}
            onPress={() => setSelectedTab('promotions')}
          />
        </View>

        {selectedTab === 'menu' && <GlobalPricingToggle />}

        {selectedTab === 'menu' && categories.length > 0 && (
          <View style={styles.categoriesWrapper}>
            <View style={styles.categoriesContainer}>
              {canScrollLeft && (
                <View style={[styles.scrollIndicator, styles.scrollIndicatorLeft]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
                    style={styles.scrollIndicatorGradient}
                  >
                    <Feather name="chevron-left" size={16} color="#FF6B9D" />
                  </LinearGradient>
                </View>
              )}

              <FlatList
                ref={categoryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categories}
                keyExtractor={(item, index) => {
                  const rawId = item.category_id || item.id;
                  return `category-${rawId && typeof rawId !== 'object' ? rawId : index}`;
                }}
                contentContainerStyle={styles.categoriesList}
                renderItem={({ item, index }) => {
                  const rawId = item.category_id || item.id;
                  const categoryId =
                    rawId && typeof rawId !== 'object'
                      ? rawId
                      : index === 0
                      ? 'all'
                      : `category-${index}`;
                  return (
                    <CategoryItem
                      item={item}
                      isSelected={selectedCategory === categoryId}
                      onPress={() => setSelectedCategory(categoryId)}
                    />
                  );
                }}
                onScroll={(event) => {
                  setCategoryScrollOffset(event.nativeEvent.contentOffset.x);
                }}
                onContentSizeChange={(contentWidth) => {
                  setCategoryContentWidth(contentWidth);
                }}
                scrollEventThrottle={16}
              />

              {canScrollRight && (
                <View style={[styles.scrollIndicator, styles.scrollIndicatorRight]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
                    style={styles.scrollIndicatorGradient}
                  >
                    <Feather name="chevron-right" size={16} color="#FF6B9D" />
                  </LinearGradient>
                </View>
              )}
            </View>
          </View>
        )}

        {selectedTab === 'menu' && filteredMenuItems.length > 0 && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultCount}>{filteredMenuItems.length} items found</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]}
                onPress={() => setViewMode('grid')}
              >
                <Feather name="grid" size={16} color={viewMode === 'grid' ? '#FF6B9D' : '#B0B0B0'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]}
                onPress={() => setViewMode('list')}
              >
                <Feather name="list" size={16} color={viewMode === 'list' ? '#FF6B9D' : '#B0B0B0'} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {selectedTab === 'packages' && filteredPackages.length > 0 && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultCount}>{filteredPackages.length} packages found</Text>
          </View>
        )}

        {selectedTab === 'promotions' && filteredPromotions.length > 0 && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultCount}>
              {filteredPromotions.length} promotions found
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ============================================================
  // CUSTOM ALERT MODAL
  // ============================================================

  const CustomAlertModal = () => {
    const alertColors = getAlertColors(alertConfig.type);
    return (
      <Modal visible={alertVisible} transparent animationType="fade" onRequestClose={closeAlert}>
        <View style={styles.alertOverlay}>
          <View style={[styles.alertContainer, { backgroundColor: '#fff' }]}>
            <View style={[styles.alertIconContainer, { backgroundColor: alertColors.light }]}>
              {alertConfig.icon === 'checkmark' ? (
                <Ionicons name="checkmark-circle" size={56} color={alertColors.main} />
              ) : alertConfig.icon === 'warning' ? (
                <Ionicons name="warning" size={56} color={alertColors.main} />
              ) : alertConfig.icon === 'error' ? (
                <Ionicons name="close-circle" size={56} color={alertColors.main} />
              ) : alertConfig.icon === 'lock' ? (
                <Ionicons name="lock-closed" size={56} color={alertColors.main} />
              ) : alertConfig.icon === 'cart' ? (
                <Ionicons name="cart" size={56} color={alertColors.main} />
              ) : alertConfig.icon === 'trash' ? (
                <Ionicons name="trash" size={56} color={alertColors.main} />
              ) : (
                <Ionicons name="information-circle" size={56} color={alertColors.main} />
              )}
            </View>

            <Text style={[styles.alertTitle, { color: '#333' }]}>{alertConfig.title}</Text>
            <Text style={[styles.alertMessage, { color: '#666' }]}>{alertConfig.message}</Text>

            <View style={styles.alertButtons}>
              {alertConfig.cancelText && (
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertCancelButton]}
                  onPress={handleAlertCancel}
                >
                  <Text style={[styles.alertButtonText, { color: '#666' }]}>
                    {alertConfig.cancelText}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.alertButton,
                  styles.alertConfirmButton,
                  { backgroundColor: alertColors.main },
                ]}
                onPress={handleAlertConfirm}
              >
                <Text style={[styles.alertButtonText, { color: '#fff' }]}>
                  {alertConfig.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // MENU ITEM DETAIL MODAL
  // ============================================================

  const MenuItemDetailModal = () => {
    if (!selectedMenuItem) return null;

    const item = selectedMenuItem;
    const imageUrl = imageErrors[item.id]
      ? getRandomBannerImage()
      : item.image_url || item.image || getRandomBannerImage();

    const dietaryInfo = item.dietary_info || item.dietary_information || item.dietary;
    const allergyInfo =
      item.allergy_info || item.allergy_information || item.allergies || item.food_allergy;

    const pricing = normalizePricing(item);
    const activeMode = resolveMode(item, globalPricingMode);
    const activePrice = effectivePrice(item, activeMode);
    const lineTotal = activePrice * detailQuantity;
    const isTray = activeMode === 'per_tray';

    const trayDescText =
      pricing.trayDisplayDescription ||
      pricing.trayDescription ||
      (pricing.trayMinPax || pricing.trayMaxPax
        ? `Good for ${pricing.trayMinPax} - ${pricing.trayMaxPax} pax`
        : `Good for ${pricing.trayServings} servings`);

    return (
      <Modal
        visible={!!selectedMenuItem}
        transparent
        animationType="slide"
        onRequestClose={closeMenuItemDetail}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: colors.background }]}>
            <TouchableOpacity style={styles.detailCloseButton} onPress={closeMenuItemDetail}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.detailImageContainer}>
                <Image source={{ uri: imageUrl }} style={styles.detailImage} />
                {item.is_popular && (
                  <View style={styles.detailPopularBadge}>
                    <MaterialCommunityIcons name="fire" size={14} color="#FF6B9D" />
                    <Text style={styles.detailPopularText}>Popular</Text>
                  </View>
                )}
                <View style={styles.detailModeBadge}>
                  <Ionicons
                    name={isTray ? 'cube-outline' : 'people'}
                    size={12}
                    color="#FFF"
                  />
                  <Text style={styles.detailModeBadgeText}>
                    {isTray ? 'Food Tray Price' : 'Per Pax Price'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailContent}>
                <Text style={[styles.detailName, { color: colors.text }]}>{item.name}</Text>

                               <Text style={[styles.detailPrice, { color: '#FF6B9D' }]}>
                  ₱{activePrice}
                  {isTray ? '/tray' : '/pax'}
                </Text>

                {/* ⭐ Allergy warning panel */}
                {(() => {
                  const matches = getMatchingAllergies(item, customerAllergies);
                  if (matches.length === 0) return null;
                  return (
                    <View style={styles.detailAllergyWarningPanel}>
                      <View style={styles.detailAllergyWarningHeader}>
                        <MaterialCommunityIcons name="alert-circle" size={20} color="#B71C1C" />
                        <Text style={styles.detailAllergyWarningTitle}>
                          Contains your selected aller{matches.length > 1 ? 'gens' : 'gen'}
                        </Text>
                      </View>
                      <View style={styles.detailAllergyWarningTags}>
                        {matches.map((slug) => (
                          <View key={slug} style={styles.detailAllergyWarningTag}>
                            <Text style={styles.detailAllergyWarningTagText}>
                              ⚠ {humanizeAllergen(slug)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.detailAllergyWarningNote}>
                        This dish may not be suitable for you. Please contact the
                        kitchen before ordering.
                      </Text>
                    </View>
                  );
                })()}

                {isTray && trayDescText ? (
                  <View style={styles.trayDescriptionBox}>
                    <Ionicons name="people" size={16} color="#FF6B9D" />
                    <Text style={styles.trayDescriptionText}>{trayDescText}</Text>
                  </View>
                ) : null}

                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Description
                  </Text>
                  <Text style={[styles.detailDescription, { color: colors.textSecondary }]}>
                    {item.description || 'No description available.'}
                  </Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Dietary
                  </Text>
                  {(() => {
                    // ⭐ Prefer the server-built list; fall back to the flags.
                    let list = Array.isArray(dietaryInfo) ? dietaryInfo : [];
                    if (list.length === 0) {
                      list = [];
                      if (item.is_vegetarian)  list.push('Vegetarian');
                      if (item.is_vegan)       list.push('Vegan');
                      if (item.is_gluten_free) list.push('Gluten-Free');
                      if (item.is_halal)       list.push('Halal');
                    } else if (typeof dietaryInfo === 'string' && dietaryInfo.trim()) {
                      list = [dietaryInfo];
                    }

                    if (list.length === 0) {
                      return (
                        <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                          No dietary information available
                        </Text>
                      );
                    }

                    return (
                      <View style={styles.detailDietaryContainer}>
                        {list.map((diet, index) => (
                          <View key={`${diet}-${index}`} style={styles.detailDietaryTag}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.detailDietaryText}>{diet}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>

                        <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Food Allergy
                  </Text>
                  {(() => {
                    // ⭐ Prefer the new aliases the backend now returns.
                    const raw =
                      item.allergy_info ??
                      item.allergy_information ??
                      item.allergens_array ??
                      item.allergens ??
                      item.allergies ??
                      null;

                    const list = Array.isArray(raw)
                      ? raw
                      : (typeof raw === 'string'
                          ? raw.split(',').map((s) => s.trim()).filter(Boolean)
                          : []);

                    if (list.length === 0) {
                      return (
                        <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                          No allergy information available
                        </Text>
                      );
                    }

                    return (
                      <View style={styles.detailAllergyContainer}>
                        {list.map((allergy, index) => (
                          <View key={`${allergy}-${index}`} style={styles.detailAllergyTag}>
                            <Ionicons name="warning" size={16} color="#FF4444" />
                            <Text style={styles.detailAllergyText}>
                              {humanizeAllergen(allergy)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>
                <View style={styles.quantitySection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Quantity
                  </Text>
                  <View style={styles.quantityStepper}>
                    <TouchableOpacity
                      style={[
                        styles.quantityButton,
                        detailQuantity <= 1 && styles.quantityButtonDisabled,
                      ]}
                      onPress={() => {
                        if (detailQuantity > 1) {
                          setDetailQuantity(detailQuantity - 1);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                      disabled={detailQuantity <= 1}
                    >
                      <Feather
                        name="minus"
                        size={20}
                        color={detailQuantity <= 1 ? '#B0B0B0' : '#FF6B9D'}
                      />
                    </TouchableOpacity>

                    <TextInput
                      style={styles.quantityInput}
                      value={String(detailQuantity)}
                      keyboardType="number-pad"
                      onChangeText={(text) => {
                        const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(n) && n >= 1) {
                          setDetailQuantity(Math.min(n, 999));
                        } else if (text === '') {
                          setDetailQuantity(1);
                        }
                      }}
                      maxLength={3}
                    />

                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        if (detailQuantity < 999) {
                          setDetailQuantity(detailQuantity + 1);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                    >
                      <Feather name="plus" size={20} color="#FF6B9D" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.detailAddToCartWrapper}>
                  <TouchableOpacity
                    style={styles.detailAddToCartButton}
                    onPress={() => handleAddToCartFromModal(item, detailQuantity)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#FF6B9D', '#FF8FB1']}
                      style={styles.detailAddToCartGradient}
                    >
                      <Feather name="shopping-bag" size={20} color="#fff" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailAddToCartText}>
                          Add {detailQuantity} to Cart
                        </Text>
                        <Text style={styles.detailAddToCartSubText}>
                          ₱{activePrice} × {detailQuantity}
                          {isTray ? ' tray' : ' pax'}
                        </Text>
                      </View>
                      <Text style={styles.detailAddToCartPrice}>₱{lineTotal}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // PACKAGE DETAIL MODAL
  // ============================================================

  const PackageDetailModal = () => {
    if (!selectedPackage) return null;
    const pkg = selectedPackage;

    return (
      <Modal
        visible={!!selectedPackage}
        transparent
        animationType="slide"
        onRequestClose={closePackageDetail}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: colors.background }]}>
            <TouchableOpacity style={styles.detailCloseButton} onPress={closePackageDetail}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.packageDetailHeader}>
                <Image
                  source={{ uri: getThemedBannerImage(pkg.name) }}
                  style={styles.packageDetailImage}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)']}
                  style={styles.packageDetailOverlay}
                >
                  <Text style={styles.packageDetailName}>{pkg.name}</Text>
                  <Text style={styles.packageDetailPrice}>
                    ₱{pkg.base_price_per_pax || 0}/pax
                  </Text>
                  <Text style={styles.packageDetailPax}>
                    {pkg.min_pax || 0} - {pkg.max_pax || 0} persons
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.detailContent}>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Description
                  </Text>
                  <Text style={[styles.detailDescription, { color: colors.textSecondary }]}>
                    {pkg.description || 'No description available.'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Included Menu Items
                  </Text>
                  {loadingPackageItems ? (
                    <View style={styles.packageItemsLoader}>
                      <ActivityIndicator size="small" color="#FF6B9D" />
                    </View>
                  ) : packageItems.length > 0 ? (
                    <View style={styles.packageItemsList}>
                      {packageItems.map((item, index) => {
                        const menuItem = item.menu_item || item;
                        const itemId = menuItem.menu_item_id || menuItem.id;
                        const imgUrl = imageErrors[itemId]
                          ? getRandomBannerImage()
                          : menuItem.image_url || menuItem.image || getRandomBannerImage();
                        return (
                          <View
                            key={index}
                            style={[
                              styles.packageMenuItem,
                              { borderBottomColor: colors.border || '#eee' },
                            ]}
                          >
                            <View style={styles.packageMenuItemHeader}>
                              <Image
                                source={{ uri: imgUrl }}
                                style={styles.packageMenuItemImage}
                              />
                              <View style={styles.packageMenuItemInfo}>
                                <Text
                                  style={[
                                    styles.packageMenuItemName,
                                    { color: colors.text },
                                  ]}
                                >
                                  {menuItem.name || 'Menu Item'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                      No items included in this package.
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // FILTER MODAL
  // ============================================================

  const FilterModal = () => (
    <Modal
      visible={showFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter & Sort</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
              <View style={styles.sortOptions}>
                {['popular', 'price_low', 'price_high', 'rating'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.sortOption, sortBy === option && styles.sortOptionActive]}
                    onPress={() => setSortBy(option)}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        sortBy === option && styles.sortOptionTextActive,
                      ]}
                    >
                      {option === 'popular' && 'Popular'}
                      {option === 'price_low' && 'Price: Low to High'}
                      {option === 'price_high' && 'Price: High to Low'}
                      {option === 'rating' && 'Top Rated'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyFilterButton}
              onPress={() => setShowFilters(false)}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.applyFilterGradient}
              >
                <Text style={styles.applyFilterText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'packages':
        return (
          <FlatList
            data={filteredPackages}
            renderItem={({ item }) => <PackageCard item={item} />}
            keyExtractor={(item, index) => `package-${item.package_id || item.id || index}`}
            contentContainerStyle={styles.packagesList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="package-variant" size={60} color="#B0B0B0" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No packages found
                </Text>
              </View>
            }
          />
        );

      case 'promotions':
        return (
          <FlatList
            data={filteredPromotions}
            renderItem={({ item }) => <PromotionCard item={item} />}
            keyExtractor={(item, index) => `promotion-${item.promotion_id || item.id || index}`}
            contentContainerStyle={styles.promotionsList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="tag" size={60} color="#B0B0B0" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No promotions found
                </Text>
              </View>
            }
          />
        );

      default:
        return (
          <FlatList
            data={sortedItems}
            renderItem={({ item }) =>
              viewMode === 'grid' ? <GridMenuItem item={item} /> : <ListMenuItem item={item} />
            }
            keyExtractor={(item, index) => `menu-${item.menu_item_id || item.id || index}`}
            contentContainerStyle={[
              styles.menuList,
              viewMode === 'grid' && styles.menuListGrid,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />
            }
            numColumns={viewMode === 'grid' ? 2 : 1}
            key={viewMode}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="food-off" size={60} color="#B0B0B0" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No items found
                </Text>
              </View>
            }
          />
        );
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <HeaderComponent />
      <Animated.View style={{ flex: 1 }}>{renderContent()}</Animated.View>

      <MenuItemDetailModal />
      <PackageDetailModal />
      <FilterModal />
      <CustomAlertModal />
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  headerContainer: { paddingHorizontal: 16, paddingTop: 8 },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#FF6B9D', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 14, color: '#8A8A8E', fontWeight: '500', marginTop: 2 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },

  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },

  globalPricingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  globalPricingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  globalPricingToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 3,
  },
  globalPricingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  globalPricingOptionActive: {
    backgroundColor: '#FF6B9D',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  globalPricingOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  globalPricingOptionTextActive: { color: '#FFF' },

  categoriesWrapper: { marginBottom: 16 },
  categoriesContainer: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  categoriesList: { gap: 8, paddingHorizontal: 16 },
  categoryItem: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  categoryItemActive: {
    backgroundColor: '#FF6B9D',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryName: { fontSize: 13, fontWeight: '600' },
  categoryActiveIndicator: {
    position: 'absolute',
    bottom: -4,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: '#FF6B9D',
    borderRadius: 1.5,
  },

  scrollIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  scrollIndicatorLeft: { left: 0 },
  scrollIndicatorRight: { right: 0 },
  scrollIndicatorGradient: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  resultInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultCount: { fontSize: 13, color: '#8A8A8E', fontWeight: '500' },
  viewToggle: { flexDirection: 'row', gap: 4 },
  viewToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewToggleActive: { backgroundColor: '#FFF0F5' },

  menuList: { paddingHorizontal: 16, paddingBottom: 20 },
  menuListGrid: { paddingHorizontal: 8 },
  gridCard: {
    flex: 1,
    margin: 6,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridImageContainer: { position: 'relative' },
  gridImage: { width: '100%', height: 160 },
  gridPopularBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  gridPopularText: { fontSize: 8, fontWeight: '700', color: '#FF6B9D' },
  gridFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCartButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  gridCartButtonActive: { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' },
  gridCartQuantity: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  gridCartQuantityText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  gridInfo: { padding: 10 },
  gridName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  gridRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  gridRatingText: { fontSize: 10, color: '#B0B0B0' },
  gridPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gridPrice: { fontSize: 16, fontWeight: '700', color: '#FF6B9D' },

  listCard: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listImageContainer: { position: 'relative' },
  listImage: { width: 100, height: 100, borderRadius: 12 },
  listPopularBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  listPopularText: { fontSize: 8, fontWeight: '700', color: '#FF6B9D' },
  listCartButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  listCartButtonActive: { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' },
  listCartQuantity: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  listCartQuantityText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  listInfo: { flex: 1, marginLeft: 12 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listName: { fontSize: 16, fontWeight: '600', flex: 1 },
  listDescription: { fontSize: 12, lineHeight: 16, marginBottom: 6 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  listMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listMetaText: { fontSize: 10, color: '#B0B0B0' },
  listPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listPrice: { fontSize: 18, fontWeight: '700', color: '#FF6B9D' },

  packagesList: { paddingHorizontal: 16, paddingBottom: 20 },
  packageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    height: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  packageImage: { width: '100%', height: '100%' },
  packageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  packageName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  packagePrice: { fontSize: 16, fontWeight: '600', color: '#FF6B9D', marginTop: 2 },
  packageFeatures: { flexDirection: 'row', marginTop: 4 },
  packageFeature: { fontSize: 12, color: '#fff', opacity: 0.8 },

  promotionsList: { paddingHorizontal: 16, paddingBottom: 20 },
  promotionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  promotionImage: { width: '100%', height: 120 },
  promotionInfo: { padding: 12 },
  promotionDiscountBadge: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  promotionDiscountText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  promotionName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  promotionDescription: { fontSize: 12, marginBottom: 4 },
  promotionValidity: { fontSize: 10, opacity: 0.6 },

  starsRow: { flexDirection: 'row', gap: 2 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 4 },

  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '92%',
  },
  detailCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailImageContainer: { position: 'relative', height: 220, marginHorizontal: -4 },
  detailImage: { width: '100%', height: '100%' },
  detailPopularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    alignItems: 'center',
  },
  detailPopularText: { fontSize: 12, fontWeight: '700', color: '#FF6B9D' },
  detailModeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,157,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  detailModeBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  detailContent: { padding: 20 },
  detailName: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  detailPrice: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  detailSection: { marginTop: 16 },
  detailSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  detailDescription: { fontSize: 14, lineHeight: 20 },
  detailDietaryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailDietaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  detailDietaryText: { fontSize: 13, color: '#2E7D32', fontWeight: '500' },
  detailAllergyContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailAllergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  detailAllergyText: { fontSize: 13, color: '#C62828', fontWeight: '500' },
  detailFallback: { fontSize: 14, fontStyle: 'italic' },

  trayDescriptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF0F5',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B9D',
  },
  trayDescriptionText: {
    flex: 1,
    fontSize: 13,
    color: '#C2185B',
    fontWeight: '500',
  },

  quantitySection: { marginTop: 20 },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityButtonDisabled: { backgroundColor: '#F0F0F0' },
  quantityInput: {
    minWidth: 52,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    paddingVertical: 4,
  },

  detailAddToCartWrapper: { marginTop: 24, marginBottom: 10 },
  detailAddToCartButton: { borderRadius: 14, overflow: 'hidden' },
  detailAddToCartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  detailAddToCartText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  detailAddToCartSubText: { color: '#FFF', fontSize: 12, opacity: 0.9, marginTop: 1 },
  detailAddToCartPrice: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  alertMessage: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  alertButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCancelButton: { backgroundColor: '#F5F5F5' },
  alertConfirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  alertButtonText: { fontSize: 15, fontWeight: '600' },

  packageDetailHeader: { position: 'relative', height: 200 },
  packageDetailImage: { width: '100%', height: '100%' },
  packageDetailOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  packageDetailName: { fontSize: 24, fontWeight: '700', color: '#fff' },
  packageDetailPrice: { fontSize: 20, fontWeight: '600', color: '#FF6B9D' },
  packageDetailPax: { fontSize: 14, color: '#fff', opacity: 0.8 },
  packageItemsLoader: { alignItems: 'center', paddingVertical: 20 },
  packageItemsList: { gap: 12 },
  packageMenuItem: { paddingVertical: 12, borderBottomWidth: 1 },
  packageMenuItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  packageMenuItemImage: { width: 48, height: 48, borderRadius: 8 },
  packageMenuItemInfo: { marginLeft: 12, flex: 1 },
  packageMenuItemName: { fontSize: 15, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  filterSection: { marginBottom: 24 },
  filterLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  sortOptions: { gap: 8 },
  sortOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  sortOptionActive: { backgroundColor: '#FF6B9D' },
  sortOptionText: { fontSize: 14, color: '#333' },
  sortOptionTextActive: { color: '#FFF' },
  applyFilterButton: { marginTop: 8 },
  applyFilterGradient: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
   applyFilterText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // ⭐ Food allergy warning styles
  gridAllergyBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  gridAllergyBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  listAllergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  listAllergyBadgeText: {
    flex: 1,
    color: '#B71C1C',
    fontSize: 11,
    fontWeight: '600',
  },
  detailAllergyWarningPanel: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    padding: 14,
    marginTop: 14,
    marginBottom: 4,
  },
  detailAllergyWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  detailAllergyWarningTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#B71C1C',
  },
  detailAllergyWarningTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  detailAllergyWarningTag: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  detailAllergyWarningTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D32F2F',
  },
  detailAllergyWarningNote: {
    fontSize: 12,
    lineHeight: 17,
    color: '#7A1F1F',
    fontStyle: 'italic',
  },
});

export default MenuScreen;