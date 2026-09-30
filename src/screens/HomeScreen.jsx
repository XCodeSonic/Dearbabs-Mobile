// src/screens/HomeScreen.jsx
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useAllergies } from '../contexts/AllergyContext';
import { useTheme } from '../contexts/ThemeContext';
import { getMatchingAllergies, humanizeAllergen } from '../utils/allergyHelper';
import { categoryService } from '../services/categoryService';
import { menuService } from '../services/menuService';
import { packageService } from '../services/packageService';
import { promotionService } from '../services/promotionService';
import { reviewAPI } from '../services/api';
import { getRandomBannerImage, getThemedBannerImage } from '../utils/imageHelper';

const { width } = Dimensions.get('window');

// Valid Feather icon names
const validFeatherIcons = {
  grid: 'grid',
  sun: 'sun',
  coffee: 'coffee',
  cake: 'cake',
  moon: 'moon',
  heart: 'heart',
  star: 'star',
  users: 'users',
  calendar: 'calendar',
  search: 'search',
  x: 'x',
  plus: 'plus',
  clock: 'clock',
  'shopping-bag': 'shopping-bag',
};

const BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop',
];

const CUSTOMER_COMMENTS = [
  {
    id: '1',
    name: 'Maria Santos',
    comment: 'The food was absolutely amazing! The flavors were perfectly balanced and the presentation was stunning. Highly recommended!',
    rating: 5,
    date: '2 days ago',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  },
  {
    id: '2',
    name: 'John Reyes',
    comment: 'Best catering service in town! The staff was professional and the food quality exceeded our expectations for our wedding.',
    rating: 5,
    date: '1 week ago',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
  },
  {
    id: '3',
    name: 'Lisa Tan',
    comment: 'Incredible variety and all dishes were delicious. Our corporate event was a huge success thanks to the amazing food.',
    rating: 4,
    date: '2 weeks ago',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
  },
];

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { isGuest, isAuthenticated } = useAuth();
  const { myAllergies } = useAllergies();
  const customerAllergies = React.useMemo(
    () => (Array.isArray(myAllergies) ? myAllergies : []),
    [myAllergies]
  );
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [promoMenuItems, setPromoMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const [imageErrors, setImageErrors] = useState({});
  const [featuredItems, setFeaturedItems] = useState([]);
  const [customerComments, setCustomerComments] = useState([]);
  
  // Category scroll state
  const [categoryScrollOffset, setCategoryScrollOffset] = useState(0);
  const [categoryContentWidth, setCategoryContentWidth] = useState(0);
  const categoryScrollRef = useRef(null);
  
  const bannerFlatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading home data...');
      
      // Load categories
      const categoriesResult = await categoryService.getPublicCategories();
      if (categoriesResult.success) {
        const cats = categoriesResult.data || [];
        const formattedCats = cats.map(cat => ({
          ...cat,
          category_id: cat.category_id || cat.id,
          icon: validFeatherIcons[cat.icon] || 'grid',
        }));
        setCategories([{ category_id: 'all', name: 'All', icon: 'grid' }, ...formattedCats]);
        console.log(`✅ Loaded ${formattedCats.length} categories`);
      }
      
      // Load menu items
      const menuResult = await menuService.getPublicMenuItems({ is_available: true });
      if (menuResult.success) {
        const items = menuResult.data || [];
        setMenuItems(items);
        console.log(`✅ Loaded ${items.length} menu items`);
        
        // Set featured items (popular or first 4 items)
        const featured = items.filter(item => item.is_popular).slice(0, 4);
        setFeaturedItems(featured.length > 0 ? featured : items.slice(0, 4));
        
        // Set promo menu items
        const promoItems = items.filter(item => item.discounted_price).slice(0, 6);
        setPromoMenuItems(promoItems.length > 0 ? promoItems : items.slice(0, 6));
      }
      
      // Load promotions
      const promoResult = await promotionService.getPublicPromotions();
      if (promoResult.success) {
        setPromotions(promoResult.data || []);
        console.log(`✅ Loaded ${promoResult.data?.length || 0} promotions`);
      }
      
      // Load packages
      const packageResult = await packageService.getPublicPackages();
      if (packageResult.success) {
        setPackages(packageResult.data || []);
        console.log(`✅ Loaded ${packageResult.data?.length || 0} packages`);
      }
      
      // Load real customer reviews
      try {
        const reviewsResponse = await reviewAPI.getReviews({ per_page: 10 });
        const rawReviews = reviewsResponse.data?.data || [];
        const reviewsList = Array.isArray(rawReviews) ? rawReviews : (rawReviews.data || []);
        setCustomerComments(reviewsList.map((review, index) => {
          const person = review.booking?.service_event?.customer?.person || review.booking?.serviceEvent?.customer?.person;
          const name = person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() : 'Customer';
          return {
            id: review.review_id || review.id || `review-${index}`,
            name: name || 'Customer',
            comment: review.comment || 'No comment provided.',
            rating: review.overall_rating || review.rating || 0,
            date: review.created_at ? new Date(review.created_at).toLocaleDateString() : '',
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Customer')}&background=FF6B9D&color=fff&size=100&bold=true`,
          };
        }));
      } catch (reviewError) {
        console.log('Reviews not available:', reviewError?.message || reviewError);
        setCustomerComments([]);
      }

    } catch (error) {
      console.error('❌ Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Banner items
  const bannerItems = promotions.length > 0 
    ? promotions.slice(0, 4).map((p, index) => ({
        id: p.promotion_id || p.id || `promo-${index}`,
        name: p.name || 'Promotion',
        image: getRandomBannerImage(),
        discount: p.discount_type === 'percentage' ? `${p.discount_value}% OFF` : `₱${p.discount_value} OFF`,
        price: p.discount_type === 'percentage' ? `₱${(p.original_price || 500) * (1 - p.discount_value / 100)}` : `₱${(p.original_price || 500) - p.discount_value}`,
        chef: 'Promo',
        type: 'promotion',
      }))
    : packages.slice(0, 4).map((p, index) => ({
        id: p.package_id || p.id || `package-${index}`,
        name: p.name || 'Package',
        image: getThemedBannerImage(p.name),
        discount: p.base_price_per_pax ? `₱${p.base_price_per_pax}/pax` : 'Special Package',
        price: p.base_price_per_pax ? `₱${p.base_price_per_pax * 10}` : '₱5,000',
        chef: 'Package',
        type: 'package',
        packageData: p,
      }));

  // Filtered menu items
  const filteredItems = searchQuery 
    ? menuItems.filter(item => 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : selectedCategory === 'all' 
      ? menuItems 
      : menuItems.filter(item => 
          item.category_id === parseInt(selectedCategory) || 
          item.category_id === selectedCategory ||
          item.category?.category_id === parseInt(selectedCategory)
        );

  // Auto-scroll banner
  React.useEffect(() => {
    if (bannerItems.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (activeBanner + 1) % bannerItems.length;
      setActiveBanner(nextIndex);
      bannerFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [activeBanner, bannerItems.length]);

  const handleImageError = (itemId) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  // Render Star Rating
  const renderStars = (rating, size = 14) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <Ionicons key={`star-${i}`} name="star" size={size} color="#FFB800" />
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <Ionicons key={`star-${i}`} name="star-half" size={size} color="#FFB800" />
        );
      } else {
        stars.push(
          <Ionicons key={`star-${i}`} name="star-outline" size={size} color="#ccc" />
        );
      }
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  // Render Banner Item
  const renderBannerItem = ({ item }) => {
    const imageUrl = item.image || getRandomBannerImage();
    
    return (
      <TouchableOpacity 
        key={`banner-${item.id}`}
        activeOpacity={0.9} 
        style={styles.bannerCard} 
        onPress={() => {
          if (item.type === 'package') {
            navigation.navigate('PackageDetail', { packageId: item.packageData?.package_id || item.id });
          } else if (item.type === 'promotion') {
            navigation.navigate('PromotionDetail', { promotionId: item.id });
          } else {
            navigation.navigate('CateringOrder');
          }
        }}
      >
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.bannerImage}
          onError={() => console.log('Banner image error for:', item.name)}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bannerOverlay}
        >
          <View style={styles.bannerDiscount}>
            <Text style={styles.bannerDiscountText}>{item.discount}</Text>
          </View>
          <Text style={styles.bannerName}>{item.name}</Text>
          <Text style={styles.bannerChef}>{item.chef}</Text>
          <Text style={styles.bannerPrice}>{item.price}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render Featured Item
  const renderFeaturedItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    return (
      <TouchableOpacity 
        key={`featured-${item.menu_item_id || item.id}`}
        style={styles.featuredCard}
        onPress={() => navigation.navigate('MenuItemDetail', { itemId: item.menu_item_id || item.id })}
      >
        <Image source={{ uri: imageUrl }} style={styles.featuredImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.featuredOverlay}
        >
          <Text style={styles.featuredName}>{item.name}</Text>
          <Text style={styles.featuredPrice}>₱{item.price}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render Promo Menu Item
  const renderPromoMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    const originalPrice = item.original_price || item.price * 1.2;
    const discountedPrice = item.discounted_price || item.price * 0.8;
    
    return (
      <TouchableOpacity 
        key={`promo-menu-${item.menu_item_id || item.id}`}
        style={[styles.promoMenuItemCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('MenuItemDetail', { itemId: item.menu_item_id || item.id })}
      >
        <View style={styles.promoMenuImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.promoMenuImage} />
          <View style={styles.promoMenuBadge}>
            <Text style={styles.promoMenuBadgeText}>SALE</Text>
          </View>
        </View>
        <View style={styles.promoMenuInfo}>
          <Text style={[styles.promoMenuName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <View style={styles.promoMenuPriceContainer}>
            <Text style={styles.promoMenuOriginalPrice}>₱{originalPrice.toFixed(2)}</Text>
            <Text style={styles.promoMenuDiscountedPrice}>₱{discountedPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.promoMenuMeta}>
            {renderStars(item.rating || 4.5, 10)}
            <Text style={[styles.promoMenuSaveText, { color: colors.textSecondary }]}>
              Save {Math.round((1 - discountedPrice / originalPrice) * 100)}%
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Promotion Item
  const renderPromotionItem = ({ item }) => {
    return (
      <TouchableOpacity 
        key={`promo-${item.promotion_id || item.id}`}
        style={[styles.promotionCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('PromotionDetail', { promotionId: item.promotion_id || item.id })}
      >
        <Image 
          source={{ uri: getRandomBannerImage() }} 
          style={styles.promotionImage}
        />
        <View style={styles.promotionInfo}>
          <View style={styles.promotionDiscountBadge}>
            <Text style={styles.promotionDiscountText}>
              {item.discount_type === 'percentage' ? `${item.discount_value}% OFF` : `₱${item.discount_value} OFF`}
            </Text>
          </View>
          <Text style={[styles.promotionName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.promotionDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description || 'Special promotion available now'}
          </Text>
          <Text style={styles.promotionValidity}>
            Valid until: {item.valid_until ? new Date(item.valid_until).toLocaleDateString() : 'Ongoing'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Package Item
  const renderPackageItem = ({ item }) => {
    const imageUrl = getThemedBannerImage(item.name);
    
    return (
      <TouchableOpacity 
        key={`package-${item.package_id || item.id}`}
        style={[styles.packageCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('PackageDetail', { packageId: item.package_id || item.id })}
      >
        <Image source={{ uri: imageUrl }} style={styles.packageImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.packageOverlay}
        >
          <Text style={styles.packageName}>{item.name}</Text>
          <Text style={styles.packagePrice}>₱{item.base_price_per_pax || 0}/pax</Text>
          <View style={styles.packageFeatures}>
            <Text style={styles.packageFeature}>• {item.min_pax || 0} min</Text>
            <Text style={styles.packageFeature}>• {item.max_pax || 0} max</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render Customer Comment
  const renderCustomerComment = ({ item }) => {
    return (
      <View style={[styles.commentCard, { backgroundColor: colors.card }]}>
        <View style={styles.commentHeader}>
          <Image source={{ uri: item.image }} style={styles.commentAvatar} />
          <View style={styles.commentUserInfo}>
            <Text style={[styles.commentName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.commentDate, { color: colors.textSecondary }]}>{item.date}</Text>
          </View>
          <View style={styles.commentRating}>
            {renderStars(item.rating, 12)}
          </View>
        </View>
        <Text style={[styles.commentText, { color: colors.textSecondary }]}>
          "{item.comment}"
        </Text>
      </View>
    );
  };

  // Render Menu Item
  const renderMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    return (
      <TouchableOpacity
        key={`menu-${item.menu_item_id || item.id}`}
        style={[styles.menuCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('MenuItemDetail', { itemId: item.menu_item_id || item.id })}
      >
        <View style={styles.menuImageContainer}>
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.menuImage}
            onError={() => handleImageError(item.id)}
          />
          {item.is_popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>
        <View style={styles.menuInfo}>
          <View style={styles.menuHeader}>
            <Text style={[styles.menuName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.menuPrice}>₱{item.price}</Text>
          </View>
          <Text style={[styles.menuDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description || 'Delicious dish prepared with love'}
          </Text>
                <View style={styles.menuMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.prep_time_minutes || 15} min
              </Text>
            </View>
            <View style={styles.metaItem}>
              {renderStars(item.rating || 4.5, 12)}
            </View>
          </View>

          {/* ⭐ Food allergy warning line */}
          {(() => {
            const matches = getMatchingAllergies(item, customerAllergies);
            if (matches.length === 0) return null;
            return (
              <View style={styles.homeAllergyBadge}>
                <MaterialCommunityIcons name="alert" size={11} color="#FFF" />
                <Text style={styles.homeAllergyBadgeText} numberOfLines={1}>
                  Contains: {matches.map((m) => humanizeAllergen(m)).join(', ')}
                </Text>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading delicious food...</Text>
      </View>
    );
  }

  // Calculate if categories can scroll
  const canScrollLeft = categoryScrollOffset > 10;
  const canScrollRight = categoryContentWidth > 0 && categoryScrollOffset < categoryContentWidth - width + 40;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* HERO BANNER SECTION */}
        {bannerItems.length > 0 && (
          <View style={styles.bannerSection}>
            <FlatList
              ref={bannerFlatListRef}
              data={bannerItems}
              renderItem={renderBannerItem}
              keyExtractor={(item) => `banner-${item.id}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                setActiveBanner(index);
              }}
              style={styles.bannerList}
            />
            <View style={styles.bannerDots}>
              {bannerItems.map((_, index) => (
                <View key={`dot-${index}`} style={[styles.bannerDot, activeBanner === index && styles.bannerDotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* WELCOME SECTION - Cart removed */}
        <View style={styles.welcomeSection}>
          <View>
            <Text style={[styles.welcomeText, { color: colors.text }]}>
              {isGuest ? 'Welcome, Guest!' : 'Welcome back!'}
            </Text>
            <Text style={[styles.welcomeSubtext, { color: colors.textSecondary }]}>
              {isGuest ? 'Login to order and save your favorites' : 'What would you like to eat today?'}
            </Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Feather name="search" size={20} color={colors.textSecondary} />
          <TextInput 
            style={[styles.searchInput, { color: colors.text }]} 
            placeholder="Search for delicious food..." 
            placeholderTextColor={colors.textSecondary} 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORIES WITH SCROLL INDICATORS */}
        {categories.length > 0 && (
          <View style={styles.categoriesSection}>
            <View style={styles.categoriesContainer}>
              {/* Left scroll indicator */}
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

              <ScrollView
                ref={categoryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesList}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  setCategoryScrollOffset(offsetX);
                }}
                onContentSizeChange={(contentWidth) => {
                  setCategoryContentWidth(contentWidth);
                }}
                scrollEventThrottle={16}
              >
                {categories.map((item, index) => {
                  const rawCategoryId = item.category_id || item.id;
                  const categoryId = rawCategoryId && typeof rawCategoryId !== 'object' ? rawCategoryId : `category-${index}`;
                  const isSelected = selectedCategory === categoryId;
                  
                  return (
                    <TouchableOpacity 
                      key={`cat-${categoryId}`}
                      style={[
                        styles.categoryItem,
                        isSelected && styles.categoryItemActive,
                        { 
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                          borderColor: isSelected ? colors.primary : '#e0e0e0',
                        }
                      ]} 
                      onPress={() => setSelectedCategory(categoryId)}
                    >
                      <Text style={[
                        styles.categoryName,
                        { color: isSelected ? '#fff' : colors.textSecondary }
                      ]}>
                        {typeof item.name === 'string' ? item.name : item.name?.name || 'Category'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Right scroll indicator */}
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

        {/* PROMO MENU SECTION */}
        {promoMenuItems.length > 0 && (
          <View style={styles.promoMenuSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>🔥 Promo Menu</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>Special Offers</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('MenuTab')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={promoMenuItems}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `promo-menu-${item.menu_item_id || item.id}`}
              contentContainerStyle={styles.promoMenuList}
              renderItem={renderPromoMenuItem}
            />
          </View>
        )}

        {/* FEATURED ITEMS */}
        {featuredItems.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Dishes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MenuTab')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={featuredItems}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `featured-${item.menu_item_id || item.id}`}
              contentContainerStyle={styles.featuredList}
              renderItem={renderFeaturedItem}
            />
          </View>
        )}

        {/* PROMOTIONS SECTION */}
        {promotions.length > 0 && (
          <View style={styles.promotionsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Special Promotions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Promotions')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={promotions}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `promo-${item.promotion_id || item.id || index}`}
              contentContainerStyle={styles.promotionsList}
              renderItem={renderPromotionItem}
            />
          </View>
        )}

        {/* PACKAGES SECTION */}
        {packages.length > 0 && (
          <View style={styles.packagesSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Catering Packages</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Packages')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={packages}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `package-${item.package_id || item.id || index}`}
              contentContainerStyle={styles.packagesList}
              renderItem={renderPackageItem}
            />
          </View>
        )}

        {/* CUSTOMER COMMENTS */}
        <View style={styles.commentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What Our Customers Say</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Reviews')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={customerComments}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => `comment-${item.id}`}
            contentContainerStyle={styles.commentsList}
            renderItem={renderCustomerComment}
          />
        </View>

        {/* MENU SECTION */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {searchQuery ? 'Search Results' : "Today's Menu"}
            </Text>
            <Text style={[styles.menuCount, { color: colors.textSecondary }]}>
              {filteredItems.length} items
            </Text>
          </View>
          {filteredItems.length > 0 ? 
            filteredItems.map(item => renderMenuItem({ item })) : 
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="food-off" size={60} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No items found</Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>Try adjusting your search</Text>
            </View>
          }
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Made with love ❤️</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // Banner Styles
  bannerSection: { marginTop: 12, marginBottom: 16 },
  bannerList: { paddingHorizontal: 16 },
  bannerCard: { width: width - 32, height: 200, borderRadius: 24, overflow: 'hidden', marginRight: 12 },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 20,
    paddingBottom: 24,
  },
  bannerDiscount: { 
    position: 'absolute', 
    top: 16, 
    right: 16, 
    backgroundColor: '#ff4444', 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerDiscountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bannerName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  bannerChef: { fontSize: 13, color: '#fff', opacity: 0.8, marginBottom: 4 },
  bannerPrice: { fontSize: 18, fontWeight: 'bold', color: '#ff6b9d' },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 6 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  bannerDotActive: { width: 28, backgroundColor: '#ff6b9d' },
  
  // Welcome Section - Cart removed
  welcomeSection: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  welcomeText: { fontSize: 24, fontWeight: '700' },
  welcomeSubtext: { fontSize: 14, marginTop: 2, opacity: 0.7 },
  
  // Search Styles
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderRadius: 16, 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 10 },
  
  // Categories Styles with Scroll Indicators
  categoriesSection: { marginBottom: 24 },
  categoriesContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  categoriesList: { paddingHorizontal: 16, gap: 8 },
  categoryItem: { 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 20, 
    marginRight: 8,
    borderWidth: 1.5,
  },
  categoryItemActive: { 
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryName: { fontSize: 14, fontWeight: '600' },
  
  // Scroll Indicators
  scrollIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  scrollIndicatorLeft: {
    left: 0,
  },
  scrollIndicatorRight: {
    right: 0,
  },
  scrollIndicatorGradient: {
    width: 32,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Promo Menu Section
  promoMenuSection: { marginBottom: 24, paddingHorizontal: 20 },
  promoMenuList: { gap: 12 },
  promoMenuItemCard: { 
    width: 160, 
    borderRadius: 16, 
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  promoMenuImageContainer: { position: 'relative' },
  promoMenuImage: { width: '100%', height: 120 },
  promoMenuBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: '#ff4444', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 8,
  },
  promoMenuBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  promoMenuInfo: { padding: 10 },
  promoMenuName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  promoMenuPriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  promoMenuOriginalPrice: { fontSize: 11, textDecorationLine: 'line-through', opacity: 0.5 },
  promoMenuDiscountedPrice: { fontSize: 15, fontWeight: 'bold', color: '#ff4444' },
  promoMenuMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  promoMenuSaveText: { fontSize: 9, opacity: 0.6 },
  sectionBadge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Featured Section
  featuredSection: { marginBottom: 24 },
  featuredList: { paddingHorizontal: 16, gap: 12 },
  featuredCard: { 
    width: 150, 
    height: 180, 
    borderRadius: 20, 
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredImage: { width: '100%', height: '100%' },
  featuredOverlay: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 12,
  },
  featuredName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  featuredPrice: { fontSize: 16, fontWeight: 'bold', color: '#ff6b9d' },
  
  // Promotions Section
  promotionsSection: { marginBottom: 24, paddingHorizontal: 20 },
  promotionsList: { gap: 12 },
  promotionCard: { 
    width: 280, 
    borderRadius: 16, 
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  promotionImage: { width: '100%', height: 120 },
  promotionInfo: { padding: 12 },
  promotionDiscountBadge: { 
    backgroundColor: '#ff4444', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  promotionDiscountText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  promotionName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  promotionDescription: { fontSize: 12, marginBottom: 4 },
  promotionValidity: { fontSize: 10, opacity: 0.6 },
  
  // Packages Section
  packagesSection: { marginBottom: 24, paddingHorizontal: 20 },
  packagesList: { gap: 12 },
  packageCard: { 
    width: 220, 
    height: 180, 
    borderRadius: 16, 
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  packageImage: { width: '100%', height: '100%' },
  packageOverlay: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 12,
  },
  packageName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  packagePrice: { fontSize: 14, fontWeight: 'bold', color: '#ff6b9d', marginTop: 2 },
  packageFeatures: { flexDirection: 'row', gap: 8, marginTop: 4 },
  packageFeature: { fontSize: 10, color: '#fff', opacity: 0.8 },
  
  // Comments Section
  commentsSection: { marginBottom: 24, paddingHorizontal: 20 },
  commentsList: { gap: 12 },
  commentCard: { 
    width: 300, 
    padding: 16, 
    borderRadius: 16, 
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  commentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  commentUserInfo: { flex: 1 },
  commentName: { fontSize: 14, fontWeight: '600' },
  commentDate: { fontSize: 10, opacity: 0.6 },
  commentRating: { marginLeft: 'auto' },
  commentText: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  
  // Menu Section
  menuSection: { paddingHorizontal: 20, marginBottom: 16 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  seeAllText: { fontSize: 13, color: '#ff6b9d', fontWeight: '600' },
  menuCount: { fontSize: 13, opacity: 0.7 },
  menuCard: { 
    flexDirection: 'row', 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuImageContainer: { position: 'relative' },
  menuImage: { width: 100, height: 100, borderRadius: 12 },
  popularBadge: { 
    position: 'absolute', 
    top: 6, 
    left: 6, 
    backgroundColor: 'rgba(255,107,157,0.9)',
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 10,
  },
  popularText: { fontSize: 9, color: '#fff', fontWeight: '600' },
  menuInfo: { flex: 1, marginLeft: 14, justifyContent: 'space-between' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuName: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  menuPrice: { fontSize: 16, fontWeight: '700', color: '#ff6b9d' },
  menuDescription: { fontSize: 12, lineHeight: 16, marginVertical: 4 },
  menuMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  starsRow: { flexDirection: 'row', gap: 2 },

  homeAllergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  homeAllergyBadgeText: {
    flex: 1,
    fontSize: 10,
    color: '#B71C1C',
    fontWeight: '600',
  },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText: { fontSize: 16, marginTop: 12, fontWeight: '500' },
  emptyStateSubtext: { fontSize: 13, marginTop: 4, opacity: 0.7 },
  
  footer: { paddingVertical: 30, alignItems: 'center' },
  footerText: { fontSize: 14, opacity: 0.6 },
});

export default HomeScreen;