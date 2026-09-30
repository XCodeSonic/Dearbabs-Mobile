// src/screens/BookingScreen.jsx — COMPLETE
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
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
    SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { bookingAPI } from '../services/api';
import { menuService } from '../services/menuService';
import { packageService } from '../services/packageService';
import { promotionService } from '../services/promotionService';
import { bookingService } from '../services/bookingService';

const { width, height } = Dimensions.get('window');

// ============================================================
// CONSTANTS
// ============================================================
const MEAL_TYPES = [
    { id: 'breakfast', label: 'Breakfast', icon: 'coffee', time: '7:00 AM - 9:00 AM', color: '#FF6B9D' },
    { id: 'snack1', label: 'Morning Snack', icon: 'food-apple', time: '10:00 AM - 11:00 AM', color: '#4CAF50' },
    { id: 'lunch', label: 'Lunch', icon: 'food', time: '12:00 PM - 2:00 PM', color: '#FF6B9D' },
    { id: 'snack2', label: 'Afternoon Snack', icon: 'food-apple', time: '3:00 PM - 4:00 PM', color: '#2196F3' },
    { id: 'dinner', label: 'Dinner', icon: 'food-variant', time: '6:00 PM - 8:00 PM', color: '#9C27B0' },
];

const SERVICE_TYPES = [
    { id: 'buffet', label: 'Buffet Service', icon: 'silverware-fork-knife', description: 'Full buffet setup with equipment', color: '#FF6B9D' },
    { id: 'packed', label: 'Packed Meals', icon: 'food', description: 'Individual packed meals', color: '#4CAF50' },
    { id: 'tray', label: 'Tray Service', icon: 'tray', description: 'Family-style food trays', color: '#FF9800' },
];

const DEFAULT_MEAL_SERVICE = {
    id: null,
    meal_type: 'lunch',
    day_number: 1,
    pax: 0,
    price_per_head: 0,
    serving_time: '12:00 PM',
    serving_time_date: new Date(2024, 0, 1, 12, 0, 0),
    menu_items: [],
    notes: '',
};

// ============================================================
// HELPERS
// ============================================================
const getCategoryName = (category) => {
    if (!category) return 'Uncategorized';
    if (typeof category === 'string') return category;
    return category.name || category.category_name || category.slug || 'Uncategorized';
};

const normalizeMenuForSelector = (item, index = 0) => {
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
        ...item,
        id: `menu-${item.menu_item_id || item.id || index}`,
        menu_item_id: item.menu_item_id || item.id,
        source_type: 'menu',
        item_type: 'menu_item',
        name: item.name || 'Unnamed Item',
        price: perPaxPrice,
        category: getCategoryName(item.category || item.category_name),
        pricing_type: pricingType,
        per_pax_price: perPaxPrice,
        tray_price: trayPrice,
        tray_servings: trayServings,
        tray_min_pax: trayMinPax,
        tray_max_pax: trayMaxPax,
        tray_description: item.tray_description || '',
        has_tray_pricing: hasTray,
        has_per_pax_pricing: hasPerPax,
    };
};

const normalizePackageForSelector = (item, index = 0) => ({
    ...item,
    id: `package-${item.package_id || item.id || index}`,
    package_id: item.package_id || item.id,
    source_type: 'package',
    item_type: 'package',
    name: item.name || 'Package',
    price: parseFloat(item.base_price_per_pax || item.price_per_head || item.price) || 0,
    category: 'Packages',
    has_tray_pricing: false,
    has_per_pax_pricing: true,
    // ⭐ Ensure menu_items array survives normalization (used by the view-details modal)
    menu_items: Array.isArray(item.menu_items) ? item.menu_items : [],
});

const normalizePromotionForSelector = (item, index = 0) => ({
    ...item,
    id: `promotion-${item.promotion_id || item.id || index}`,
    promotion_id: item.promotion_id || item.id,
    source_type: 'promotion',
    item_type: 'promotion',
    name: item.name || 'Promotion',
    price: parseFloat(item.discounted_price || item.promo_price || item.price) || 0,
    category: 'Promotions',
    has_tray_pricing: false,
    has_per_pax_pricing: true,
});

const effectiveSelectorPrice = (item, mode) => {
    if (item.item_type !== 'menu_item') return parseFloat(item.price) || 0;
    if (mode === 'per_tray' && item.has_tray_pricing) {
        return parseFloat(item.tray_price) || 0;
    }
    return parseFloat(item.per_pax_price || item.price) || 0;
};

// ============================================================
// VALIDATION BANNER
// ============================================================
const ValidationBanner = ({ type, title, message, icon, onDismiss, actionLabel, onAction }) => {
    const palette = {
        error: { bg: '#FFEBEE', border: '#F44336', text: '#C62828', iconBg: '#F44336' },
        warning: { bg: '#FFF3E0', border: '#FF9800', text: '#E65100', iconBg: '#FF9800' },
        info: { bg: '#E3F2FD', border: '#2196F3', text: '#0D47A1', iconBg: '#2196F3' },
    }[type] || { bg: '#F5F5F5', border: '#B0B0B0', text: '#333', iconBg: '#B0B0B0' };

    return (
        <View style={[validationStyles.container, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <View style={[validationStyles.iconCircle, { backgroundColor: palette.iconBg }]}>
                <Feather name={icon} size={14} color="#FFF" />
            </View>
            <View style={validationStyles.textBlock}>
                <Text style={[validationStyles.title, { color: palette.text }]}>{title}</Text>
                {!!message && (
                    <Text style={[validationStyles.message, { color: palette.text }]}>{message}</Text>
                )}
                {actionLabel && onAction && (
                    <TouchableOpacity
                        style={[validationStyles.actionBtn, { borderColor: palette.border }]}
                        onPress={onAction}
                        activeOpacity={0.7}
                    >
                        <Text style={[validationStyles.actionText, { color: palette.text }]}>
                            {actionLabel}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            {onDismiss && (
                <TouchableOpacity onPress={onDismiss} style={validationStyles.dismiss} activeOpacity={0.7}>
                    <Feather name="x" size={14} color={palette.text} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const validationStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    iconCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textBlock: { flex: 1 },
    title: { fontSize: 12, fontWeight: '700', marginBottom: 2, letterSpacing: 0.2 },
    message: { fontSize: 11, lineHeight: 15, opacity: 0.85 },
    actionBtn: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
    },
    actionText: { fontSize: 11, fontWeight: '600' },
    dismiss: { padding: 4 },
});

// ============================================================
// STEP INDICATOR
// ============================================================
const StepIndicator = ({ currentStep, steps }) => {
    const labels = ['Event Details', 'Meal Services', 'Confirmation'];
    const icons = ['calendar-edit', 'food-variant', 'clipboard-check-outline'];
    const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <View style={stepStyles.container}>
            <LinearGradient
                colors={['#FFF5F8', '#FFFFFF']}
                style={stepStyles.gradientBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <View style={stepStyles.progressTrack}>
                <View style={[stepStyles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            {steps.map((step, index) => {
                const isActive = step === currentStep;
                const isCompleted = step < currentStep;
                const isUpcoming = step > currentStep;
                return (
                    <View key={step} style={stepStyles.stepWrapper}>
                        <TouchableOpacity
                            style={stepStyles.stepContent}
                            activeOpacity={0.7}
                            disabled={isUpcoming}
                        >
                            <View style={[
                                stepStyles.circle,
                                isActive && stepStyles.circleActive,
                                isCompleted && stepStyles.circleCompleted,
                                isUpcoming && stepStyles.circleUpcoming,
                            ]}>
                                {isCompleted ? (
                                    <Feather name="check" size={16} color="#FFF" />
                                ) : isActive ? (
                                    <MaterialCommunityIcons name={icons[index]} size={16} color="#FFF" />
                                ) : (
                                    <MaterialCommunityIcons name={icons[index]} size={14} color="#8E8E93" />
                                )}
                            </View>
                            <View style={stepStyles.labelContainer}>
                                <Text style={[
                                    stepStyles.label,
                                    isActive && stepStyles.labelActive,
                                    isCompleted && stepStyles.labelCompleted,
                                    isUpcoming && stepStyles.labelUpcoming,
                                ]}>
                                    {labels[index]}
                                </Text>
                                {isActive && (
                                    <View style={stepStyles.activeIndicator}>
                                        <LinearGradient
                                            colors={['#FF6B9D', '#FF8FB1']}
                                            style={stepStyles.activeDot}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

const stepStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        paddingVertical: 18,
        paddingTop: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F5EEF0',
        position: 'relative',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        zIndex: 10,
    },
    gradientBackground: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.5,
    },
    progressTrack: {
        position: 'absolute',
        top: 32,
        left: '18%',
        right: '18%',
        height: 3,
        backgroundColor: '#F0E8EB',
        borderRadius: 2,
        overflow: 'hidden',
        zIndex: 0,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FF6B9D',
        borderRadius: 2,
    },
    stepWrapper: { flex: 1, alignItems: 'center', position: 'relative' },
    stepContent: { alignItems: 'center', zIndex: 1 },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0E8EB',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: '#F0E8EB',
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    circleActive: {
        backgroundColor: '#FF6B9D',
        borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
        transform: [{ scale: 1.08 }],
    },
    circleCompleted: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    circleUpcoming: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E0D8DB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    stepNumber: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
    labelContainer: { alignItems: 'center', position: 'relative' },
    label: {
        fontSize: 9,
        fontWeight: '500',
        color: '#8E8E93',
        textAlign: 'center',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    labelActive: { color: '#FF6B9D', fontWeight: '700', letterSpacing: 0.6 },
    labelCompleted: { color: '#4CAF50', fontWeight: '600' },
    labelUpcoming: { color: '#B0B0B0', fontWeight: '400' },
    activeIndicator: { marginTop: 3, height: 3, borderRadius: 1.5, overflow: 'hidden', width: 20 },
    activeDot: { width: 20, height: 3, borderRadius: 1.5 },
});

// ============================================================
// SCROLL INDICATOR
// ============================================================
const ScrollIndicator = ({ visible, animated }) => {
    const bounceValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (visible && animated) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(bounceValue, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(bounceValue, { toValue: 0, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            bounceValue.setValue(0);
        }
    }, [visible, animated]);
    if (!visible) return null;
    const translateY = bounceValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -8, 0],
    });
    return (
        <TouchableWithoutFeedback>
            <Animated.View style={[scrollIndicatorStyles.container, { transform: [{ translateY }] }]}>
                <View style={scrollIndicatorStyles.arrowContainer}>
                    <Feather name="chevron-down" size={20} color="#FF6B9D" />
                </View>
                <Text style={scrollIndicatorStyles.text}>Scroll for more</Text>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const scrollIndicatorStyles = StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
    arrowContainer: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#FFF5F8', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: '#FFE8EE',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
    },
    text: { fontSize: 10, color: '#B0B0B0', marginTop: 4, fontWeight: '500', letterSpacing: 0.3 },
});

// ============================================================
// EVENT TYPE SCROLL INDICATOR
// ============================================================
const EventTypeScrollIndicator = ({ visible, canScrollLeft, canScrollRight, onScrollLeft, onScrollRight }) => {
    const pulseValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (visible && (canScrollLeft || canScrollRight)) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseValue, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseValue, { toValue: 0, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseValue.setValue(0);
        }
    }, [visible, canScrollLeft, canScrollRight]);
    if (!visible || (!canScrollLeft && !canScrollRight)) return null;
    const opacity = pulseValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 1, 0.3],
    });
    return (
        <View style={eventTypeScrollStyles.container}>
            {canScrollLeft && (
                <Animated.View style={[eventTypeScrollStyles.arrowButton, { opacity }]}>
                    <TouchableOpacity onPress={onScrollLeft} activeOpacity={0.7} style={eventTypeScrollStyles.touchable}>
                        <Feather name="chevron-left" size={16} color="#FF6B9D" />
                    </TouchableOpacity>
                </Animated.View>
            )}
            <View style={eventTypeScrollStyles.scrollHint}>
                <Text style={eventTypeScrollStyles.scrollHintText}>Scroll to see more</Text>
            </View>
            {canScrollRight && (
                <Animated.View style={[eventTypeScrollStyles.arrowButton, eventTypeScrollStyles.arrowRight, { opacity }]}>
                    <TouchableOpacity onPress={onScrollRight} activeOpacity={0.7} style={eventTypeScrollStyles.touchable}>
                        <Feather name="chevron-right" size={16} color="#FF6B9D" />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
};

const eventTypeScrollStyles = StyleSheet.create({
    container: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: -2, marginBottom: 4,
        backgroundColor: '#FFF5F8', borderRadius: 8,
        borderWidth: 1, borderColor: '#FFE8EE', borderStyle: 'dashed',
        paddingHorizontal: 8, paddingVertical: 4,
    },
    scrollHint: { flex: 1, alignItems: 'center' },
    scrollHintText: { fontSize: 9, color: '#FF6B9D', fontWeight: '500', letterSpacing: 0.3 },
    arrowButton: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FFE8EE',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
    },
    arrowRight: { alignSelf: 'center' },
    touchable: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

// ============================================================
// ⭐ PACKAGE DETAILS MODAL — shows all menu items inside a package
// ============================================================
const PackageDetailsModal = ({ visible, packageData, onClose, onPickAll }) => {
    if (!visible || !packageData) return null;

    const menuItems = Array.isArray(packageData.menu_items) ? packageData.menu_items : [];
    const perPax = parseFloat(packageData.base_price_per_pax) || 0;
    const minPax = parseInt(packageData.min_pax) || 0;
    const maxPax = parseInt(packageData.max_pax) || 0;
    const image = packageData.image || packageData.image_url;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={pkgModalStyles.container}>
                <View style={pkgModalStyles.header}>
                    <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                        <Feather name="x" size={22} color="#2D2D2D" />
                    </TouchableOpacity>
                    <Text style={pkgModalStyles.title}>Package Details</Text>
                    <View style={{ width: 22 }} />
                </View>

                <ScrollView contentContainerStyle={pkgModalStyles.body}>
                    {/* Hero image */}
                    <View style={pkgModalStyles.hero}>
                        {image ? (
                            <Image source={{ uri: image }} style={pkgModalStyles.heroImg} resizeMode="cover" />
                        ) : (
                            <View style={pkgModalStyles.heroPlaceholder}>
                                <MaterialCommunityIcons name="package-variant-closed" size={48} color="#FF6B9D" />
                            </View>
                        )}
                    </View>

                    <Text style={pkgModalStyles.pkgName}>{packageData.name}</Text>
                    {!!packageData.description && (
                        <Text style={pkgModalStyles.pkgDescription}>{packageData.description}</Text>
                    )}

                    <View style={pkgModalStyles.metaRow}>
                        <View style={pkgModalStyles.metaItem}>
                            <Feather name="dollar-sign" size={14} color="#FF6B9D" />
                            <Text style={pkgModalStyles.metaText}>
                                ₱{perPax.toLocaleString()} / pax
                            </Text>
                        </View>
                        {minPax > 0 && (
                            <View style={pkgModalStyles.metaItem}>
                                <Feather name="users" size={14} color="#FF6B9D" />
                                <Text style={pkgModalStyles.metaText}>
                                    {minPax}{maxPax > 0 ? `–${maxPax}` : ''} pax
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={pkgModalStyles.divider} />

                    <Text style={pkgModalStyles.sectionTitle}>
                        Menu Items Included ({menuItems.length})
                    </Text>

                    {menuItems.length === 0 ? (
                        <View style={pkgModalStyles.emptyBox}>
                            <MaterialCommunityIcons name="food-off" size={32} color="#B0B0B0" />
                            <Text style={pkgModalStyles.emptyText}>No menu items attached yet.</Text>
                        </View>
                    ) : (
                        <View style={pkgModalStyles.list}>
                            {menuItems.map((item, idx) => {
                                const itemImage = item.image || item.image_url;
                                const qty = parseInt(item.quantity_per_pax || item.quantity || 1);
                                const price = parseFloat(item.price) || 0;
                                return (
                                    <View key={`${item.menu_item_id || idx}`} style={pkgModalStyles.itemRow}>
                                        <View style={pkgModalStyles.itemThumb}>
                                            {itemImage ? (
                                                <Image source={{ uri: itemImage }} style={pkgModalStyles.itemThumbImg} resizeMode="cover" />
                                            ) : (
                                                <MaterialCommunityIcons name="food" size={20} color="#FF6B9D" />
                                            )}
                                        </View>
                                        <View style={pkgModalStyles.itemInfo}>
                                            <Text style={pkgModalStyles.itemName} numberOfLines={2}>
                                                {item.name || 'Menu Item'}
                                            </Text>
                                            {!!item.description && (
                                                <Text style={pkgModalStyles.itemDesc} numberOfLines={2}>
                                                    {item.description}
                                                </Text>
                                            )}
                                            <View style={pkgModalStyles.itemTags}>
                                                <View style={pkgModalStyles.itemQtyTag}>
                                                    <Text style={pkgModalStyles.itemQtyText}>x{qty} per pax</Text>
                                                </View>
                                                {price > 0 && (
                                                    <Text style={pkgModalStyles.itemPrice}>
                                                        ₱{price.toLocaleString()}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>

                <View style={pkgModalStyles.footer}>
                    <TouchableOpacity
                        style={pkgModalStyles.pickBtn}
                        onPress={() => onPickAll && onPickAll(packageData)}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#FF6B9D', '#FF8FB1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={pkgModalStyles.pickBtnGradient}
                        >
                            <Feather name="check-circle" size={16} color="#FFF" />
                            <Text style={pkgModalStyles.pickBtnText}>
                                Add All {menuItems.length} Items
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const pkgModalStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 8 : 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E8EB',
    },
    title: { fontSize: 16, fontWeight: '700', color: '#2D2D2D' },
    body: { padding: 16 },
    hero: {
        width: '100%',
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#FFF5F8',
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroImg: { width: '100%', height: '100%' },
    heroPlaceholder: {
        width: '100%', height: '100%',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFF5F8',
    },
    pkgName: {
        fontSize: 20, fontWeight: '800', color: '#2D2D2D',
        letterSpacing: -0.3, marginBottom: 6,
    },
    pkgDescription: {
        fontSize: 12, color: '#6B6B6E', lineHeight: 18, marginBottom: 12,
    },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 12, fontWeight: '600', color: '#2D2D2D' },
    divider: { height: 1, backgroundColor: '#F0E8EB', marginVertical: 14 },
    sectionTitle: {
        fontSize: 14, fontWeight: '700', color: '#2D2D2D', marginBottom: 12,
    },
    emptyBox: {
        padding: 30, alignItems: 'center', borderRadius: 12,
        borderWidth: 1, borderColor: '#E8E0E3', borderStyle: 'dashed',
        backgroundColor: '#FAFAFA',
    },
    emptyText: { fontSize: 12, color: '#B0B0B0', marginTop: 8 },
    list: { gap: 10 },
    itemRow: {
        flexDirection: 'row',
        gap: 12,
        padding: 10,
        borderRadius: 12,
        backgroundColor: '#FBF7F9',
        borderWidth: 1,
        borderColor: '#F0E8EB',
    },
    itemThumb: {
        width: 56, height: 56, borderRadius: 10, overflow: 'hidden',
        backgroundColor: '#FFF5F8',
        alignItems: 'center', justifyContent: 'center',
    },
    itemThumbImg: { width: 56, height: 56, borderRadius: 10 },
    itemInfo: { flex: 1, justifyContent: 'center' },
    itemName: { fontSize: 13, fontWeight: '700', color: '#2D2D2D' },
    itemDesc: { fontSize: 10, color: '#8A8A8E', marginTop: 2, lineHeight: 14 },
    itemTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    itemQtyTag: {
        backgroundColor: '#FFF0F5', paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 4, borderWidth: 1, borderColor: '#FFE0EA',
    },
    itemQtyText: { fontSize: 9, fontWeight: '700', color: '#C2185B', letterSpacing: 0.3 },
    itemPrice: { fontSize: 11, fontWeight: '700', color: '#FF6B9D' },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16, paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        borderTopWidth: 1, borderTopColor: '#F0E8EB',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 6,
    },
    pickBtn: {
        borderRadius: 16, overflow: 'hidden',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    pickBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14,
    },
    pickBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});


// ============================================================
// BOOKING SUCCESS MODAL
// ============================================================
const BookingSuccessModal = ({ visible, booking, onClose, onViewOrders, onGoHome, onBookNew }) => {
    if (!visible) return null;
    const eventDateLabel = booking?.event_date
        ? new Date(booking.event_date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          })
        : '—';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={successStyles.overlay}>
                <View style={successStyles.card}>
                    <LinearGradient
                        colors={['#FF6B9D', '#FF8FB1']}
                        style={successStyles.iconCircle}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Feather name="check" size={36} color="#FFF" />
                    </LinearGradient>

                    <Text style={successStyles.title}>Booking Submitted!</Text>
                    <Text style={successStyles.subtitle}>
                        Your booking request has been received. We'll notify you once it's confirmed.
                    </Text>

                    <View style={successStyles.detailsCard}>
                        <View style={successStyles.detailRow}>
                            <Text style={successStyles.detailLabel}>Booking No.</Text>
                            <Text style={successStyles.detailValue}>{booking?.booking_no || '—'}</Text>
                        </View>
                        <View style={successStyles.detailRow}>
                            <Text style={successStyles.detailLabel}>Event Date</Text>
                            <Text style={successStyles.detailValue}>{eventDateLabel}</Text>
                        </View>
                        <View style={successStyles.detailRow}>
                            <Text style={successStyles.detailLabel}>Guests</Text>
                            <Text style={successStyles.detailValue}>{booking?.guests_count || 0} pax</Text>
                        </View>
                        <View style={successStyles.divider} />
                        <View style={successStyles.detailRow}>
                            <Text style={successStyles.detailLabel}>Total</Text>
                            <Text style={successStyles.detailValue}>
                                ₱{Number(booking?.total_amount || 0).toLocaleString()}
                            </Text>
                        </View>
                        <View style={successStyles.detailRow}>
                            <Text style={successStyles.detailLabel}>Deposit (30%)</Text>
                            <Text style={[successStyles.detailValue, { color: '#FF6B9D' }]}>
                                ₱{Number(booking?.required_deposit || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    <View style={successStyles.buttons}>
                        <TouchableOpacity
                            style={[successStyles.btn, successStyles.btnSecondary]}
                            onPress={onBookNew}
                            activeOpacity={0.8}
                        >
                            <Feather name="plus" size={14} color="#FF6B9D" />
                            <Text style={successStyles.btnSecondaryText}>Book New</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[successStyles.btn, successStyles.btnPrimary]}
                            onPress={onViewOrders}
                            activeOpacity={0.8}
                        >
                            <Feather name="file-text" size={14} color="#FFF" />
                            <Text style={successStyles.btnPrimaryText}>View Orders</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={onGoHome} style={successStyles.homeLink} activeOpacity={0.7}>
                        <Text style={successStyles.homeLinkText}>Back to Home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const successStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 16,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2D2D2D',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 12,
        color: '#8A8A8E',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
    },
    detailsCard: {
        width: '100%',
        backgroundColor: '#FFF8FA',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FFE8EE',
        marginBottom: 18,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    detailLabel: { fontSize: 11, color: '#8A8A8E' },
    detailValue: { fontSize: 12, fontWeight: '700', color: '#2D2D2D' },
    divider: { height: 1, backgroundColor: '#FFE8EE', marginVertical: 6 },
    buttons: { flexDirection: 'row', gap: 8, width: '100%' },
    btn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 5,
    },
    btnPrimary: { backgroundColor: '#FF6B9D' },
    btnPrimaryText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
    btnSecondary: {
        backgroundColor: '#FFF5F8',
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
    },
    btnSecondaryText: { fontSize: 12, fontWeight: '700', color: '#FF6B9D' },
    homeLink: { marginTop: 12, padding: 6 },
    homeLinkText: { fontSize: 11, color: '#8A8A8E', fontWeight: '500' },
});

// ============================================================
// RESCHEDULE MODAL
// ============================================================
const RescheduleModal = ({
    visible,
    mode,
    booking,
    submitting,
    onClose,
    onAccept,
    onCounter,
    onDecline,
    onContinueOriginal,
    onCancelBooking,
}) => {
    const [showCounter, setShowCounter] = useState(false);
    const [counterDate, setCounterDate] = useState(new Date());
    const [counterTime, setCounterTime] = useState(new Date());
    const [counterReason, setCounterReason] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible && booking?.reschedule_new_date) {
            setCounterDate(new Date(booking.reschedule_new_date));
        }
    }, [visible, booking]);

    if (!visible) return null;

    const proposedDate = booking?.reschedule_new_date
        ? new Date(booking.reschedule_new_date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          })
        : '—';
    const proposedTime = booking?.reschedule_new_time || booking?.event_time || '—';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={rescheduleStyles.overlay}>
                <View style={rescheduleStyles.card}>
                    <View style={rescheduleStyles.header}>
                        <View style={rescheduleStyles.iconCircle}>
                            <Feather name="calendar" size={22} color="#FF6B9D" />
                        </View>
                        <Text style={rescheduleStyles.title}>
                            {mode === 'customer-after-rejection'
                                ? 'Reschedule Declined'
                                : 'Reschedule Proposal'}
                        </Text>
                    </View>

                    {mode === 'customer-admin-proposal' && (
                        <>
                            <Text style={rescheduleStyles.message}>
                                The admin proposed a new schedule for your booking. Please review and choose an option.
                            </Text>
                            <View style={rescheduleStyles.detailsCard}>
                                <View style={rescheduleStyles.detailRow}>
                                    <Text style={rescheduleStyles.detailLabel}>Original Date</Text>
                                    <Text style={rescheduleStyles.detailValue}>
                                        {booking?.event_date
                                            ? new Date(booking.event_date).toLocaleDateString()
                                            : '—'}
                                    </Text>
                                </View>
                                <View style={rescheduleStyles.detailRow}>
                                    <Text style={rescheduleStyles.detailLabel}>Proposed Date</Text>
                                    <Text style={[rescheduleStyles.detailValue, { color: '#FF6B9D' }]}>
                                        {proposedDate}
                                    </Text>
                                </View>
                                <View style={rescheduleStyles.detailRow}>
                                    <Text style={rescheduleStyles.detailLabel}>Proposed Time</Text>
                                    <Text style={rescheduleStyles.detailValue}>{proposedTime}</Text>
                                </View>
                                {!!booking?.reschedule_reason && (
                                    <View style={rescheduleStyles.reasonBox}>
                                        <Text style={rescheduleStyles.reasonLabel}>Reason:</Text>
                                        <Text style={rescheduleStyles.reasonText}>
                                            {booking.reschedule_reason}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </>
                    )}

                    {mode === 'customer-after-rejection' && (
                        <Text style={rescheduleStyles.message}>
                            Your reschedule request was declined. You may continue with the original
                            schedule or cancel the booking.
                        </Text>
                    )}

                    {!showCounter ? (
                        <View style={rescheduleStyles.actions}>
                            {mode === 'customer-admin-proposal' ? (
                                <>
                                    <TouchableOpacity
                                        style={[rescheduleStyles.btn, rescheduleStyles.btnPrimary]}
                                        onPress={onAccept}
                                        disabled={submitting}
                                        activeOpacity={0.8}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#FFF" size="small" />
                                        ) : (
                                            <>
                                                <Feather name="check" size={14} color="#FFF" />
                                                <Text style={rescheduleStyles.btnPrimaryText}>Accept</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[rescheduleStyles.btn, rescheduleStyles.btnSecondary]}
                                        onPress={() => setShowCounter(true)}
                                        disabled={submitting}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="refresh-cw" size={14} color="#FF6B9D" />
                                        <Text style={rescheduleStyles.btnSecondaryText}>Counter</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[rescheduleStyles.btn, rescheduleStyles.btnDanger]}
                                        onPress={onDecline}
                                        disabled={submitting}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="x" size={14} color="#FFF" />
                                        <Text style={rescheduleStyles.btnPrimaryText}>Decline</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[rescheduleStyles.btn, rescheduleStyles.btnSecondary]}
                                        onPress={onContinueOriginal}
                                        disabled={submitting}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="arrow-right" size={14} color="#FF6B9D" />
                                        <Text style={rescheduleStyles.btnSecondaryText}>Keep Original</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[rescheduleStyles.btn, rescheduleStyles.btnDanger]}
                                        onPress={onCancelBooking}
                                        disabled={submitting}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="x-circle" size={14} color="#FFF" />
                                        <Text style={rescheduleStyles.btnPrimaryText}>Cancel Booking</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    ) : (
                        <View style={rescheduleStyles.counterForm}>
                            <Text style={rescheduleStyles.counterLabel}>Propose New Date</Text>
                            <TouchableOpacity
                                style={rescheduleStyles.dateSelector}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Feather name="calendar" size={14} color="#FF6B9D" />
                                <Text style={rescheduleStyles.dateSelectorText}>
                                    {counterDate.toLocaleDateString('en-US', {
                                        weekday: 'short', month: 'short', day: 'numeric',
                                    })}
                                </Text>
                            </TouchableOpacity>

                            <Text style={rescheduleStyles.counterLabel}>Propose New Time</Text>
                            <TouchableOpacity
                                style={rescheduleStyles.dateSelector}
                                onPress={() => setShowTimePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Feather name="clock" size={14} color="#FF6B9D" />
                                <Text style={rescheduleStyles.dateSelectorText}>
                                    {counterTime.toLocaleTimeString('en-US', {
                                        hour: '2-digit', minute: '2-digit', hour12: true,
                                    })}
                                </Text>
                            </TouchableOpacity>

                            <Text style={rescheduleStyles.counterLabel}>Reason (optional)</Text>
                            <TextInput
                                style={rescheduleStyles.reasonInput}
                                value={counterReason}
                                onChangeText={setCounterReason}
                                placeholder="Why do you want to reschedule?"
                                placeholderTextColor="#C0C0C0"
                                multiline
                            />

                            <View style={rescheduleStyles.actions}>
                                <TouchableOpacity
                                    style={[rescheduleStyles.btn, rescheduleStyles.btnSecondary]}
                                    onPress={() => setShowCounter(false)}
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                >
                                    <Text style={rescheduleStyles.btnSecondaryText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[rescheduleStyles.btn, rescheduleStyles.btnPrimary]}
                                    onPress={() =>
                                        onCounter({
                                            new_date: counterDate.toISOString().split('T')[0],
                                            new_time: counterTime.toLocaleTimeString('en-US', {
                                                hour: '2-digit', minute: '2-digit', hour12: true,
                                            }),
                                            reason: counterReason,
                                        })
                                    }
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <Feather name="send" size={14} color="#FFF" />
                                            <Text style={rescheduleStyles.btnPrimaryText}>Send</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={counterDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    minimumDate={new Date()}
                                    onChange={(e, d) => {
                                        setShowDatePicker(false);
                                        if (d) setCounterDate(d);
                                    }}
                                />
                            )}
                            {showTimePicker && (
                                <DateTimePicker
                                    value={counterTime}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(e, t) => {
                                        setShowTimePicker(false);
                                        if (t) setCounterTime(t);
                                    }}
                                />
                            )}
                        </View>
                    )}

                    <TouchableOpacity onPress={onClose} style={rescheduleStyles.closeLink} activeOpacity={0.7}>
                        <Text style={rescheduleStyles.closeLinkText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const rescheduleStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 16,
    },
    header: { alignItems: 'center', marginBottom: 12 },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF5F8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
    },
    title: { fontSize: 17, fontWeight: '800', color: '#2D2D2D', textAlign: 'center' },
    message: {
        fontSize: 12,
        color: '#6B6B6E',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 12,
    },
    detailsCard: {
        backgroundColor: '#FFF8FA',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FFE8EE',
        marginBottom: 14,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    detailLabel: { fontSize: 11, color: '#8A8A8E' },
    detailValue: { fontSize: 11, fontWeight: '700', color: '#2D2D2D' },
    reasonBox: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#FFE8EE',
    },
    reasonLabel: { fontSize: 10, fontWeight: '700', color: '#FF6B9D' },
    reasonText: { fontSize: 11, color: '#6B6B6E', marginTop: 2, lineHeight: 16 },
    actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    btn: {
        flex: 1,
        minWidth: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 12,
        gap: 5,
    },
    btnPrimary: { backgroundColor: '#FF6B9D' },
    btnPrimaryText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
    btnSecondary: {
        backgroundColor: '#FFF5F8',
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
    },
    btnSecondaryText: { fontSize: 12, fontWeight: '700', color: '#FF6B9D' },
    btnDanger: { backgroundColor: '#F44336' },
    counterForm: { marginBottom: 8 },
    counterLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#5A5A5E',
        marginBottom: 4,
        marginTop: 8,
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F9F6F7',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E8E0E3',
    },
    dateSelectorText: { fontSize: 12, fontWeight: '600', color: '#2D2D2D' },
    reasonInput: {
        backgroundColor: '#F9F6F7',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 12,
        color: '#2D2D2D',
        minHeight: 60,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#E8E0E3',
    },
    closeLink: { marginTop: 12, alignItems: 'center', padding: 6 },
    closeLinkText: { fontSize: 11, color: '#8A8A8E', fontWeight: '500' },
});

// ============================================================
// MAIN COMPONENT
// ============================================================
const BookingScreen = ({ navigation, route }) => {
    const { user, isAuthenticated, isGuest } = useAuth();
    const { cartItems, getTotalAmount, clearCart, reloadCart } = useCart();

    const routePackage = route?.params?.packageData || route?.params?.package || null;
    const routePackageId = route?.params?.packageId || route?.params?.id || null;
    const routePromotion = route?.params?.promotionData || route?.params?.promotion || null;
    const routePromotionId = route?.params?.promotionId || null;
    const routeRescheduleBooking = route?.params?.rescheduleBooking || null;

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const [showServingTimePicker, setShowServingTimePicker] = useState(false);
    const [servingTimeMealId, setServingTimeMealId] = useState(null);
    const [servingTimeDraft, setServingTimeDraft] = useState(new Date());

    const [showMenuSelector, setShowMenuSelector] = useState(false);
    const [selectedMealForMenu, setSelectedMealForMenu] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewMode, setViewMode] = useState('grid');
    const [tempSelectedItems, setTempSelectedItems] = useState([]);
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const [selectorPricingMode, setSelectorPricingMode] = useState('per_pax');

    // ⭐ Package details modal state
    const [showPackageDetails, setShowPackageDetails] = useState(false);
    const [packageDetailsData, setPackageDetailsData] = useState(null);

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const eventTypeScrollRef = useRef(null);
    const [eventTypeScrollX, setEventTypeScrollX] = useState(0);
    const [eventTypeContentWidth, setEventTypeContentWidth] = useState(0);
    const [eventTypeContainerWidth, setEventTypeContainerWidth] = useState(0);
    const [showEventTypeScrollHint, setShowEventTypeScrollHint] = useState(false);

    const [eventTypes, setEventTypes] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [packages, setPackages] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [categories, setCategories] = useState(['All']);

    const [selectedPackage, setSelectedPackage] = useState(null);
    const [selectedPromotion, setSelectedPromotion] = useState(null);
    const [isPackageBooking, setIsPackageBooking] = useState(false);
    const [isPromoBooking, setIsPromoBooking] = useState(false);

    const [dateValidation, setDateValidation] = useState(null);
    const [availabilityCheck, setAvailabilityCheck] = useState(null);
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
    const [depositCutoffWarning, setDepositCutoffWarning] = useState(null);
    const [showCutoffConfirm, setShowCutoffConfirm] = useState(false);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successPayload, setSuccessPayload] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const [rescheduleModal, setRescheduleModal] = useState({
        visible: false, mode: null, booking: null,
    });
    const [rescheduleBusy, setRescheduleBusy] = useState(false);

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const inputRefs = useRef({});
    const scrollViewRef = useRef(null);
    const mealIdCounter = useRef(1);
    const isMounted = useRef(true);
    const scrollPosition = useRef(0);
    const focusedFieldRef = useRef(null);
    const scrollViewHeightRef = useRef(0);
    const contentHeightRef = useRef(0);
    const scrollTimerRef = useRef(null);
    const contentMeasured = useRef(false);
    const keyboardShowListener = useRef(null);
    const keyboardHideListener = useRef(null);
    const availabilityDebounce = useRef(null);
    const hasInitialized = useRef(false);

    const [formData, setFormData] = useState({
        customer_name: user?.full_name || user?.name || '',
        customer_email: user?.email || '',
        customer_phone: user?.phone_number || '',
        event_type_id: null,
        event_date: new Date(),
        event_end_date: null,
        event_time: new Date(),
        venue: '',
        guests_count: '',
        service_type: 'buffet',
        event_scope: 'regular',
        total_days: 1,
        meal_services: [],
        multi_events: [{ id: 1 }],
        transportation_fee: 0,
        setup_fee: 0,
        service_crew_fee: 0,
        equipment_rental: 0,
        extra_food_fee: 0,
        discount: 0,
        delivery_method: 'delivery',
        delivery_address: '',
        delivery_contact_person: '',
        delivery_contact_phone: '',
        delivery_fee: 0,
        has_waiters: false,
        special_requests: '',
        menu_selection_type: 'custom',
        package_id: null,
        promotion_id: null,
        total_amount: 0,
        required_deposit: 0,
        down_payment: 0,
        payment_method: 'cash',
        payment_reference: '',
        transaction_id: '',
    });

    // ============================================================
    // FORM RESET
    // ============================================================
    const resetBookingForm = useCallback(() => {
        setFormData({
            customer_name: user?.full_name || user?.name || '',
            customer_email: user?.email || '',
            customer_phone: user?.phone_number || '',
            event_type_id: null,
            event_date: new Date(),
            event_end_date: null,
            event_time: new Date(),
            venue: '',
            guests_count: '',
            service_type: 'buffet',
            event_scope: 'regular',
            total_days: 1,
            meal_services: [],
            multi_events: [{ id: 1 }],
            transportation_fee: 0,
            setup_fee: 0,
            service_crew_fee: 0,
            equipment_rental: 0,
            extra_food_fee: 0,
            discount: 0,
            delivery_method: 'delivery',
            delivery_address: '',
            delivery_contact_person: '',
            delivery_contact_phone: '',
            delivery_fee: 0,
            has_waiters: false,
            special_requests: '',
            menu_selection_type: 'custom',
            package_id: null,
            promotion_id: null,
            total_amount: 0,
            required_deposit: 0,
            down_payment: 0,
            payment_method: 'cash',
            payment_reference: '',
            transaction_id: '',
        });
        setCurrentStep(1);
        setSelectedPackage(null);
        setSelectedPromotion(null);
        setIsPackageBooking(false);
        setIsPromoBooking(false);
        setDateValidation(null);
        setAvailabilityCheck(null);
        setDepositCutoffWarning(null);
        setSuccessPayload(null);
    }, [user]);

    // ============================================================
    // BOOK NEW EVENT
    // ============================================================
    const handleBookNewEvent = useCallback(() => {
        setShowSuccessModal(false);
        setSuccessPayload(null);
        setIsSubmitted(false);
        resetBookingForm();
        mealIdCounter.current = 1;
        setFormData((prev) => ({
            ...prev,
            meal_services: [{
                ...DEFAULT_MEAL_SERVICE,
                id: mealIdCounter.current++,
                day_number: 1,
                meal_type: 'lunch',
                serving_time: '12:00 PM',
                serving_time_date: new Date(2024, 0, 1, 12, 0, 0),
                pax: 0,
                menu_items: [],
            }],
        }));
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, [resetBookingForm]);

    // ============================================================
    // KEYBOARD
    // ============================================================
    const dismissKeyboard = useCallback(() => {
        Keyboard.dismiss();
        setFocusedInput(null);
        focusedFieldRef.current = null;
    }, []);

    const handleFocus = useCallback((fieldName) => {
        setFocusedInput(fieldName);
        focusedFieldRef.current = fieldName;
        setTimeout(() => {
            if (scrollViewRef.current && inputRefs.current[fieldName]) {
                scrollViewRef.current?.scrollTo({
                    y: scrollPosition.current + 120, animated: true,
                });
            }
        }, 400);
    }, []);

    const handleBlur = useCallback(() => {
        setFocusedInput(null);
        focusedFieldRef.current = null;
    }, []);

    const handleNextInput = useCallback((currentField, nextField) => {
        if (nextField && inputRefs.current[nextField]) {
            setTimeout(() => {
                inputRefs.current[nextField]?.focus();
                handleFocus(nextField);
            }, 150);
        }
    }, [handleFocus]);

    useEffect(() => {
        keyboardShowListener.current = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {}
        );
        keyboardHideListener.current = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {}
        );
        return () => {
            keyboardShowListener.current?.remove();
            keyboardHideListener.current?.remove();
        };
    }, []);

    // ============================================================
    // TIME PICKER
    // ============================================================
    const openServingTimePicker = useCallback((mealId) => {
        dismissKeyboard();
        const meal = formData.meal_services.find((m) => m.id === mealId);
        const initial = meal?.serving_time_date || new Date(2024, 0, 1, 12, 0, 0);
        setServingTimeDraft(initial);
        setServingTimeMealId(mealId);
        setShowServingTimePicker(true);
    }, [formData.meal_services, dismissKeyboard]);

    const applyServingTime = useCallback(() => {
        if (!servingTimeMealId) return;
        const label = servingTimeDraft.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
        updateMealService(servingTimeMealId, {
            serving_time: label,
            serving_time_date: servingTimeDraft,
        });
        setShowServingTimePicker(false);
        setServingTimeMealId(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [servingTimeMealId, servingTimeDraft]);

    // ============================================================
    // FORM FIELD UPDATE
    // ============================================================
    const updateFormField = useCallback((field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'guests_count') {
                const guestCount = parseInt(value, 10) || 0;
                next.meal_services = (prev.meal_services || []).map((meal) => ({
                    ...meal,
                    pax: !meal.pax || Number(meal.pax) <= 0 ? guestCount : meal.pax,
                }));
            }
            if (field === 'event_scope') {
                if (value === 'regular') {
                    next.total_days = 1;
                    next.event_end_date = null;
                } else {
                    next.total_days = 2;
                    const endDate = new Date(next.event_date);
                    endDate.setDate(endDate.getDate() + 1);
                    next.event_end_date = endDate;
                }
            }
            if (field === 'event_end_date') {
                if (value && next.event_date) {
                    const days = Math.ceil((value - next.event_date) / (1000 * 60 * 60 * 24)) + 1;
                    next.total_days = Math.max(1, days);
                }
            }
            return next;
        });
    }, []);

    // Rebuild meal services when scope/day count changes
    useEffect(() => {
        if (formData.event_scope === 'multi' && formData.meal_services.length === 0) {
            initializeMealServices();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.event_scope, formData.total_days]);

    // ============================================================
    // MEAL SERVICES
    // ============================================================
    const initializeMealServices = useCallback(() => {
        const totalDays = formData.total_days || 1;
        const guestCount = parseInt(formData.guests_count) || 0;
        const meals = [];
        for (let day = 1; day <= totalDays; day++) {
            meals.push({
                ...DEFAULT_MEAL_SERVICE,
                id: mealIdCounter.current++,
                day_number: day,
                meal_type: 'lunch',
                serving_time: '12:00 PM',
                serving_time_date: new Date(2024, 0, 1, 12, 0, 0),
                pax: guestCount,
                menu_items: [],
            });
        }
        setFormData((prev) => ({ ...prev, meal_services: meals }));
    }, [formData.total_days, formData.guests_count]);

    const addMealService = useCallback(() => {
        const totalDays = formData.total_days || 1;
        const guestCount = parseInt(formData.guests_count) || 0;

        if (formData.meal_services.length === 0) {
            initializeMealServices();
            return;
        }

        const totalSlots = totalDays * MEAL_TYPES.length;
        if (formData.meal_services.length >= totalSlots) {
            Alert.alert('Maximum Reached', `You've added all meal types for all ${totalDays} day(s).`);
            return;
        }

        let foundSlot = false;
        let newDay = 1;
        let newMealType = 'lunch';
        for (let day = 1; day <= totalDays; day++) {
            const mealsForDay = formData.meal_services.filter((m) => m.day_number === day);
            const mealTypesForDay = mealsForDay.map((m) => m.meal_type);
            const available = MEAL_TYPES.filter((m) => !mealTypesForDay.includes(m.id));
            if (available.length > 0) {
                newDay = day;
                newMealType = available[0].id;
                foundSlot = true;
                break;
            }
        }

        if (!foundSlot) {
            Alert.alert('Maximum Reached', `All meal slots are filled for ${totalDays} day(s).`);
            return;
        }

        const newMeal = {
            ...DEFAULT_MEAL_SERVICE,
            id: mealIdCounter.current++,
            day_number: newDay,
            meal_type: newMealType,
            serving_time: '12:00 PM',
            serving_time_date: new Date(2024, 0, 1, 12, 0, 0),
            pax: guestCount,
            menu_items: [],
        };

        setFormData((prev) => ({ ...prev, meal_services: [...prev.meal_services, newMeal] }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
    }, [formData.total_days, formData.guests_count, formData.meal_services, initializeMealServices]);

    const removeMealService = useCallback((mealId) => {
        if (formData.meal_services.length <= 1) {
            Alert.alert('Cannot Remove', 'You need at least one meal service.');
            return;
        }
        Alert.alert('Remove Meal', 'Remove this meal service?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: () => {
                    setFormData((prev) => ({
                        ...prev,
                        meal_services: prev.meal_services.filter((m) => m.id !== mealId),
                    }));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                },
            },
        ]);
    }, [formData.meal_services]);

    const updateMealService = useCallback((mealId, updates) => {
        setFormData((prev) => {
            const mealIndex = prev.meal_services.findIndex((m) => m.id === mealId);
            if (mealIndex === -1) return prev;
            const meal = prev.meal_services[mealIndex];
            const updatedMeal = { ...meal, ...updates };

            if (updates.meal_type && updates.meal_type !== meal.meal_type) {
                const dayNumber = updates.day_number || meal.day_number;
                const dup = prev.meal_services.some((m, i) =>
                    i !== mealIndex && m.day_number === dayNumber && m.meal_type === updates.meal_type
                );
                if (dup) {
                    Alert.alert('Duplicate Meal', `This meal type is already added for Day ${dayNumber}.`);
                    return prev;
                }
            }

            if (updates.day_number && updates.day_number !== meal.day_number) {
                const mealType = updates.meal_type || meal.meal_type;
                const dup = prev.meal_services.some((m, i) =>
                    i !== mealIndex && m.day_number === updates.day_number && m.meal_type === mealType
                );
                if (dup) {
                    Alert.alert('Duplicate Meal', `This meal type is already added for Day ${updates.day_number}.`);
                    return prev;
                }
            }

            const newMeals = [...prev.meal_services];
            newMeals[mealIndex] = updatedMeal;
            return { ...prev, meal_services: newMeals };
        });
    }, []);

    // ============================================================
    // MENU SELECTION
    // ============================================================
    const openMenuSelector = useCallback((mealId) => {
        dismissKeyboard();
        setSelectedMealForMenu(mealId);
        const meal = formData.meal_services.find((m) => m.id === mealId);
        setTempSelectedItems(meal?.menu_items || []);
        setShowMenuSelector(true);
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectorPricingMode('per_pax');
    }, [formData.meal_services, dismissKeyboard]);

    const toggleMenuItem = useCallback((menuItem) => {
        setTempSelectedItems((prev) => {
            const lineKey = (i) => `${i.menu_item_id || i.id}__${i.pricing_type || 'per_pax'}`;
            const incomingKey = `${menuItem.menu_item_id || menuItem.id}__${
                menuItem.item_type === 'menu_item' ? selectorPricingMode : 'per_pax'
            }`;
            const exists = prev.some((i) => lineKey(i) === incomingKey);
            if (exists) {
                return prev.filter((i) => lineKey(i) !== incomingKey);
            }
            const isMenuItem = menuItem.item_type === 'menu_item';
            const mode = isMenuItem ? selectorPricingMode : 'per_pax';
            const resolvedPrice = isMenuItem
                ? effectiveSelectorPrice(menuItem, mode)
                : parseFloat(menuItem.price) || 0;
            const line = {
                ...menuItem,
                id: `${menuItem.id}__${mode}`,
                line_id: `${menuItem.menu_item_id || menuItem.id}__${mode}`,
                pricing_type: mode,
                price: resolvedPrice,
                unit_price: resolvedPrice,
                per_pax_price: parseFloat(menuItem.per_pax_price) || 0,
                tray_price: parseFloat(menuItem.tray_price) || 0,
                tray_servings: parseInt(menuItem.tray_servings, 10) || 0,
                tray_min_pax: parseInt(menuItem.tray_min_pax, 10) || 0,
                tray_max_pax: parseInt(menuItem.tray_max_pax, 10) || 0,
                tray_description: menuItem.tray_description || '',
                quantity: 1,
            };
            return [...prev, line];
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [selectorPricingMode]);

    // ⭐ NEW: Open package details modal
    const openPackageDetails = useCallback((pkg) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPackageDetailsData(pkg);
        setShowPackageDetails(true);
    }, []);

    const closePackageDetails = useCallback(() => {
        setShowPackageDetails(false);
        setPackageDetailsData(null);
    }, []);

    // ⭐ NEW: Bulk-add all menu items from a package
    const handlePickAllFromPackage = useCallback((pkg) => {
        const items = Array.isArray(pkg.menu_items) ? pkg.menu_items : [];
        if (items.length === 0) {
            Alert.alert('Empty Package', 'This package has no menu items to add.');
            return;
        }

        setTempSelectedItems((prev) => {
            const lineKey = (i) => `${i.menu_item_id || i.id}__${i.pricing_type || 'per_pax'}`;
            const next = [...prev];

            items.forEach((m, i) => {
                const itemId = m.menu_item_id || `pkg-${pkg.package_id}-${i}`;
                const resolvedPrice =
                    parseFloat(m.price) || parseFloat(pkg.base_price_per_pax) || 0;
                const line = {
                    ...m,
                    id: `${itemId}__per_pax`,
                    line_id: `${itemId}__per_pax`,
                    menu_item_id: itemId,
                    package_id: pkg.package_id,
                    package_name: pkg.name,
                    source_type: 'package',
                    item_type: 'menu_item',
                    name: m.name || 'Menu Item',
                    pricing_type: 'per_pax',
                    price: resolvedPrice,
                    unit_price: resolvedPrice,
                    per_pax_price: resolvedPrice,
                    tray_price: 0,
                    tray_servings: 0,
                    tray_min_pax: 0,
                    tray_max_pax: 0,
                    tray_description: '',
                    quantity: Math.max(1, parseInt(m.quantity_per_pax || m.quantity || 1, 10) || 1),
                };
                const key = lineKey(line);
                const exists = next.some((n) => lineKey(n) === key);
                if (!exists) next.push(line);
            });

            return next;
        });

        closePackageDetails();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [closePackageDetails]);

    const confirmMenuSelection = useCallback(() => {
        if (selectedMealForMenu) {
            updateMealService(selectedMealForMenu, { menu_items: tempSelectedItems });
        }
        setShowMenuSelector(false);
        setSelectedMealForMenu(null);
        setTempSelectedItems([]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [selectedMealForMenu, tempSelectedItems, updateMealService]);

    const updateMenuItemQuantity = useCallback((mealId, itemId, quantity) => {
        const newQuantity = Math.max(1, quantity);
        setFormData((prev) => ({
            ...prev,
            meal_services: prev.meal_services.map((meal) =>
                meal.id === mealId
                    ? {
                        ...meal,
                        menu_items: meal.menu_items.map((item) =>
                            item.id === itemId ? { ...item, quantity: newQuantity } : item
                        ),
                    }
                    : meal
            ),
        }));
    }, []);

    // ============================================================
    // CALCULATIONS
    // ============================================================
    const getMealTotal = useCallback((meal) => {
        const menuTotal = (meal.menu_items || []).reduce(
            (sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0
        );
        const paxTotal = (meal.pax || 0) * (meal.price_per_head || 0);
        return menuTotal + paxTotal;
    }, []);

    const getTotalMealServices = useCallback(() => {
        return (formData.meal_services || []).reduce((sum, meal) => sum + getMealTotal(meal), 0);
    }, [formData.meal_services, getMealTotal]);

    const calculateAdditionalCharges = useCallback(() => {
        let total = 0;
        total += parseFloat(formData.transportation_fee || 0);
        total += parseFloat(formData.setup_fee || 0);
        total += parseFloat(formData.service_crew_fee || 0);
        total += parseFloat(formData.equipment_rental || 0);
        total += parseFloat(formData.extra_food_fee || 0);
        total += parseFloat(formData.delivery_fee || 0);
        return total;
    }, [formData]);

    const calculateDiscount = useCallback(() => parseFloat(formData.discount || 0), [formData]);

    const calculateTotal = useCallback(() => {
        let total = getTotalMealServices() + calculateAdditionalCharges();
        const discount = calculateDiscount();
        total = Math.max(0, total - discount);
        if (isPromoBooking && selectedPromotion) {
            if (selectedPromotion.discount_type === 'percentage') {
                total = total * (1 - selectedPromotion.discount_value / 100);
            } else {
                total = Math.max(0, total - selectedPromotion.discount_value);
            }
        }
        return total;
    }, [getTotalMealServices, calculateAdditionalCharges, calculateDiscount, isPromoBooking, selectedPromotion]);

    // ============================================================
    // VALIDATION
    // ============================================================
    const validateDateLocally = useCallback((date) => {
        if (!date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        if (target < today) {
            return {
                type: 'error', code: 'past_date',
                title: 'Event date is in the past',
                message: 'Please pick a date from today onwards.',
                icon: 'alert-circle',
            };
        }
        if (target.getTime() === today.getTime()) {
            return {
                type: 'error', code: 'same_day',
                title: 'Same-day booking is not allowed',
                message: 'Please choose at least tomorrow. Same-day events cannot be accommodated.',
                icon: 'calendar',
            };
        }
        return null;
    }, []);

    const checkDateAvailability = useCallback(async (date) => {
        if (!date) return null;
        try {
            setIsCheckingAvailability(true);
            const dateStr = date.toISOString().split('T')[0];
            const response = await bookingService.getCalendarAvailability({ start: dateStr, end: dateStr });
            if (!response || !response.success) return null;

            const list = response.data || [];
            const info = Array.isArray(list)
                ? list.find((a) => a.date === dateStr)
                : list?.[dateStr];
            if (!info) return null;

            const status = (info.status || '').toLowerCase();
            const isAvailable = info.is_available !== false;
            const opMode = info.operation_mode || 'normal';
            const maxBookings = parseInt(info.max_bookings, 10) || 0;
            const bookingCount = parseInt(info.booking_count, 10) || 0;

            if (status === 'fully_booked' || status === 'unavailable' || status === 'blocked' || !isAvailable) {
                return {
                    type: 'error', code: 'date_unavailable',
                    title: status === 'fully_booked' ? 'This date is fully booked' : 'This date is not available',
                    message: info.notes || 'Please pick another date.',
                    icon: 'slash',
                };
            }
            if (opMode === 'limited_slot' && maxBookings > 0 && bookingCount >= maxBookings) {
                return {
                    type: 'error', code: 'slot_full',
                    title: 'All slots for this day are taken',
                    message: `We already have ${bookingCount}/${maxBookings} bookings on this date.`,
                    icon: 'users',
                };
            }
            if (info.is_holiday) {
                return {
                    type: 'warning', code: 'holiday',
                    title: 'This date is a holiday',
                    message: info.notes || 'Bookings on holidays may be subject to extra charges.',
                    icon: 'info',
                };
            }
            return null;
        } catch (error) {
            return null;
        } finally {
            setIsCheckingAvailability(false);
        }
    }, []);

    const checkDepositCutoff = useCallback((date) => {
        if (!date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((target - today) / (1000 * 60 * 60 * 24));
        const CUTOFF_DAYS = 7;
        if (daysUntil <= 0) return null;
        if (daysUntil < CUTOFF_DAYS) {
            return {
                type: 'warning', code: 'deposit_cutoff',
                title: 'Deposit cutoff is close',
                message:
                    `Your event is only ${daysUntil} day${daysUntil === 1 ? '' : 's'} away. ` +
                    `Standard policy requires the deposit ${CUTOFF_DAYS} days before the event. ` +
                    `Please be ready to pay the deposit immediately after approval.`,
                icon: 'clock',
            };
        }
        return null;
    }, []);

    useEffect(() => {
        if (!formData.event_date) {
            setDateValidation(null);
            setAvailabilityCheck(null);
            setDepositCutoffWarning(null);
            return;
        }
        const local = validateDateLocally(formData.event_date);
        setDateValidation(local);
        setDepositCutoffWarning(checkDepositCutoff(formData.event_date));
        if (availabilityDebounce.current) clearTimeout(availabilityDebounce.current);
        availabilityDebounce.current = setTimeout(async () => {
            const result = await checkDateAvailability(formData.event_date);
            setAvailabilityCheck(result);
        }, 450);
        return () => {
            if (availabilityDebounce.current) clearTimeout(availabilityDebounce.current);
        };
    }, [formData.event_date, validateDateLocally, checkDepositCutoff, checkDateAvailability]);

    // ============================================================
    // LOAD DATA
    // ============================================================
    const loadEventTypes = useCallback(async () => {
        try {
            const response = await bookingAPI.getEventTypes();
            if (response.data?.success) {
                const types = response.data.data?.data || response.data.data || [];
                setEventTypes(types.map((t) => ({
                    ...t,
                    value: t.event_type_id || t.id,
                    label: t.name || t.label || 'Event',
                    color: t.color || '#FF6B9D',
                })));
                if (types.length > 3) setShowEventTypeScrollHint(true);
            }
        } catch (error) {
            setEventTypes([
                { event_type_id: 1, name: 'Wedding', label: 'Wedding', color: '#FF6B9D' },
                { event_type_id: 2, name: 'Birthday', label: 'Birthday', color: '#FF9800' },
                { event_type_id: 3, name: 'Corporate', label: 'Corporate', color: '#4CAF50' },
                { event_type_id: 4, name: 'Seminar', label: 'Seminar', color: '#2196F3' },
                { event_type_id: 5, name: 'Fiesta', label: 'Fiesta', color: '#FF5722' },
                { event_type_id: 6, name: 'Other', label: 'Other', color: '#795548' },
            ]);
            setShowEventTypeScrollHint(true);
        }
    }, []);

    const loadMenuItems = useCallback(async () => {
        try {
            const result = await menuService.getPublicMenuItems({ is_available: true });
            if (result.success && result.data) {
                const formatted = result.data.map((item, i) => normalizeMenuForSelector(item, i));
                setMenuItems(formatted);
                const cats = [...new Set(formatted.map((i) => i.category || 'Uncategorized'))];
                setCategories(['All', 'From Cart', 'Packages', 'Promotions', ...cats]);
            }
        } catch (error) {
            console.log('Error loading menu items:', error);
        }
    }, []);

    const loadPackages = useCallback(async () => {
        try {
            const result = await packageService.getPublicPackages();
            if (result.success && result.data) {
                setPackages(result.data.map((item, i) => normalizePackageForSelector(item, i)));
            }
        } catch (error) {
            console.log('Error loading packages:', error);
        }
    }, []);

    const loadPromotions = useCallback(async () => {
        try {
            const result = await promotionService.getPublicPromotions();
            if (result.success && result.data) {
                setPromotions(result.data.map((item, i) => normalizePromotionForSelector(item, i)));
            }
        } catch (error) {
            console.log('Error loading promotions:', error);
        }
    }, []);

    // ============================================================
    // VALIDATION GATES
    // ============================================================
    const validateStep1 = useCallback(() => {
        if (!formData.customer_name?.trim()) { Alert.alert('Required', 'Please enter your full name'); return false; }
        if (!formData.customer_email?.includes('@')) { Alert.alert('Required', 'Please enter a valid email'); return false; }
        if (!formData.customer_phone?.trim()) { Alert.alert('Required', 'Please enter your phone number'); return false; }
        if (!formData.event_type_id) { Alert.alert('Required', 'Please select an event type'); return false; }
        if (!formData.event_date) { Alert.alert('Required', 'Please select an event date'); return false; }
        if (dateValidation?.type === 'error') { Alert.alert(dateValidation.title, dateValidation.message); return false; }
        if (availabilityCheck?.type === 'error') { Alert.alert(availabilityCheck.title, availabilityCheck.message); return false; }
        if (formData.event_scope === 'multi' && !formData.event_end_date) {
            Alert.alert('Required', 'Please select an end date for multi-day event'); return false;
        }
        if (formData.event_scope === 'multi' && formData.event_end_date <= formData.event_date) {
            Alert.alert('Invalid Date', 'End date must be after start date'); return false;
        }
        if (!formData.venue?.trim()) { Alert.alert('Required', 'Please enter event location'); return false; }
        const guestCount = parseInt(formData.guests_count);
        if (!guestCount || guestCount < 10) { Alert.alert('Required', 'Minimum of 10 guests required'); return false; }
        if (depositCutoffWarning) { setShowCutoffConfirm(true); return false; }
        return true;
    }, [formData, dateValidation, availabilityCheck, depositCutoffWarning]);

    const validateStep2 = useCallback(() => {
        const hasMeals = (formData.meal_services || []).some(
            (m) => (m.menu_items || []).length > 0 || (m.pax > 0 && m.price_per_head > 0)
        );
        if (!hasMeals) { Alert.alert('Required', 'Please configure at least one meal service'); return false; }
        return true;
    }, [formData.meal_services]);

    // ============================================================
    // NAVIGATION
    // ============================================================
    const handleNextStep = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dismissKeyboard();
        if (currentStep === 3 && isSubmitted) {
            Alert.alert(
                'Already Submitted',
                'This booking has already been submitted. Tap "Book New Event" to create another one.',
                [{ text: 'OK' }]
            );
            return;
        }
        if (currentStep === 1 && validateStep1()) {
            setCurrentStep(2);
            setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); setShowScrollIndicator(false); }, 100);
        } else if (currentStep === 2 && validateStep2()) {
            setCurrentStep(3);
            setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); setShowScrollIndicator(false); }, 100);
        } else if (currentStep === 3) {
            handleSubmit();
        }
    }, [currentStep, validateStep1, validateStep2, dismissKeyboard, isSubmitted, handleSubmit]);

    const handlePreviousStep = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dismissKeyboard();
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); setShowScrollIndicator(false); }, 100);
        }
    }, [currentStep, dismissKeyboard]);

    // ============================================================
    // SUBMIT
    // ============================================================
    const handleSubmit = useCallback(async () => {
        if (isSubmitted) {
            Alert.alert('Already Submitted', 'This booking has already been submitted.');
            return;
        }
        if (isGuest || !isAuthenticated) {
            Alert.alert('Login Required', 'Please login to submit a booking', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => navigation.navigate('Login') },
            ]);
            return;
        }
        if (dateValidation?.type === 'error') { Alert.alert(dateValidation.title, dateValidation.message); return; }
        if (availabilityCheck?.type === 'error') { Alert.alert(availabilityCheck.title, availabilityCheck.message); return; }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);

        try {
            const guestCount = parseInt(formData.guests_count) || 0;
            const totalAmount = calculateTotal();

            const selectedMeals = (formData.meal_services || []).filter((m) => {
                const hasMenuItems = Array.isArray(m.menu_items) && m.menu_items.length > 0;
                const hasManualMealCharge = Number(m.price_per_head || 0) > 0;
                return hasMenuItems || hasManualMealCharge;
            });

            if (selectedMeals.length === 0) {
                Alert.alert('Required', 'Please select at least one menu item.');
                setSubmitting(false);
                return;
            }

            const mealServices = selectedMeals.map((m) => {
                const normalizedPax = Math.max(1, parseInt(m.pax, 10) || guestCount || 1);
                const normalizedItems = Array.isArray(m.menu_items) ? m.menu_items : [];
                const customItems = normalizedItems.map((item) => ({
                    menu_item_id: item.menu_item_id || null,
                    item_name: item.name,
                    name: item.name,
                    quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
                    unit_price: parseFloat(item.price) || 0,
                    price: parseFloat(item.price) || 0,
                    pricing_type: item.pricing_type || 'per_pax',
                    per_pax_price: parseFloat(item.per_pax_price) || 0,
                    tray_price: parseFloat(item.tray_price) || 0,
                    notes: item.source_type ? `Selected from ${item.source_type}` : '',
                }));
                return {
                    day_number: Math.max(1, parseInt(m.day_number, 10) || 1),
                    meal_type: m.meal_type || 'lunch',
                    serving_time: m.serving_time || '12:00 PM',
                    pax: normalizedPax,
                    price_per_head: parseFloat(m.price_per_head) || 0,
                    menu_source: 'custom',
                    menu_mode: 'custom',
                    package_id: null,
                    menu_item_id: null,
                    menu_name: normalizedItems.map((item) => item.name).filter(Boolean).join(', '),
                    custom_items: customItems,
                    menu_items: normalizedItems.map((item) => ({
                        id: item.id,
                        menu_item_id: item.menu_item_id || null,
                        package_id: item.package_id || null,
                        promotion_id: item.promotion_id || null,
                        source_type: item.source_type || 'menu',
                        name: item.name,
                        price: parseFloat(item.price) || 0,
                        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
                        pricing_type: item.pricing_type || 'per_pax',
                    })),
                    total_meal_amount: getMealTotal({ ...m, pax: normalizedPax, menu_items: normalizedItems }),
                    notes: m.notes || '',
                };
            });

            const bookingData = {
                customer_name: formData.customer_name.trim(),
                customer_email: formData.customer_email.trim(),
                customer_phone: formData.customer_phone.trim(),
                event_type_id: formData.event_type_id,
                event_date: formData.event_date.toISOString().split('T')[0],
                event_end_date: formData.event_end_date ? formData.event_end_date.toISOString().split('T')[0] : null,
                event_time: formData.event_time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                venue: formData.venue.trim(),
                guests_count: guestCount,
                service_type: formData.service_type,
                booking_scope: formData.event_scope,
                total_days: formData.total_days,
                has_waiters: formData.has_waiters,
                meal_services: mealServices,
                transportation_fee: parseFloat(formData.transportation_fee) || 0,
                setup_fee: parseFloat(formData.setup_fee) || 0,
                service_crew_fee: parseFloat(formData.service_crew_fee) || 0,
                equipment_rental: parseFloat(formData.equipment_rental) || 0,
                extra_food_fee: parseFloat(formData.extra_food_fee) || 0,
                discount: parseFloat(formData.discount) || 0,
                delivery_method: formData.delivery_method,
                delivery_address: formData.delivery_method === 'delivery' ? formData.delivery_address : null,
                delivery_contact_person: formData.delivery_method === 'delivery' ? formData.delivery_contact_person : null,
                delivery_contact_phone: formData.delivery_method === 'delivery' ? formData.delivery_contact_phone : null,
                delivery_fee: formData.delivery_method === 'delivery' ? parseFloat(formData.delivery_fee) || 0 : 0,
                special_requests: formData.special_requests || null,
                menu_selection_type: isPackageBooking ? 'package' : 'custom',
                package_id: isPackageBooking ? (selectedPackage?.package_id || selectedPackage?.id) : null,
                promotion_id: isPromoBooking ? (selectedPromotion?.promotion_id || selectedPromotion?.id) : null,
                total_amount: totalAmount,
                required_deposit: totalAmount * 0.3,
                down_payment: parseFloat(formData.down_payment) || 0,
                payment_method: formData.payment_method,
                payment_reference: formData.payment_reference || null,
                transaction_id: formData.transaction_id || null,
            };

            const response = await bookingAPI.createBooking(bookingData);

            if (response.data?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const createdBooking = response.data?.data || {};
                setSuccessPayload({
                    booking_no: createdBooking.booking_no || createdBooking.booking_id || `BK-${Date.now().toString().slice(-6)}`,
                    event_date: formData.event_date,
                    guests_count: guestCount,
                    total_amount: totalAmount,
                    required_deposit: totalAmount * 0.3,
                });
                setIsSubmitted(true);
                await reloadCart().catch(() => {});
                setShowSuccessModal(true);
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to submit booking');
            }
        } catch (error) {
            console.log('Booking error:', error);
            const backendErrors = error?.response?.data?.errors;
            const backendMsg = error?.response?.data?.message;
            if (backendErrors) {
                const firstKey = Object.keys(backendErrors)[0];
                const firstMsg = Array.isArray(backendErrors[firstKey]) ? backendErrors[firstKey][0] : String(backendErrors[firstKey]);
                Alert.alert('Booking Rejected', firstMsg);
            } else {
                Alert.alert('Error', backendMsg || error.message || 'Failed to submit booking');
            }
        } finally {
            setSubmitting(false);
        }
    }, [
        formData, isGuest, isAuthenticated, navigation, calculateTotal, getMealTotal,
        isPackageBooking, selectedPackage, isPromoBooking, selectedPromotion,
        dateValidation, availabilityCheck, isSubmitted, reloadCart,
    ]);

    // ============================================================
    // RESCHEDULE ACTIONS
    // ============================================================
    const closeRescheduleModal = useCallback(() => {
        setRescheduleModal({ visible: false, mode: null, booking: null });
    }, []);

    const handleRescheduleAccept = async () => {
        if (!rescheduleModal.booking) return;
        setRescheduleBusy(true);
        try {
            const res = await bookingService.acceptReschedule(rescheduleModal.booking.booking_id);
            if (res.success) {
                Alert.alert('Accepted', 'Your booking has been rescheduled.');
                closeRescheduleModal();
            } else {
                Alert.alert('Error', res.message);
            }
        } finally {
            setRescheduleBusy(false);
        }
    };

    const handleRescheduleCounter = async ({ new_date, new_time, reason }) => {
        if (!rescheduleModal.booking) return;
        setRescheduleBusy(true);
        try {
            const res = await bookingService.counterReschedule(rescheduleModal.booking.booking_id, {
                new_date, new_time, reason,
            });
            if (res.success) {
                Alert.alert('Sent', 'Your counter-proposal was sent to the admin.');
                closeRescheduleModal();
            } else {
                Alert.alert('Error', res.message);
            }
        } finally {
            setRescheduleBusy(false);
        }
    };

    const handleRescheduleDecline = () => {
        Alert.alert('Cancel Booking?', 'Declining the proposed date will cancel the booking.', [
            { text: 'Back', style: 'cancel' },
            {
                text: 'Cancel Booking', style: 'destructive',
                onPress: async () => {
                    setRescheduleBusy(true);
                    try {
                        const res = await bookingService.declineAdminReschedule(
                            rescheduleModal.booking.booking_id,
                            'Customer declined reschedule.'
                        );
                        if (res.success) {
                            Alert.alert('Cancelled', 'Booking cancelled.');
                            closeRescheduleModal();
                        } else {
                            Alert.alert('Error', res.message);
                        }
                    } finally {
                        setRescheduleBusy(false);
                    }
                },
            },
        ]);
    };

    const handleRescheduleContinueOriginal = async () => {
        setRescheduleBusy(true);
        try {
            const res = await bookingService.continueOriginalSchedule(rescheduleModal.booking.booking_id);
            if (res.success) {
                Alert.alert('Continuing', 'Your original schedule is unchanged.');
                closeRescheduleModal();
            } else {
                Alert.alert('Error', res.message);
            }
        } finally {
            setRescheduleBusy(false);
        }
    };

    const handleRescheduleCancelAfterRejection = () => {
        Alert.alert('Cancel Booking?', 'This cannot be undone.', [
            { text: 'Back', style: 'cancel' },
            {
                text: 'Cancel Booking', style: 'destructive',
                onPress: async () => {
                    setRescheduleBusy(true);
                    try {
                        const res = await bookingService.cancelAfterRejectedReschedule(
                            rescheduleModal.booking.booking_id,
                            'Customer cancelled after rejected reschedule.'
                        );
                        if (res.success) {
                            Alert.alert('Cancelled', 'Booking cancelled.');
                            closeRescheduleModal();
                        } else {
                            Alert.alert('Error', res.message);
                        }
                    } finally {
                        setRescheduleBusy(false);
                    }
                },
            },
        ]);
    };

    // ============================================================
    // HELPERS
    // ============================================================
    const formatDateDisplay = useCallback((date) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        });
    }, []);

    const formatDateRangeDisplay = useCallback((startDate, endDate) => {
        if (!startDate) return 'Select Date Range';
        if (!endDate) return formatDateDisplay(startDate);
        return `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
    }, [formatDateDisplay]);

    const formatTimeDisplay = useCallback((date) => {
        if (!date) return 'Select Time';
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }, []);

    const getMealTypeColor = useCallback(
        (type) => MEAL_TYPES.find((m) => m.id === type)?.color || '#FF6B9D',
        []
    );

    const getFilteredMenuItems = useCallback(() => {
        const cartLines = (cartItems || []).map((item) => {
            const pricingType = (item.pricing_type || 'per_pax').toLowerCase();
            const price =
                parseFloat(item.unit_price) ||
                parseFloat(item.price) ||
                (pricingType === 'per_tray'
                    ? parseFloat(item.tray_price) || 0
                    : parseFloat(item.per_pax_price) || 0);
            return {
                ...item,
                id: `cart-${item.cart_item_id || item.menu_item_id}__${pricingType}`,
                menu_item_id: item.menu_item_id || item.id,
                source_type: 'cart',
                item_type: 'menu_item',
                category: 'From Cart',
                in_cart: true,
                pricing_type: pricingType,
                price,
                unit_price: price,
                has_per_pax_pricing: true,
                has_tray_pricing: (parseFloat(item.tray_price) || 0) > 0,
            };
        });

        const packageMenuLines = (packages || []).flatMap((pkg) =>
            (pkg.menu_items || []).map((m, i) => ({
                ...m,
                id: `pkg-${pkg.package_id}-${m.menu_item_id || i}`,
                menu_item_id: m.menu_item_id,
                package_id: pkg.package_id,
                package_name: pkg.name,
                source_type: 'package',
                item_type: 'menu_item',
                category: `Package: ${pkg.name}`,
                has_per_pax_pricing: true,
                has_tray_pricing: false,
                price: parseFloat(m.price) || parseFloat(pkg.base_price_per_pax) || 0,
                per_pax_price: parseFloat(m.price) || parseFloat(pkg.base_price_per_pax) || 0,
            }))
        );

        let items = [
            ...cartLines,
            ...menuItems,
            ...packageMenuLines,
            ...packages,
            ...promotions,
        ];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
                (item) =>
                    (item.name || '').toLowerCase().includes(q) ||
                    getCategoryName(item.category).toLowerCase().includes(q)
            );
        }
        if (selectedCategory !== 'All') {
            items = items.filter((item) => getCategoryName(item.category) === selectedCategory);
        }
        return items;
    }, [menuItems, packages, promotions, cartItems, searchQuery, selectedCategory]);

    const handleEventTypeScroll = (event) => {
        const x = event.nativeEvent.contentOffset.x;
        const contentWidth = event.nativeEvent.contentSize.width;
        const containerWidth = event.nativeEvent.layoutMeasurement.width;
        setEventTypeScrollX(x);
        setEventTypeContentWidth(contentWidth);
        setEventTypeContainerWidth(containerWidth);
        const left = x > 5;
        const right = x + containerWidth < contentWidth - 5;
        setCanScrollLeft(left);
        setCanScrollRight(right);
        setShowEventTypeScrollHint(left || right);
    };

    const handleEventTypeLayout = (event) => setEventTypeContainerWidth(event.nativeEvent.layout.width);

    const scrollEventTypeLeft = () => {
        if (eventTypeScrollRef.current && canScrollLeft) {
            const amount = Math.max(60, eventTypeContainerWidth * 0.6);
            eventTypeScrollRef.current.scrollTo({ x: Math.max(0, eventTypeScrollX - amount), animated: true });
        }
    };

    const scrollEventTypeRight = () => {
        if (eventTypeScrollRef.current && canScrollRight) {
            const amount = Math.max(60, eventTypeContainerWidth * 0.6);
            eventTypeScrollRef.current.scrollTo({
                x: Math.min(eventTypeContentWidth - eventTypeContainerWidth, eventTypeScrollX + amount),
                animated: true,
            });
        }
    };

    const handleScroll = useCallback((event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const contentHeight = event.nativeEvent.contentSize.height;
        const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
        contentHeightRef.current = contentHeight;
        scrollViewHeightRef.current = scrollViewHeight;
        const hasMore = contentHeight > scrollViewHeight + 30;
        const isAtBottom = offsetY + scrollViewHeight >= contentHeight - 20;
        setShowScrollIndicator(hasMore && !isAtBottom);
        scrollPosition.current = offsetY;
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = setTimeout(() => {
            const co = scrollPosition.current;
            const ch = contentHeightRef.current;
            const vh = scrollViewHeightRef.current;
            setShowScrollIndicator(ch > vh + 30 && co + vh < ch - 20);
        }, 300);
    }, []);

    const handleContentSizeChange = useCallback((contentWidth, contentHeight) => {
        contentHeightRef.current = contentHeight;
        setShowScrollIndicator(contentHeight > scrollViewHeightRef.current + 30);
        contentMeasured.current = true;
    }, []);

    const handleLayout = useCallback((event) => {
        const { height } = event.nativeEvent.layout;
        scrollViewHeightRef.current = height;
        if (contentHeightRef.current > 0) {
            setShowScrollIndicator(contentHeightRef.current > height + 30);
        }
    }, []);

    // ============================================================
    // RENDER EVENT SCOPE
    // ============================================================
    const renderEventScope = useCallback(() => {
        const isRegular = formData.event_scope === 'regular';
        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Scope <Text style={styles.required}>*</Text></Text>
                <View style={styles.scopeContainer}>
                    <TouchableOpacity
                        style={[styles.scopeOption, isRegular && styles.scopeOptionActive]}
                        onPress={() => {
                            dismissKeyboard();
                            updateFormField('event_scope', 'regular');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="calendar-today" size={18} color={isRegular ? '#FF6B9D' : '#B0B0B0'} />
                        <Text style={[styles.scopeOptionText, isRegular && styles.scopeOptionTextActive]}>Regular Event</Text>
                        <Text style={styles.scopeSubtext}>1 day event</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.scopeOption, !isRegular && styles.scopeOptionActive]}
                        onPress={() => {
                            dismissKeyboard();
                            updateFormField('event_scope', 'multi');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="calendar-multiple" size={18} color={!isRegular ? '#FF6B9D' : '#B0B0B0'} />
                        <Text style={[styles.scopeOptionText, !isRegular && styles.scopeOptionTextActive]}>Multi-Event</Text>
                        <Text style={styles.scopeSubtext}>More than 1 day</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }, [formData.event_scope, updateFormField, dismissKeyboard]);

    // ============================================================
    // RENDER DELIVERY METHOD
    // ============================================================
    const renderDeliveryMethod = useCallback(() => {
        const isDelivery = formData.delivery_method === 'delivery';
        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                        <MaterialCommunityIcons name="truck-delivery" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Delivery Method</Text>
                </View>
                <View style={styles.deliveryContainer}>
                    <TouchableOpacity
                        style={[styles.deliveryOption, !isDelivery && styles.deliveryOptionActive]}
                        onPress={() => { dismissKeyboard(); updateFormField('delivery_method', 'pickup'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        activeOpacity={0.7}
                    >
                        <Feather name="shopping-bag" size={18} color={!isDelivery ? '#FF6B9D' : '#B0B0B0'} />
                        <Text style={[styles.deliveryOptionText, !isDelivery && styles.deliveryOptionTextActive]}>Pickup</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.deliveryOption, isDelivery && styles.deliveryOptionActive]}
                        onPress={() => { dismissKeyboard(); updateFormField('delivery_method', 'delivery'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        activeOpacity={0.7}
                    >
                        <Feather name="truck" size={18} color={isDelivery ? '#FF6B9D' : '#B0B0B0'} />
                        <Text style={[styles.deliveryOptionText, isDelivery && styles.deliveryOptionTextActive]}>Delivery</Text>
                    </TouchableOpacity>
                </View>
                {isDelivery && (
                    <View style={styles.deliveryFields}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Delivery Address <Text style={styles.required}>*</Text></Text>
                            <View style={[styles.inputContainer, focusedInput === 'delivery_address' && styles.inputContainerFocused]}>
                                <Feather name="map-pin" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                <TextInput
                                    ref={(ref) => (inputRefs.current.delivery_address = ref)}
                                    style={styles.input}
                                    value={formData.delivery_address}
                                    onChangeText={(t) => updateFormField('delivery_address', t)}
                                    onFocus={() => handleFocus('delivery_address')}
                                    onBlur={handleBlur}
                                    placeholder="Enter delivery address"
                                    placeholderTextColor="#c0c0c0"
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onSubmitEditing={() => handleNextInput('delivery_address', 'delivery_contact_person')}
                                />
                            </View>
                        </View>
                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.label}>Contact Person</Text>
                                <View style={[styles.inputContainer, focusedInput === 'delivery_contact_person' && styles.inputContainerFocused]}>
                                    <Feather name="user" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                    <TextInput
                                        ref={(ref) => (inputRefs.current.delivery_contact_person = ref)}
                                        style={styles.input}
                                        value={formData.delivery_contact_person}
                                        onChangeText={(t) => updateFormField('delivery_contact_person', t)}
                                        onFocus={() => handleFocus('delivery_contact_person')}
                                        onBlur={handleBlur}
                                        placeholder="Contact person"
                                        placeholderTextColor="#c0c0c0"
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        onSubmitEditing={() => handleNextInput('delivery_contact_person', 'delivery_contact_phone')}
                                    />
                                </View>
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Contact Phone</Text>
                                <View style={[styles.inputContainer, focusedInput === 'delivery_contact_phone' && styles.inputContainerFocused]}>
                                    <Feather name="phone" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                    <TextInput
                                        ref={(ref) => (inputRefs.current.delivery_contact_phone = ref)}
                                        style={styles.input}
                                        value={formData.delivery_contact_phone}
                                        onChangeText={(t) => updateFormField('delivery_contact_phone', t)}
                                        onFocus={() => handleFocus('delivery_contact_phone')}
                                        onBlur={handleBlur}
                                        placeholder="Phone"
                                        placeholderTextColor="#c0c0c0"
                                        keyboardType="phone-pad"
                                        returnKeyType="done"
                                        onSubmitEditing={dismissKeyboard}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Delivery Fee</Text>
                            <View style={[styles.inputContainer, focusedInput === 'delivery_fee' && styles.inputContainerFocused]}>
                                <Text style={styles.currencySymbol}>₱</Text>
                                <TextInput
                                    ref={(ref) => (inputRefs.current.delivery_fee = ref)}
                                    style={styles.input}
                                    value={String(formData.delivery_fee || '')}
                                    onChangeText={(t) => updateFormField('delivery_fee', parseFloat(t) || 0)}
                                    onFocus={() => handleFocus('delivery_fee')}
                                    onBlur={handleBlur}
                                    placeholder="0.00"
                                    placeholderTextColor="#c0c0c0"
                                    keyboardType="numeric"
                                    returnKeyType="done"
                                    onSubmitEditing={dismissKeyboard}
                                />
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    }, [
        formData.delivery_method, formData.delivery_address, formData.delivery_contact_person,
        formData.delivery_contact_phone, formData.delivery_fee, focusedInput, updateFormField,
        handleFocus, handleBlur, handleNextInput, dismissKeyboard,
    ]);

    // ============================================================
    // RENDER STEP 1
    // ============================================================
    const renderStep1 = useCallback(() => {
        const isMultiDay = formData.event_scope === 'multi';
        const activeBanners = [];
        if (dateValidation) activeBanners.push(dateValidation);
        if (availabilityCheck) activeBanners.push(availabilityCheck);
        if (depositCutoffWarning) activeBanners.push(depositCutoffWarning);

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                {activeBanners.map((banner, idx) => (
                    <ValidationBanner
                        key={`${banner.code}-${idx}`}
                        type={banner.type}
                        title={banner.title}
                        message={banner.message}
                        icon={banner.icon || 'alert-circle'}
                    />
                ))}

                {isCheckingAvailability && (
                    <View style={styles.availabilityChecking}>
                        <ActivityIndicator size="small" color="#FF6B9D" />
                        <Text style={styles.availabilityCheckingText}>Checking availability…</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIcon}>
                            <MaterialCommunityIcons name="account" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'customer_name' && styles.inputContainerFocused]}>
                            <Feather name="user" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput
                                ref={(ref) => (inputRefs.current.customer_name = ref)}
                                style={styles.input}
                                value={formData.customer_name}
                                onChangeText={(t) => updateFormField('customer_name', t)}
                                onFocus={() => handleFocus('customer_name')}
                                onBlur={handleBlur}
                                placeholder="Enter your full name"
                                placeholderTextColor="#c0c0c0"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('customer_name', 'customer_email')}
                            />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'customer_email' && styles.inputContainerFocused]}>
                            <Feather name="mail" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput
                                ref={(ref) => (inputRefs.current.customer_email = ref)}
                                style={styles.input}
                                value={formData.customer_email}
                                onChangeText={(t) => updateFormField('customer_email', t)}
                                onFocus={() => handleFocus('customer_email')}
                                onBlur={handleBlur}
                                placeholder="Enter your email address"
                                placeholderTextColor="#c0c0c0"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('customer_email', 'customer_phone')}
                            />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'customer_phone' && styles.inputContainerFocused]}>
                            <Feather name="phone" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput
                                ref={(ref) => (inputRefs.current.customer_phone = ref)}
                                style={styles.input}
                                value={formData.customer_phone}
                                onChangeText={(t) => updateFormField('customer_phone', t)}
                                onFocus={() => handleFocus('customer_phone')}
                                onBlur={handleBlur}
                                placeholder="Enter your phone number"
                                placeholderTextColor="#c0c0c0"
                                keyboardType="phone-pad"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('customer_phone', 'event_scope')}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                            <MaterialCommunityIcons name="calendar-range" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Event Scope</Text>
                    </View>
                    {renderEventScope()}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: '#FF6B9D' }]}>
                            <MaterialCommunityIcons name="calendar" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Event Details</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Type <Text style={styles.required}>*</Text></Text>
                        <View style={styles.eventTypesWrapper}>
                            <ScrollView
                                ref={eventTypeScrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.eventTypesScrollContent}
                                nestedScrollEnabled={false}
                                keyboardShouldPersistTaps="handled"
                                onScroll={handleEventTypeScroll}
                                scrollEventThrottle={16}
                                onLayout={handleEventTypeLayout}
                                onContentSizeChange={(w) => {
                                    setEventTypeContentWidth(w);
                                    setTimeout(() => {
                                        if (eventTypeScrollRef.current && eventTypeContainerWidth > 0) {
                                            const canScroll = w > eventTypeContainerWidth;
                                            setCanScrollRight(canScroll);
                                            setShowEventTypeScrollHint(canScroll);
                                        }
                                    }, 100);
                                }}
                            >
                                {eventTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type.event_type_id || type.id}
                                        style={[
                                            styles.eventTypeCard,
                                            formData.event_type_id === (type.event_type_id || type.id) && styles.eventTypeCardActive,
                                        ]}
                                        onPress={() => {
                                            dismissKeyboard();
                                            updateFormField('event_type_id', type.event_type_id || type.id);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.eventTypeLabel,
                                            formData.event_type_id === (type.event_type_id || type.id) && styles.eventTypeLabelActive,
                                        ]}>
                                            {type.name || type.label || 'Event'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        <EventTypeScrollIndicator
                            visible={showEventTypeScrollHint}
                            canScrollLeft={canScrollLeft}
                            canScrollRight={canScrollRight}
                            onScrollLeft={scrollEventTypeLeft}
                            onScrollRight={scrollEventTypeRight}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            {isMultiDay ? 'Event Date Range' : 'Event Date'}{' '}
                            <Text style={styles.required}>*</Text>
                        </Text>
                        {isMultiDay ? (
                            <View>
                                <TouchableOpacity
                                    style={[
                                        styles.dateTimeSelector,
                                        focusedInput === 'event_date' && styles.inputContainerFocused,
                                        dateValidation?.type === 'error' && styles.dateTimeSelectorError,
                                    ]}
                                    onPress={() => { dismissKeyboard(); setFocusedInput('event_date'); setShowDatePicker(true); }}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="calendar-start" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                    <Text style={styles.dateTimeValue}>
                                        {formatDateDisplay(formData.event_date)}
                                        <Text style={styles.dateRangeLabel}> → </Text>
                                        {formData.event_end_date ? formatDateDisplay(formData.event_end_date) : 'Select End Date'}
                                    </Text>
                                </TouchableOpacity>
                                <View style={styles.dateRangeHint}>
                                    <Text style={styles.dateRangeHintText}>
                                        {formData.event_end_date
                                            ? `${Math.ceil((formData.event_end_date - formData.event_date) / (1000 * 60 * 60 * 24)) + 1} days total`
                                            : 'Tap to select start and end dates'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.dateTimeSelector,
                                    focusedInput === 'event_date' && styles.inputContainerFocused,
                                    dateValidation?.type === 'error' && styles.dateTimeSelectorError,
                                ]}
                                onPress={() => { dismissKeyboard(); setFocusedInput('event_date'); setShowDatePicker(true); }}
                                activeOpacity={0.7}
                            >
                                <Feather name="calendar" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                <Text style={styles.dateTimeValue}>{formatDateDisplay(formData.event_date)}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Time <Text style={styles.required}>*</Text></Text>
                        <TouchableOpacity
                            style={[styles.dateTimeSelector, focusedInput === 'event_time' && styles.inputContainerFocused]}
                            onPress={() => { dismissKeyboard(); setFocusedInput('event_time'); setShowTimePicker(true); }}
                            activeOpacity={0.7}
                        >
                            <Feather name="clock" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <Text style={styles.dateTimeValue}>{formatTimeDisplay(formData.event_time)}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Location <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'venue' && styles.inputContainerFocused]}>
                            <Feather name="map-pin" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput
                                ref={(ref) => (inputRefs.current.venue = ref)}
                                style={styles.input}
                                value={formData.venue}
                                onChangeText={(t) => updateFormField('venue', t)}
                                onFocus={() => handleFocus('venue')}
                                onBlur={handleBlur}
                                placeholder="Enter complete event address"
                                placeholderTextColor="#c0c0c0"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('venue', 'guests')}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Number of Guests <Text style={styles.required}>*</Text></Text>
                        {isPackageBooking && selectedPackage && (
                            <View style={styles.packageHintContainer}>
                                <Feather name="info" size={12} color="#FF6B9D" />
                                <Text style={styles.packageHint}>
                                    {selectedPackage.min_pax || 0} - {selectedPackage.max_pax || 100} guests
                                </Text>
                            </View>
                        )}
                        <View style={styles.guestSelector}>
                            <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={() => {
                                    dismissKeyboard();
                                    const current = parseInt(formData.guests_count) || 10;
                                    const min = isPackageBooking ? selectedPackage?.min_pax || 10 : 10;
                                    updateFormField('guests_count', Math.max(min, current - 10).toString());
                                }}
                                activeOpacity={0.7}
                            >
                                <Feather name="minus" size={16} color="#FF6B9D" />
                            </TouchableOpacity>
                            <View style={[styles.guestInputContainer, focusedInput === 'guests' && styles.inputContainerFocused]}>
                                <TextInput
                                    ref={(ref) => (inputRefs.current.guests = ref)}
                                    style={styles.guestInput}
                                    keyboardType="numeric"
                                    value={String(formData.guests_count)}
                                    onChangeText={(t) => updateFormField('guests_count', t)}
                                    onFocus={() => handleFocus('guests')}
                                    onBlur={handleBlur}
                                    placeholder="0"
                                    placeholderTextColor="#c0c0c0"
                                    textAlign="center"
                                    returnKeyType="done"
                                    onSubmitEditing={dismissKeyboard}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={() => {
                                    dismissKeyboard();
                                    const current = parseInt(formData.guests_count) || 0;
                                    const max = isPackageBooking ? selectedPackage?.max_pax || 999 : 999;
                                    updateFormField('guests_count', Math.min(max, current + 10).toString());
                                }}
                                activeOpacity={0.7}
                            >
                                <Feather name="plus" size={16} color="#FF6B9D" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hint}>
                            {isPackageBooking ? `Minimum ${selectedPackage?.min_pax || 10} guests required` : 'Minimum 10 guests required'}
                        </Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: '#4CAF50' }]}>
                            <MaterialCommunityIcons name="food" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Service Type</Text>
                    </View>
                    <View style={styles.serviceTypeGrid}>
                        {SERVICE_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                style={[styles.serviceTypeCard, formData.service_type === type.id && styles.serviceTypeCardActive]}
                                onPress={() => { dismissKeyboard(); updateFormField('service_type', type.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.serviceTypeIcon, { backgroundColor: type.color + '15' }]}>
                                    <MaterialCommunityIcons name={type.icon} size={22} color={type.color} />
                                </View>
                                <Text style={[styles.serviceTypeLabel, formData.service_type === type.id && styles.serviceTypeLabelActive]}>
                                    {type.label}
                                </Text>
                                {formData.service_type === type.id && (
                                    <View style={styles.serviceTypeCheck}>
                                        <Feather name="check" size={12} color="#FFF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={formData.event_date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            if (selectedDate) {
                                if (isMultiDay) {
                                    if (!formData.event_end_date) {
                                        const end = new Date(selectedDate);
                                        end.setDate(end.getDate() + 1);
                                        updateFormField('event_end_date', end);
                                    }
                                    updateFormField('event_date', selectedDate);
                                    setShowDatePicker(false);
                                    setFocusedInput(null);
                                    setTimeout(() => setShowEndDatePicker(true), 300);
                                } else {
                                    updateFormField('event_date', selectedDate);
                                    setShowDatePicker(false);
                                    setFocusedInput(null);
                                }
                            } else {
                                setShowDatePicker(false);
                                setFocusedInput(null);
                            }
                        }}
                        minimumDate={new Date()}
                    />
                )}
                {showEndDatePicker && (
                    <DateTimePicker
                        value={formData.event_end_date || formData.event_date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setShowEndDatePicker(false);
                            setFocusedInput(null);
                            if (selectedDate && selectedDate >= formData.event_date) {
                                updateFormField('event_end_date', selectedDate);
                            } else if (selectedDate) {
                                Alert.alert('Invalid Date', 'End date must be after start date');
                            }
                        }}
                        minimumDate={formData.event_date}
                    />
                )}
                {showTimePicker && (
                    <DateTimePicker
                        value={formData.event_time}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedTime) => {
                            setShowTimePicker(false);
                            setFocusedInput(null);
                            if (selectedTime) updateFormField('event_time', selectedTime);
                        }}
                    />
                )}
            </Animated.View>
        );
    }, [
        formData, focusedInput, eventTypes, showDatePicker, showEndDatePicker, showTimePicker,
        isPackageBooking, selectedPackage, showEventTypeScrollHint, canScrollLeft, canScrollRight,
        renderEventScope, updateFormField, handleFocus, handleBlur, handleNextInput,
        dismissKeyboard, formatDateDisplay, formatDateRangeDisplay, formatTimeDisplay,
        dateValidation, availabilityCheck, depositCutoffWarning, isCheckingAvailability,
        fadeAnim, handleEventTypeScroll, handleEventTypeLayout, scrollEventTypeLeft, scrollEventTypeRight,
    ]);

    
    // ============================================================
    // RENDER STEP 2
    // ============================================================
    const renderStep2 = useCallback(() => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#9C27B0' }]}>
                        <MaterialCommunityIcons name="food-variant" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Meal Services</Text>
                    <TouchableOpacity style={styles.addMealButton} onPress={() => { dismissKeyboard(); addMealService(); }} activeOpacity={0.7}>
                        <Feather name="plus" size={14} color="#FFF" />
                        <Text style={styles.addMealButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {(formData.meal_services || []).length === 0 ? (
                    <TouchableOpacity style={styles.emptyMealsContainer} onPress={() => addMealService()} activeOpacity={0.7}>
                        <Feather name="plus-circle" size={32} color="#FF6B9D" />
                        <Text style={styles.emptyMealsText}>Add your first meal service</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {(formData.meal_services || []).map((meal, index) => {
                            const isMultiDay = formData.event_scope === 'multi';
                            const totalDays = formData.total_days || 1;
                            const mealsForDay = formData.meal_services.filter((m) => m.day_number === meal.day_number);
                            const mealTypesForDay = mealsForDay.map((m) => m.meal_type);

                            return (
                                <View key={meal.id} style={styles.mealCard}>
                                    <View style={styles.mealCardHeader}>
                                        <View style={styles.mealCardTitle}>
                                            <View style={[styles.mealTypeDot, { backgroundColor: getMealTypeColor(meal.meal_type) }]} />
                                            {isMultiDay ? (
                                                <Text style={styles.mealCardDay}>Day {meal.day_number}</Text>
                                            ) : (
                                                <Text style={styles.mealCardDay}>Meal {index + 1}</Text>
                                            )}
                                            <Text style={styles.mealCardType}>
                                                {MEAL_TYPES.find((m) => m.id === meal.meal_type)?.label || meal.meal_type}
                                            </Text>
                                        </View>
                                        {formData.meal_services.length > 1 && (
                                            <TouchableOpacity style={styles.mealCardRemove} onPress={() => removeMealService(meal.id)} activeOpacity={0.7}>
                                                <Feather name="x" size={16} color="#F44336" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={styles.mealCardBody}>
                                        {isMultiDay && (
                                            <View style={styles.mealRow}>
                                                <View style={styles.mealField}>
                                                    <Text style={styles.mealLabel}>DAY</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorScroll} nestedScrollEnabled={false} keyboardShouldPersistTaps="handled">
                                                        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                                                            <TouchableOpacity
                                                                key={day}
                                                                style={[styles.dayOption, meal.day_number === day && styles.dayOptionActive]}
                                                                onPress={() => {
                                                                    dismissKeyboard();
                                                                    const mealType = meal.meal_type;
                                                                    const dup = formData.meal_services.some((m, idx) =>
                                                                        idx !== formData.meal_services.indexOf(meal) &&
                                                                        m.day_number === day &&
                                                                        m.meal_type === mealType
                                                                    );
                                                                    if (dup) { Alert.alert('Duplicate Meal', `${mealType} is already added for Day ${day}.`); return; }
                                                                    updateMealService(meal.id, { day_number: day });
                                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                }}
                                                                activeOpacity={0.7}
                                                            >
                                                                <Text style={[styles.dayOptionText, meal.day_number === day && styles.dayOptionTextActive]}>Day {day}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            </View>
                                        )}

                                        <View style={styles.mealRow}>
                                            <View style={styles.mealField}>
                                                <Text style={styles.mealLabel}>MEAL TYPE</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTypeSelectorScroll} nestedScrollEnabled={false} keyboardShouldPersistTaps="handled">
                                                    {MEAL_TYPES.map((type) => {
                                                        const isSelected = meal.meal_type === type.id;
                                                        const isDisabled = !isSelected && mealTypesForDay.includes(type.id);
                                                        return (
                                                            <TouchableOpacity
                                                                key={type.id}
                                                                style={[
                                                                    styles.mealTypeOption,
                                                                    isSelected && styles.mealTypeOptionActive,
                                                                    isDisabled && styles.mealTypeOptionDisabled,
                                                                    { borderColor: isSelected ? type.color : '#E8E0E3' },
                                                                ]}
                                                                onPress={() => {
                                                                    if (isDisabled) { Alert.alert('Duplicate Meal', `${type.label} is already added for Day ${meal.day_number}.`); return; }
                                                                    dismissKeyboard();
                                                                    updateMealService(meal.id, { meal_type: type.id });
                                                                }}
                                                                activeOpacity={0.7}
                                                                disabled={isDisabled}
                                                            >
                                                                <MaterialCommunityIcons name={type.icon} size={12} color={isSelected ? type.color : '#B0B0B0'} />
                                                                <Text style={[styles.mealTypeOptionText, isSelected && { color: type.color }, isDisabled && styles.mealTypeOptionTextDisabled]}>
                                                                    {type.label}
                                                                </Text>
                                                                {isDisabled && <Feather name="check" size={10} color="#B0B0B0" />}
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                            </View>
                                        </View>

                                        <View style={styles.mealRow}>
                                            <View style={[styles.mealField, { flex: 1, marginRight: 8 }]}>
                                                <Text style={styles.mealLabel}>SERVING TIME</Text>
                                                <TouchableOpacity style={styles.servingTimeSelector} onPress={() => openServingTimePicker(meal.id)} activeOpacity={0.7}>
                                                    <Feather name="clock" size={14} color="#FF6B9D" />
                                                    <Text style={styles.servingTimeText}>{meal.serving_time || '12:00 PM'}</Text>
                                                    <Feather name="chevron-down" size={14} color="#B0B0B0" />
                                                </TouchableOpacity>
                                            </View>
                                            <View style={[styles.mealField, { flex: 1 }]}>
                                                <Text style={styles.mealLabel}>PAX</Text>
                                                <TextInput
                                                    ref={(ref) => (inputRefs.current[`pax_${meal.id}`] = ref)}
                                                    style={styles.mealInput}
                                                    keyboardType="numeric"
                                                    value={String(meal.pax || '')}
                                                    onChangeText={(t) => updateMealService(meal.id, { pax: parseInt(t) || 0 })}
                                                    onFocus={() => handleFocus(`pax_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="0"
                                                    placeholderTextColor="#c0c0c0"
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.mealRow}>
                                            <View style={[styles.mealField, { flex: 1, marginRight: 8 }]}>
                                                <Text style={styles.mealLabel}>PRICE PER HEAD</Text>
                                                <TextInput
                                                    ref={(ref) => (inputRefs.current[`price_${meal.id}`] = ref)}
                                                    style={styles.mealInput}
                                                    keyboardType="numeric"
                                                    value={String(meal.price_per_head || '')}
                                                    onChangeText={(t) => updateMealService(meal.id, { price_per_head: parseFloat(t) || 0 })}
                                                    onFocus={() => handleFocus(`price_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="0.00"
                                                    placeholderTextColor="#c0c0c0"
                                                />
                                            </View>
                                            <View style={[styles.mealField, { flex: 1 }]}>
                                                <Text style={styles.mealLabel}>TOTAL</Text>
                                                <Text style={styles.mealTotal}>₱{getMealTotal(meal).toLocaleString()}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.menuSelectionSection}>
                                            <View style={styles.menuSelectionHeader}>
                                                <Text style={styles.mealLabel}>MENU ITEMS</Text>
                                                <TouchableOpacity style={styles.selectMenuButton} onPress={() => openMenuSelector(meal.id)} activeOpacity={0.7}>
                                                    <Feather name="plus-circle" size={14} color="#FF6B9D" />
                                                    <Text style={styles.selectMenuButtonText}>Select</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {(meal.menu_items || []).length > 0 ? (
                                                <View style={styles.selectedMenuItems}>
                                                    {(meal.menu_items || []).map((item) => (
                                                        <View key={item.id} style={styles.selectedMenuItem}>
                                                            <View style={styles.selectedMenuItemInfo}>
                                                                <Text style={styles.selectedMenuItemName} numberOfLines={1}>{item.name || 'Item'}</Text>
                                                                {item.pricing_type && (
                                                                    <View style={[
                                                                        styles.selectedPricingBadge,
                                                                        item.pricing_type === 'per_tray' ? styles.selectedPricingBadgeTray : styles.selectedPricingBadgePax,
                                                                    ]}>
                                                                        <Text style={[
                                                                            styles.selectedPricingBadgeText,
                                                                            item.pricing_type === 'per_tray' ? styles.selectedPricingBadgeTextTray : styles.selectedPricingBadgeTextPax,
                                                                        ]}>
                                                                            {item.pricing_type === 'per_tray' ? 'TRAY' : 'PAX'}
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                                <Text style={styles.selectedMenuItemPrice}>₱{parseFloat(item.price || 0).toFixed(2)}</Text>
                                                            </View>
                                                            <View style={styles.selectedMenuItemQty}>
                                                                <TouchableOpacity
                                                                    style={styles.qtyButton}
                                                                    onPress={() => updateMenuItemQuantity(meal.id, item.id, (parseInt(item.quantity, 10) || 1) - 1)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <Feather name="minus" size={10} color="#FF6B9D" />
                                                                </TouchableOpacity>
                                                                <Text style={styles.qtyText}>{item.quantity || 1}</Text>
                                                                <TouchableOpacity
                                                                    style={styles.qtyButton}
                                                                    onPress={() => updateMenuItemQuantity(meal.id, item.id, (parseInt(item.quantity, 10) || 1) + 1)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <Feather name="plus" size={10} color="#FF6B9D" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : (
                                                <TouchableOpacity style={styles.emptyMenuItems} onPress={() => openMenuSelector(meal.id)} activeOpacity={0.7}>
                                                    <Feather name="plus" size={18} color="#B0B0B0" />
                                                    <Text style={styles.emptyMenuItemsText}>No items selected</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View style={styles.mealRow}>
                                            <View style={styles.mealField}>
                                                <Text style={styles.mealLabel}>NOTES</Text>
                                                <TextInput
                                                    ref={(ref) => (inputRefs.current[`notes_${meal.id}`] = ref)}
                                                    style={[styles.mealInput, styles.mealNotesInput]}
                                                    value={meal.notes || ''}
                                                    onChangeText={(t) => updateMealService(meal.id, { notes: t })}
                                                    onFocus={() => handleFocus(`notes_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="Special requests..."
                                                    placeholderTextColor="#c0c0c0"
                                                    multiline
                                                    numberOfLines={2}
                                                    textAlignVertical="top"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}

                        <View style={styles.mealServicesTotal}>
                            <Text style={styles.mealServicesTotalLabel}>Meal Services Total</Text>
                            <Text style={styles.mealServicesTotalValue}>₱{getTotalMealServices().toLocaleString()}</Text>
                        </View>
                    </>
                )}
            </View>

            {renderDeliveryMethod()}

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#2196F3' }]}>
                        <MaterialCommunityIcons name="message-text" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Special Requests</Text>
                </View>
                <View style={[styles.textAreaContainer, focusedInput === 'special_requests' && styles.inputContainerFocused]}>
                    <TextInput
                        ref={(ref) => (inputRefs.current.special_requests = ref)}
                        style={styles.textArea}
                        value={formData.special_requests || ''}
                        onChangeText={(t) => updateFormField('special_requests', t)}
                        onFocus={() => handleFocus('special_requests')}
                        onBlur={handleBlur}
                        placeholder="Dietary restrictions, allergies, themes..."
                        placeholderTextColor="#c0c0c0"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                </View>
            </View>

            <ScrollIndicator visible={showScrollIndicator} animated={true} />

            {/* ========================= MENU SELECTOR MODAL ========================= */}
            <Modal visible={showMenuSelector} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMenuSelector(false)}>
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowMenuSelector(false)} activeOpacity={0.7}>
                            <Feather name="x" size={22} color="#2D2D2D" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Menu Items</Text>
                        <TouchableOpacity onPress={confirmMenuSelection} activeOpacity={0.7}>
                            <Text style={styles.modalDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.selectorPricingRow}>
                        <Text style={styles.selectorPricingLabel}>Pricing view:</Text>
                        <View style={styles.selectorPricingToggle}>
                            <TouchableOpacity
                                style={[styles.selectorPricingOption, selectorPricingMode === 'per_pax' && styles.selectorPricingOptionActive]}
                                onPress={() => setSelectorPricingMode('per_pax')}
                                activeOpacity={0.8}
                            >
                                <Feather name="users" size={12} color={selectorPricingMode === 'per_pax' ? '#FFF' : '#6B7280'} />
                                <Text style={[styles.selectorPricingOptionText, selectorPricingMode === 'per_pax' && styles.selectorPricingOptionTextActive]}>
                                    Per Pax
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.selectorPricingOption, selectorPricingMode === 'per_tray' && styles.selectorPricingOptionActive]}
                                onPress={() => setSelectorPricingMode('per_tray')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="food-turkey" size={12} color={selectorPricingMode === 'per_tray' ? '#FFF' : '#6B7280'} />
                                <Text style={[styles.selectorPricingOptionText, selectorPricingMode === 'per_tray' && styles.selectorPricingOptionTextActive]}>
                                    Food Tray
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.modalSearch}>
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={16} color="#B0B0B0" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search items..."
                                placeholderTextColor="#c0c0c0"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    <View style={styles.modalCategories}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                                    onPress={() => setSelectedCategory(cat)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.modalViewToggle}>
                        <TouchableOpacity style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]} onPress={() => setViewMode('grid')} activeOpacity={0.7}>
                            <Feather name="grid" size={16} color={viewMode === 'grid' ? '#FFF' : '#FF6B9D'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]} onPress={() => setViewMode('list')} activeOpacity={0.7}>
                            <Feather name="list" size={16} color={viewMode === 'list' ? '#FFF' : '#FF6B9D'} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        key={`menu-${viewMode}`}
                        data={getFilteredMenuItems()}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={viewMode === 'grid' ? 2 : 1}
                        contentContainerStyle={styles.menuItemsList}
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        removeClippedSubviews={true}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => {
                            const isMenuItem = item.item_type === 'menu_item';
                            const isPackage = item.item_type === 'package';
                            const mode = isMenuItem ? selectorPricingMode : 'per_pax';
                            const previewPrice = isMenuItem ? effectiveSelectorPrice(item, mode) : parseFloat(item.price) || 0;
                            const isSelected = tempSelectedItems.some((i) => i.id === `${item.id}__${mode}`);
                            const trayDisabled = isMenuItem && selectorPricingMode === 'per_tray' && !item.has_tray_pricing;
                            const paxDisabled = isMenuItem && selectorPricingMode === 'per_pax' && !item.has_per_pax_pricing;

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    disabled={trayDisabled || paxDisabled}
                                    style={[
                                        viewMode === 'grid' ? styles.menuItemGrid : styles.menuItemList,
                                        isSelected && (viewMode === 'grid' ? styles.menuItemGridSelected : styles.menuItemListSelected),
                                        (trayDisabled || paxDisabled) && styles.menuItemDisabled,
                                    ]}
                                    onPress={() => toggleMenuItem(item)}
                                    activeOpacity={0.7}
                                >
                                    {viewMode === 'grid' ? (
                                        <>
                                            {item.source_type === 'cart' && (
                                                <View style={styles.sourceBadgeCart}>
                                                    <Text style={styles.sourceBadgeText}>CART</Text>
                                                </View>
                                            )}
                                            {item.source_type === 'package' && (
                                                <View style={styles.sourceBadgePackage}>
                                                    <Text style={styles.sourceBadgeText}>PKG</Text>
                                                </View>
                                            )}
                                            {item.source_type === 'promotion' && (
                                                <View style={styles.sourceBadgePromo}>
                                                    <Text style={styles.sourceBadgeText}>PROMO</Text>
                                                </View>
                                            )}
                                            <View style={styles.menuItemGridImage}>
                                                {(item.image || item.image_url) ? (
                                                    <Image
                                                        source={{ uri: item.image || item.image_url }}
                                                        style={styles.menuItemGridImageImg}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <MaterialCommunityIcons name={isPackage ? 'package-variant-closed' : 'food'} size={24} color="#FF6B9D" />
                                                )}
                                            </View>
                                            <Text style={styles.menuItemGridName} numberOfLines={2}>{item.name || 'Unnamed'}</Text>
                                            <Text style={styles.menuItemGridCategory} numberOfLines={1}>{getCategoryName(item.category)}</Text>
                                            {item.package_name && (
                                                <Text style={styles.menuItemGridPackage} numberOfLines={1}>
                                                    in {item.package_name}
                                                </Text>
                                            )}
                                            <Text style={styles.menuItemGridPrice}>
                                                ₱{previewPrice.toLocaleString()}
                                                {isMenuItem && (mode === 'per_tray' ? '/tray' : '/pax')}
                                            </Text>
                                            {isMenuItem && item.has_tray_pricing && item.tray_min_pax > 0 && (
                                                <Text style={styles.menuItemHint}>
                                                    {mode === 'per_tray'
                                                        ? `${item.tray_min_pax}–${item.tray_max_pax} pax per tray`
                                                        : `Tray ₱${item.tray_price} · ${item.tray_min_pax}–${item.tray_max_pax} pax`}
                                                </Text>
                                            )}

                                            {/* ⭐ View button for packages (grid) */}
                                            {isPackage && (
                                                <TouchableOpacity
                                                    style={styles.pkgViewBtnGrid}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        openPackageDetails(item);
                                                    }}
                                                    activeOpacity={0.8}
                                                >
                                                    <Feather name="eye" size={10} color="#FF6B9D" />
                                                    <Text style={styles.pkgViewBtnGridText}>
                                                        View {Array.isArray(item.menu_items) ? item.menu_items.length : 0} items
                                                    </Text>
                                                </TouchableOpacity>
                                            )}

                                            {isSelected && (
                                                <View style={styles.menuItemGridCheck}>
                                                    <Feather name="check" size={10} color="#FFF" />
                                                </View>
                                            )}
                                        </>
                                    ) : (
                                        <View style={styles.menuItemListContent}>
                                            <View style={styles.menuItemListThumb}>
                                                {(item.image || item.image_url) ? (
                                                    <Image
                                                        source={{ uri: item.image || item.image_url }}
                                                        style={styles.menuItemListThumbImg}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <MaterialCommunityIcons name={isPackage ? 'package-variant-closed' : 'food'} size={18} color="#FF6B9D" />
                                                )}
                                            </View>
                                            <View style={styles.menuItemListInfo}>
                                                <Text style={styles.menuItemListName}>{item.name || 'Unnamed'}</Text>
                                                <Text style={styles.menuItemListCategory}>{getCategoryName(item.category)}</Text>
                                                {item.package_name && (
                                                    <Text style={styles.menuItemListPackage}>in {item.package_name}</Text>
                                                )}

                                                {/* ⭐ View button for packages (list) */}
                                                {isPackage && (
                                                    <TouchableOpacity
                                                        style={styles.pkgViewBtnList}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            openPackageDetails(item);
                                                        }}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Feather name="eye" size={11} color="#FF6B9D" />
                                                        <Text style={styles.pkgViewBtnListText}>
                                                            View {Array.isArray(item.menu_items) ? item.menu_items.length : 0} items
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <Text style={styles.menuItemListPrice}>
                                                ₱{previewPrice.toLocaleString()}
                                                {isMenuItem && (mode === 'per_tray' ? '/tray' : '/pax')}
                                            </Text>
                                            {isSelected && (
                                                <View style={styles.menuItemListCheck}>
                                                    <Feather name="check" size={12} color="#FFF" />
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyListContainer}>
                                <MaterialCommunityIcons name="food-off" size={40} color="#B0B0B0" />
                                <Text style={styles.emptyListText}>No items found</Text>
                            </View>
                        }
                    />

                    <View style={styles.modalFooter}>
                        <Text style={styles.modalFooterText}>{tempSelectedItems.length} items selected</Text>
                        <TouchableOpacity style={styles.modalDoneButton} onPress={confirmMenuSelection} activeOpacity={0.7}>
                            <Text style={styles.modalDoneButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* ========================= PACKAGE DETAILS MODAL ========================= */}
            <PackageDetailsModal
                visible={showPackageDetails}
                packageData={packageDetailsData}
                onClose={closePackageDetails}
                onPickAll={handlePickAllFromPackage}
            />

            {/* ========================= SERVING TIME PICKER MODAL ========================= */}
            <Modal visible={showServingTimePicker} transparent animationType="fade" onRequestClose={() => setShowServingTimePicker(false)}>
                <View style={styles.timePickerOverlay}>
                    <View style={styles.timePickerCard}>
                        <View style={styles.timePickerHeader}>
                            <Text style={styles.timePickerTitle}>Select Serving Time</Text>
                            <TouchableOpacity onPress={() => setShowServingTimePicker(false)} activeOpacity={0.7}>
                                <Feather name="x" size={20} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.timePickerBody}>
                            <DateTimePicker
                                value={servingTimeDraft}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                                onChange={(event, picked) => {
                                    if (picked) setServingTimeDraft(picked);
                                    if (Platform.OS !== 'ios') setTimeout(() => applyServingTime(), 50);
                                }}
                                style={{ width: '100%' }}
                            />
                        </View>
                        {Platform.OS === 'ios' && (
                            <View style={styles.timePickerActions}>
                                <TouchableOpacity style={[styles.timePickerBtn, styles.timePickerBtnCancel]} onPress={() => setShowServingTimePicker(false)}>
                                    <Text style={styles.timePickerBtnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.timePickerBtn, styles.timePickerBtnConfirm]} onPress={applyServingTime}>
                                    <Text style={styles.timePickerBtnConfirmText}>Set Time</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </Animated.View>
    ), [
        formData, focusedInput, showMenuSelector, tempSelectedItems, searchQuery, selectedCategory,
        viewMode, categories, showScrollIndicator, getFilteredMenuItems, getMealTotal,
        getTotalMealServices, addMealService, removeMealService, updateMealService,
        updateMenuItemQuantity, openMenuSelector, toggleMenuItem, confirmMenuSelection,
        renderDeliveryMethod, handleFocus, handleBlur, updateFormField, dismissKeyboard,
        selectorPricingMode, showServingTimePicker, servingTimeDraft, openServingTimePicker, applyServingTime,
        fadeAnim, getMealTypeColor,
        showPackageDetails, packageDetailsData, openPackageDetails, closePackageDetails, handlePickAllFromPackage,
    ]);

    // ============================================================
    // RENDER STEP 3
    // ============================================================
    const renderStep3 = useCallback(() => {
        const total = calculateTotal();
        const mealTotal = getTotalMealServices();
        const additionalCharges = calculateAdditionalCharges();
        const discount = calculateDiscount();

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                {depositCutoffWarning && (
                    <ValidationBanner
                        type="warning"
                        title={depositCutoffWarning.title}
                        message={depositCutoffWarning.message}
                        icon="clock"
                    />
                )}

                <View style={styles.summaryCard}>
                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="account" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Customer</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Name:</Text>
                            <Text style={styles.summaryValue}>{formData.customer_name}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Email:</Text>
                            <Text style={styles.summaryValue}>{formData.customer_email}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Phone:</Text>
                            <Text style={styles.summaryValue}>{formData.customer_phone}</Text>
                        </View>
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="calendar" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Event</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Scope:</Text>
                            <Text style={styles.summaryValue}>
                                {formData.event_scope === 'regular' ? 'Regular Event' : 'Multi-Event'}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Type:</Text>
                            <Text style={styles.summaryValue}>
                                {eventTypes.find((t) => (t.event_type_id || t.id) === formData.event_type_id)?.name || 'General'}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Date:</Text>
                            <Text style={styles.summaryValue}>
                                {formData.event_scope === 'multi' && formData.event_end_date
                                    ? formatDateRangeDisplay(formData.event_date, formData.event_end_date)
                                    : formatDateDisplay(formData.event_date)}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Time:</Text>
                            <Text style={styles.summaryValue}>{formatTimeDisplay(formData.event_time)}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Venue:</Text>
                            <Text style={styles.summaryValue}>{formData.venue}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Guests:</Text>
                            <Text style={styles.summaryValue}>{formData.guests_count} persons</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Service:</Text>
                            <Text style={styles.summaryValue}>
                                {SERVICE_TYPES.find((t) => t.id === formData.service_type)?.label || formData.service_type}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="food" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Meal Services</Text>
                        </View>
                        {(formData.meal_services || []).map((meal) => (
                            <View key={meal.id} style={styles.summaryMealItem}>
                                <View style={styles.summaryMealHeader}>
                                    <Text style={styles.summaryMealTitle}>
                                        {formData.event_scope === 'multi' ? `Day ${meal.day_number} - ` : ''}
                                        {MEAL_TYPES.find((m) => m.id === meal.meal_type)?.label || meal.meal_type}
                                    </Text>
                                    <Text style={styles.summaryMealAmount}>₱{getMealTotal(meal).toLocaleString()}</Text>
                                </View>
                                {(meal.menu_items || []).map((item) => (
                                    <View key={item.id} style={styles.summaryMenuItem}>
                                        <Text style={styles.summaryMenuItemName}>
                                            • {item.name} x{item.quantity || 1}
                                            {item.pricing_type === 'per_tray' ? ' (tray)' : ''}
                                        </Text>
                                        <Text style={styles.summaryMenuItemPrice}>
                                            ₱{(item.price * (item.quantity || 1)).toLocaleString()}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="cash" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Charges</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Meal Services:</Text>
                            <Text style={styles.summaryValue}>₱{mealTotal.toLocaleString()}</Text>
                        </View>
                        {additionalCharges > 0 && (
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Other fees:</Text>
                                <Text style={styles.summaryValue}>₱{additionalCharges.toLocaleString()}</Text>
                            </View>
                        )}
                        {discount > 0 && (
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Discount:</Text>
                                <Text style={[styles.summaryValue, styles.summaryDiscount]}>-₱{discount.toLocaleString()}</Text>
                            </View>
                        )}
                        <View style={styles.summaryDivider} />
                        <View style={[styles.summaryItem, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total:</Text>
                            <Text style={styles.totalAmount}>₱{total.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.summaryItem, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Deposit (30%):</Text>
                            <Text style={[styles.totalAmount, styles.depositAmount]}>₱{(total * 0.3).toLocaleString()}</Text>
                        </View>
                    </View>

                    {formData.delivery_method === 'delivery' && (
                        <View style={styles.summarySection}>
                            <View style={styles.summarySectionHeader}>
                                <MaterialCommunityIcons name="truck-delivery" size={14} color="#FF6B9D" />
                                <Text style={styles.summarySectionTitle}>Delivery</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Address:</Text>
                                <Text style={styles.summaryValue}>{formData.delivery_address || 'N/A'}</Text>
                            </View>
                            {formData.delivery_contact_person && (
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Contact:</Text>
                                    <Text style={styles.summaryValue}>{formData.delivery_contact_person}</Text>
                                </View>
                            )}
                            {formData.delivery_fee > 0 && (
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                                    <Text style={styles.summaryValue}>₱{formData.delivery_fee.toLocaleString()}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {formData.special_requests && (
                        <View style={styles.summarySection}>
                            <View style={styles.summarySectionHeader}>
                                <MaterialCommunityIcons name="message-text" size={14} color="#FF6B9D" />
                                <Text style={styles.summarySectionTitle}>Requests</Text>
                            </View>
                            <Text style={styles.specialRequestsText}>{formData.special_requests}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.infoCard}>
                    <Feather name="info" size={14} color="#FF6B9D" />
                    <Text style={styles.infoText}>
                        30% downpayment required to confirm. Final pricing may vary.
                    </Text>
                </View>
            </Animated.View>
        );
    }, [
        formData, eventTypes, getMealTotal, getTotalMealServices, calculateTotal,
        calculateAdditionalCharges, calculateDiscount, formatDateDisplay,
        formatDateRangeDisplay, formatTimeDisplay, depositCutoffWarning, fadeAnim,
    ]);

    // ============================================================
    // INIT
    // ============================================================
    useEffect(() => {
        if (hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;

        isMounted.current = true;
        const init = async () => {
            setLoading(true);
            await Promise.all([loadEventTypes(), loadMenuItems(), loadPackages(), loadPromotions()]);
            initializeMealServices();
            setLoading(false);
        };
        init();

        if (routePackage || routePackageId) {
            const loadPackage = async () => {
                let packageData = routePackage;
                if (!packageData && routePackageId) {
                    const response = await packageService.getPackage(routePackageId);
                    if (response.success) packageData = response.data;
                }
                if (packageData) {
                    setSelectedPackage(packageData);
                    setIsPackageBooking(true);
                    setFormData((prev) => ({
                        ...prev,
                        guests_count: String(packageData.min_pax || 50),
                        event_type_id: packageData.event_type_id || prev.event_type_id,
                        package_id: packageData.package_id || packageData.id,
                        menu_selection_type: 'package',
                    }));
                }
            };
            loadPackage();
        }

        if (routePromotion || routePromotionId) {
            const loadPromotion = async () => {
                let promotionData = routePromotion;
                if (!promotionData && routePromotionId) {
                    const response = await promotionService.getPromotion(routePromotionId);
                    if (response.success) promotionData = response.data;
                }
                if (promotionData) {
                    setSelectedPromotion(promotionData);
                    setIsPromoBooking(true);
                    setFormData((prev) => ({
                        ...prev,
                        guests_count: '50',
                        event_type_id: promotionData.event_type_id || prev.event_type_id,
                        promotion_id: promotionData.promotion_id || promotionData.id,
                    }));
                }
            };
            loadPromotion();
        }

        if (routeRescheduleBooking) {
            const mode =
                routeRescheduleBooking.reschedule_status === 'pending' &&
                routeRescheduleBooking.reschedule_proposed_by === 'admin'
                    ? 'customer-admin-proposal'
                    : routeRescheduleBooking.booking_status === 'reschedule_rejected'
                    ? 'customer-after-rejection'
                    : null;
            if (mode) {
                setTimeout(() => {
                    setRescheduleModal({
                        visible: true,
                        mode,
                        booking: routeRescheduleBooking,
                    });
                }, 350);
            }
        }

        return () => {
            isMounted.current = false;
            if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
            if (availabilityDebounce.current) clearTimeout(availabilityDebounce.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // MAIN RENDER
    // ============================================================
    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#FF6B9D" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient colors={['#FFFFFF', '#FFF8FA', '#FFF5F8']} style={styles.gradient}>
                <View style={styles.header}>
                    <View style={styles.headerPlaceholder} />
                    <Text style={styles.headerTitle}>Plan Your Event</Text>
                    <View style={styles.headerPlaceholder} />
                </View>

                <StepIndicator currentStep={currentStep} steps={[1, 2, 3]} />

                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
                >
                    <ScrollView
                        ref={scrollViewRef}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        contentContainerStyle={styles.scrollContent}
                        nestedScrollEnabled={false}
                        scrollEventThrottle={16}
                        bounces={true}
                        overScrollMode="always"
                        scrollEnabled={true}
                        onScroll={handleScroll}
                        onContentSizeChange={handleContentSizeChange}
                        onLayout={handleLayout}
                    >
                        <View style={styles.card}>
                            {currentStep === 1 && renderStep1()}
                            {currentStep === 2 && renderStep2()}
                            {currentStep === 3 && renderStep3()}
                        </View>

                        <ScrollIndicator visible={showScrollIndicator} animated={true} />
                        <View style={{ height: 100 }} />
                    </ScrollView>
                </KeyboardAvoidingView>

                <View style={styles.footerWrapper}>
                    <View style={styles.buttonContainer}>
                        {currentStep > 1 && (
                            <TouchableOpacity style={styles.backStepButton} onPress={handlePreviousStep} activeOpacity={0.7}>
                                <Feather name="arrow-left" size={16} color="#FF6B9D" />
                                <Text style={styles.backStepText}>Back</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.nextButton,
                                currentStep > 1 ? styles.nextButtonWithBack : styles.nextButtonFull,
                                currentStep === 3 && isSubmitted && styles.nextButtonDisabled,
                            ]}
                            onPress={handleNextStep}
                            disabled={loading || submitting || (currentStep === 3 && isSubmitted)}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={
                                    currentStep === 3 && isSubmitted
                                        ? ['#B0B0B0', '#C8C8C8']
                                        : ['#FF6B9D', '#FF8FB1']
                                }
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {loading || submitting ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : currentStep === 3 && isSubmitted ? (
                                    <>
                                        <Feather name="check-circle" size={16} color="#FFF" />
                                        <Text style={styles.nextButtonText}>Submitted</Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.nextButtonText}>
                                            {currentStep === 3 ? 'Submit Booking' : 'Continue'}
                                        </Text>
                                        <Feather name="arrow-right" size={16} color="#FFF" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            {/* Deposit cutoff confirmation */}
            <Modal visible={showCutoffConfirm} transparent animationType="fade" onRequestClose={() => setShowCutoffConfirm(false)}>
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmCard}>
                        <View style={styles.confirmIconCircle}>
                            <Feather name="clock" size={28} color="#FF9800" />
                        </View>
                        <Text style={styles.confirmTitle}>Deposit cutoff is close</Text>
                        <Text style={styles.confirmMessage}>
                            {depositCutoffWarning?.message ||
                                'Your event is close. Standard policy requires the deposit 7 days before the event.'}
                        </Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                                onPress={() => setShowCutoffConfirm(false)}
                            >
                                <Text style={styles.confirmBtnCancelText}>Review</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, styles.confirmBtnConfirm]}
                                onPress={() => {
                                    setShowCutoffConfirm(false);
                                    setCurrentStep(2);
                                    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
                                }}
                            >
                                <Text style={styles.confirmBtnConfirmText}>I Understand</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Booking success modal */}
            <BookingSuccessModal
                visible={showSuccessModal}
                booking={successPayload || {}}
                onClose={() => setShowSuccessModal(false)}
                onViewOrders={() => {
                    setShowSuccessModal(false);
                    clearCart();
                    navigation.navigate('OrdersTab');
                }}
                onGoHome={() => {
                    setShowSuccessModal(false);
                    clearCart();
                    navigation.navigate('HomeTab');
                }}
                onBookNew={() => {
                    clearCart();
                    handleBookNewEvent();
                }}
            />

            {/* Reschedule workflow modal */}
            <RescheduleModal
                visible={rescheduleModal.visible}
                mode={rescheduleModal.mode}
                booking={rescheduleModal.booking}
                submitting={rescheduleBusy}
                onClose={closeRescheduleModal}
                onAccept={handleRescheduleAccept}
                onCounter={handleRescheduleCounter}
                onDecline={handleRescheduleDecline}
                onContinueOriginal={handleRescheduleContinueOriginal}
                onCancelBooking={handleRescheduleCancelAfterRejection}
            />
        </View>
    );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    gradient: { flex: 1 },
    scrollContent: { paddingBottom: 10, paddingTop: 4, flexGrow: 1 },
    keyboardView: { flex: 1 },

    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 8,
        backgroundColor: '#FFFFFF',
        zIndex: 20,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#2D2D2D', letterSpacing: 0.5 },
    headerPlaceholder: { width: 30 },
    loadingText: { marginTop: 16, color: '#8E8E93' },

    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
        marginHorizontal: 16,
    },

    section: {
        backgroundColor: '#F9F6F7',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0E8EB',
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
    sectionIcon: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: '#FF6B9D', justifyContent: 'center', alignItems: 'center',
    },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: '#2D2D2D', flex: 1, letterSpacing: 0.3 },

    inputGroup: { marginBottom: 10 },
    label: { fontSize: 11, fontWeight: '600', color: '#5A5A5E', marginBottom: 3, letterSpacing: 0.2 },
    required: { color: '#F44336' },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 8,
        borderWidth: 1.5, borderColor: '#E8E0E3',
        paddingHorizontal: 10, height: 42, minHeight: 42,
    },
    inputContainerFocused: {
        borderColor: '#FF6B9D', borderWidth: 2, backgroundColor: '#FFF',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 13, color: '#2D2D2D', paddingVertical: 8, height: '100%' },
    row: { flexDirection: 'row', gap: 6 },
    currencySymbol: { fontSize: 13, fontWeight: '600', color: '#2D2D2D', marginRight: 4 },

    eventTypesWrapper: { flexDirection: 'row', position: 'relative' },
    eventTypesScrollContent: { paddingRight: 12, gap: 4, paddingVertical: 2 },
    eventTypeCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 10, borderWidth: 1.5, borderColor: '#E8E0E3', marginRight: 4,
    },
    eventTypeCardActive: {
        backgroundColor: '#FFF0F5', borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
    },
    eventTypeLabel: { fontSize: 11, fontWeight: '500', color: '#5A5A5E' },
    eventTypeLabelActive: { color: '#FF6B9D', fontWeight: '600' },

    dateTimeSelector: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 8,
        borderWidth: 1.5, borderColor: '#E8E0E3',
        paddingHorizontal: 10, height: 42,
    },
    dateTimeSelectorError: { borderColor: '#F44336', backgroundColor: '#FFF5F5' },
    dateTimeValue: { fontSize: 12, fontWeight: '500', color: '#2D2D2D', flex: 1 },
    dateRangeLabel: { fontSize: 11, color: '#FF6B9D', fontWeight: '600' },
    dateRangeHint: { marginTop: 2, paddingHorizontal: 4 },
    dateRangeHintText: { fontSize: 9, color: '#B0B0B0', fontStyle: 'italic' },

    guestSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepperButton: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#FFF5F8', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: '#FFE8EE',
    },
    guestInputContainer: {
        flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8,
        borderWidth: 1.5, borderColor: '#E8E0E3',
        paddingHorizontal: 4, height: 42, justifyContent: 'center',
    },
    guestInput: {
        fontSize: 14, fontWeight: '600', color: '#2D2D2D',
        textAlign: 'center', paddingVertical: 8,
    },
    hint: { fontSize: 9, color: '#B0B0B0', marginTop: 2, marginLeft: 4 },
    packageHintContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF5F8', paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 5, marginBottom: 3, gap: 3,
    },
    packageHint: { fontSize: 9, color: '#FF6B9D' },

    serviceTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    serviceTypeCard: {
        flex: 1, minWidth: 80, backgroundColor: '#FFFFFF', borderRadius: 10,
        padding: 10, alignItems: 'center',
        borderWidth: 1.5, borderColor: '#E8E0E3', position: 'relative',
    },
    serviceTypeCardActive: {
        borderColor: '#FF6B9D', borderWidth: 2, backgroundColor: '#FFF5F8',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    serviceTypeIcon: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    },
    serviceTypeLabel: { fontSize: 10, fontWeight: '500', color: '#2D2D2D', textAlign: 'center' },
    serviceTypeLabelActive: { color: '#FF6B9D', fontWeight: '600' },
    serviceTypeCheck: {
        position: 'absolute', top: 3, right: 3,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: '#FF6B9D', justifyContent: 'center', alignItems: 'center',
    },

    scopeContainer: { flexDirection: 'row', gap: 6 },
    scopeOption: {
        flex: 1, flexDirection: 'column', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 10,
        borderWidth: 1.5, borderColor: '#E8E0E3',
        paddingVertical: 10, paddingHorizontal: 6, gap: 2,
    },
    scopeOptionActive: { borderColor: '#FF6B9D', backgroundColor: '#FFF5F8' },
    scopeOptionText: { fontSize: 11, fontWeight: '600', color: '#8A8A8E', textAlign: 'center' },
    scopeOptionTextActive: { color: '#FF6B9D' },
    scopeSubtext: { fontSize: 8, color: '#B0B0B0', textAlign: 'center' },

    addMealButton: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FF6B9D', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 14, gap: 3,
    },
    addMealButtonText: { color: '#FFF', fontSize: 10, fontWeight: '600' },

    emptyMealsContainer: {
        padding: 30, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFF5F8', borderRadius: 10,
        borderWidth: 1.5, borderColor: '#FFE8EE', borderStyle: 'dashed',
    },
    emptyMealsText: { fontSize: 13, color: '#FF6B9D', fontWeight: '500', marginTop: 8 },

    mealCard: {
        backgroundColor: '#FFFFFF', borderRadius: 10, marginBottom: 8,
        borderWidth: 1, borderColor: '#E8E0E3', overflow: 'hidden',
    },
    mealCardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 8, backgroundColor: '#F9F6F7',
        borderBottomWidth: 1, borderBottomColor: '#E8E0E3',
    },
    mealCardTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
    mealTypeDot: { width: 5, height: 5, borderRadius: 2.5 },
    mealCardDay: { fontSize: 11, fontWeight: '700', color: '#2D2D2D' },
    mealCardType: { fontSize: 10, color: '#8A8A8E' },
    mealCardRemove: { padding: 3 },

    mealCardBody: { padding: 8 },
    mealRow: { flexDirection: 'row', marginBottom: 6 },
    mealField: { flex: 1 },
    mealLabel: { fontSize: 8, fontWeight: '600', color: '#8A8A8E', marginBottom: 2, letterSpacing: 0.3 },
    mealInput: {
        backgroundColor: '#F9F6F7', borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 8, fontSize: 11, color: '#2D2D2D',
        borderWidth: 1, borderColor: '#E8E0E3', minHeight: 38,
    },
    mealNotesInput: { minHeight: 44, textAlignVertical: 'top' },
    mealTotal: { fontSize: 13, fontWeight: '700', color: '#FF6B9D', paddingVertical: 8 },

    servingTimeSelector: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#F9F6F7', borderRadius: 6,
        paddingHorizontal: 10, minHeight: 38,
        borderWidth: 1, borderColor: '#E8E0E3',
    },
    servingTimeText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#2D2D2D' },

    daySelectorScroll: { paddingRight: 4, gap: 4, paddingVertical: 2 },
    dayOption: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F6F7',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
        borderWidth: 1, borderColor: '#E8E0E3',
    },
    dayOptionActive: { backgroundColor: '#FFF5F8', borderColor: '#FF6B9D' },
    dayOptionText: { fontSize: 10, fontWeight: '500', color: '#8A8A8E' },
    dayOptionTextActive: { color: '#FF6B9D', fontWeight: '600' },

    mealTypeSelectorScroll: { paddingRight: 4, gap: 3, paddingVertical: 2 },
    mealTypeOption: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F6F7',
        paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10,
        borderWidth: 1, borderColor: '#E8E0E3', gap: 2,
    },
    mealTypeOptionActive: { backgroundColor: '#FFF5F8' },
    mealTypeOptionDisabled: { opacity: 0.5, backgroundColor: '#F5F5F5' },
    mealTypeOptionText: { fontSize: 8, fontWeight: '500', color: '#8A8A8E' },
    mealTypeOptionTextDisabled: { color: '#B0B0B0' },

    menuSelectionSection: { marginTop: 2 },
    menuSelectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 3,
    },
    selectMenuButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3 },
    selectMenuButtonText: { fontSize: 10, fontWeight: '600', color: '#FF6B9D' },

    selectedMenuItems: { gap: 2 },
    selectedMenuItem: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', backgroundColor: '#F9F6F7',
        paddingHorizontal: 6, paddingVertical: 5, borderRadius: 5,
    },
    selectedMenuItemInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    selectedMenuItemName: { fontSize: 11, color: '#2D2D2D', flexShrink: 1 },
    selectedMenuItemPrice: { fontSize: 10, fontWeight: '600', color: '#FF6B9D' },
    selectedMenuItemQty: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    qtyButton: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF5F8',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#FFE8EE',
    },
    qtyText: { fontSize: 10, fontWeight: '600', color: '#2D2D2D', minWidth: 14, textAlign: 'center' },

    selectedPricingBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginHorizontal: 2 },
    selectedPricingBadgeTray: { backgroundColor: '#FFF0F5' },
    selectedPricingBadgePax: { backgroundColor: '#E8F5E9' },
    selectedPricingBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
    selectedPricingBadgeTextTray: { color: '#C2185B' },
    selectedPricingBadgeTextPax: { color: '#2E7D32' },

    emptyMenuItems: {
        padding: 10, borderWidth: 1, borderColor: '#E8E0E3',
        borderRadius: 6, borderStyle: 'dashed',
        alignItems: 'center', backgroundColor: '#F9F6F7',
    },
    emptyMenuItemsText: { fontSize: 10, color: '#8A8A8E', marginTop: 1 },

    mealServicesTotal: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 8, borderTopWidth: 2, borderTopColor: '#FFE8EE', marginTop: 2,
    },
    mealServicesTotalLabel: { fontSize: 11, fontWeight: '600', color: '#2D2D2D' },
    mealServicesTotalValue: { fontSize: 15, fontWeight: '800', color: '#FF6B9D' },

    deliveryContainer: { flexDirection: 'row', gap: 6, marginBottom: 8 },
    deliveryOption: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 8,
        borderWidth: 1.5, borderColor: '#E8E0E3',
        paddingVertical: 8, paddingHorizontal: 6, gap: 4,
    },
    deliveryOptionActive: { borderColor: '#FF6B9D', backgroundColor: '#FFF5F8' },
    deliveryOptionText: { fontSize: 11, fontWeight: '500', color: '#8A8A8E' },
    deliveryOptionTextActive: { color: '#FF6B9D', fontWeight: '600' },
    deliveryFields: { marginTop: 2 },

    textAreaContainer: {
        backgroundColor: '#FFFFFF', borderRadius: 8,
        borderWidth: 1.5, borderColor: '#E8E0E3',
        paddingHorizontal: 10, paddingVertical: 6,
    },
    textArea: { fontSize: 12, color: '#2D2D2D', minHeight: 60, textAlignVertical: 'top' },

    modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 44 : 14,
        paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F0E8EB',
    },
    modalTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D' },
    modalDoneButtonText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D', padding: 3 },

    selectorPricingRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    },
    selectorPricingLabel: {
        fontSize: 11, fontWeight: '700', color: '#6B7280',
        textTransform: 'uppercase', letterSpacing: 0.4,
    },
    selectorPricingToggle: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 3 },
    selectorPricingOption: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    selectorPricingOptionActive: {
        backgroundColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
    },
    selectorPricingOptionText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
    selectorPricingOptionTextActive: { color: '#FFF' },

    modalSearch: { paddingHorizontal: 14, paddingVertical: 8 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F6F7',
        borderRadius: 8, paddingHorizontal: 8, gap: 4,
    },
    searchInput: { flex: 1, fontSize: 12, color: '#2D2D2D', paddingVertical: 8 },
    modalCategories: { paddingHorizontal: 14, paddingBottom: 6 },
    categoryChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
        backgroundColor: '#F9F6F7', marginRight: 4,
    },
    categoryChipActive: { backgroundColor: '#FF6B9D' },
    categoryChipText: { fontSize: 11, color: '#5A5A5E' },
    categoryChipTextActive: { color: '#FFFFFF' },

    modalViewToggle: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 6, gap: 4 },
    viewToggleButton: {
        width: 32, height: 32, borderRadius: 6, backgroundColor: '#F9F6F7',
        justifyContent: 'center', alignItems: 'center',
    },
    viewToggleActive: { backgroundColor: '#FF6B9D' },

    menuItemsList: { paddingHorizontal: 10, paddingBottom: 70 },
    menuItemGrid: {
        flex: 1, margin: 3, backgroundColor: '#FFFFFF', borderRadius: 8,
        padding: 8, alignItems: 'center',
        borderWidth: 1, borderColor: '#E8E0E3', position: 'relative',
    },
    menuItemGridSelected: { borderColor: '#FF6B9D', backgroundColor: '#FFF5F8' },
    menuItemDisabled: { opacity: 0.4 },
    menuItemGridImage: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF5F8',
        justifyContent: 'center', alignItems: 'center', marginBottom: 4, overflow: 'hidden',
    },
    menuItemGridImageImg: { width: 44, height: 44, borderRadius: 22 },
    menuItemGridName: { fontSize: 11, fontWeight: '600', color: '#2D2D2D', textAlign: 'center' },
    menuItemGridCategory: { fontSize: 9, color: '#8A8A8E', marginTop: 1 },
    menuItemGridPackage: { fontSize: 8, color: '#FF6B9D', fontWeight: '600', marginTop: 1 },
    menuItemGridPrice: { fontSize: 11, fontWeight: '700', color: '#FF6B9D', marginTop: 2 },
    menuItemHint: { fontSize: 8, color: '#B0B0B0', marginTop: 1, textAlign: 'center' },
    menuItemGridCheck: {
        position: 'absolute', top: 2, right: 2,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center',
    },

    // ⭐ View-details button on packages (grid)
    pkgViewBtnGrid: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        marginTop: 6,
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8, borderWidth: 1, borderColor: '#FFE0EA',
        backgroundColor: '#FFF5F8',
    },
    pkgViewBtnGridText: { fontSize: 9, fontWeight: '700', color: '#FF6B9D' },

    sourceBadgeCart: {
        position: 'absolute', top: 4, left: 4, zIndex: 2,
        backgroundColor: '#2196F3', borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1,
    },
    sourceBadgePackage: {
        position: 'absolute', top: 4, left: 4, zIndex: 2,
        backgroundColor: '#FF9800', borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1,
    },
    sourceBadgePromo: {
        position: 'absolute', top: 4, left: 4, zIndex: 2,
        backgroundColor: '#9C27B0', borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1,
    },
    sourceBadgeText: { fontSize: 7, fontWeight: '800', color: '#FFF', letterSpacing: 0.4 },

    menuItemList: {
        backgroundColor: '#FFFFFF', borderRadius: 6, marginBottom: 3,
        borderWidth: 1, borderColor: '#E8E0E3',
    },
    menuItemListSelected: { borderColor: '#FF6B9D', backgroundColor: '#FFF5F8' },
    menuItemListContent: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', padding: 10, gap: 8,
    },
    menuItemListThumb: {
        width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFF5F8',
        justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    menuItemListThumbImg: { width: 40, height: 40, borderRadius: 8 },
    menuItemListInfo: { flex: 1 },
    menuItemListName: { fontSize: 12, fontWeight: '600', color: '#2D2D2D' },
    menuItemListCategory: { fontSize: 10, color: '#8A8A8E' },
    menuItemListPackage: { fontSize: 9, color: '#FF6B9D', fontWeight: '600', marginTop: 1 },

    // ⭐ View-details button on packages (list)
    pkgViewBtnList: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginTop: 6, alignSelf: 'flex-start',
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8, borderWidth: 1, borderColor: '#FFE0EA',
        backgroundColor: '#FFF5F8',
    },
    pkgViewBtnListText: { fontSize: 10, fontWeight: '700', color: '#FF6B9D' },

    menuItemListPrice: { fontSize: 12, fontWeight: '700', color: '#FF6B9D', marginHorizontal: 4 },
    menuItemListCheck: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#4CAF50',
        justifyContent: 'center', alignItems: 'center',
    },

    emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 30 },
    emptyListText: { fontSize: 13, color: '#B0B0B0', marginTop: 6 },

    modalFooter: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF',
        borderTopWidth: 1, borderTopColor: '#F0E8EB',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 4,
    },
    modalFooterText: { fontSize: 11, color: '#8A8A8E' },
    modalDoneButton: {
        backgroundColor: '#FF6B9D', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18,
    },
    modalDoneButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

    timePickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    timePickerCard: {
        width: '85%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
    },
    timePickerHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
    },
    timePickerTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D' },
    timePickerBody: { alignItems: 'center', paddingVertical: 6 },
    timePickerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    timePickerBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    timePickerBtnCancel: { backgroundColor: '#F5F5F5' },
    timePickerBtnCancelText: { fontSize: 13, fontWeight: '600', color: '#2D2D2D' },
    timePickerBtnConfirm: { backgroundColor: '#FF6B9D' },
    timePickerBtnConfirmText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

    availabilityChecking: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 8, paddingHorizontal: 12,
        backgroundColor: '#FFF5F8', borderRadius: 10, marginBottom: 10,
    },
    availabilityCheckingText: { fontSize: 11, color: '#FF6B9D', fontWeight: '500' },

    summaryCard: {
        backgroundColor: '#FFF8FA', borderRadius: 14, padding: 12, marginBottom: 14,
        borderWidth: 1.5, borderColor: '#FFE8EE',
        shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    summarySection: {
        marginBottom: 10, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: '#F0E0E8',
    },
    summarySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    summarySectionTitle: { fontSize: 12, fontWeight: '700', color: '#2D2D2D' },
    summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    summaryLabel: { fontSize: 10, color: '#8A8A8E' },
    summaryValue: {
        fontSize: 10, fontWeight: '600', color: '#2D2D2D',
        textAlign: 'right', flex: 1, marginLeft: 6,
    },
    summaryDiscount: { color: '#4CAF50' },
    summaryMealItem: { marginBottom: 4 },
    summaryMealHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 1,
    },
    summaryMealTitle: { fontSize: 11, fontWeight: '600', color: '#FF6B9D' },
    summaryMealAmount: { fontSize: 11, fontWeight: '700', color: '#2D2D2D' },
    summaryMenuItem: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingLeft: 8, paddingVertical: 1,
    },
    summaryMenuItemName: { fontSize: 10, color: '#5A5A5E', flex: 1 },
    summaryMenuItemPrice: { fontSize: 10, fontWeight: '600', color: '#FF6B9D' },
    summaryDivider: { height: 2, backgroundColor: '#FFE8EE', marginVertical: 4 },
    totalRow: { marginTop: 1 },
    totalLabel: { fontSize: 12, fontWeight: '700', color: '#2D2D2D' },
    totalAmount: { fontSize: 15, fontWeight: '800', color: '#FF6B9D' },
    depositAmount: { fontSize: 13, color: '#FF8FB1' },
    specialRequestsText: { fontSize: 10, color: '#8A8A8E', marginTop: 2, lineHeight: 14 },

    infoCard: {
        flexDirection: 'row', backgroundColor: '#FFF5F8', borderRadius: 10,
        padding: 10, gap: 6, alignItems: 'flex-start',
        borderWidth: 1, borderColor: '#FFE8EE',
    },
    infoText: { flex: 1, fontSize: 9, color: '#8A8A8E', lineHeight: 13 },

    footerWrapper: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1, borderTopColor: '#F0E8EB',
    },
    buttonContainer: {
        flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0E8EB',
        gap: 8, zIndex: 1000,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 4,
    },
    backStepButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFF5F8', paddingVertical: 10, borderRadius: 20,
        gap: 3, borderWidth: 1.5, borderColor: '#FFE8EE', minHeight: 42,
    },
    backStepText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
    nextButton: { borderRadius: 20, overflow: 'hidden' },
    nextButtonWithBack: { flex: 2 },
    nextButtonFull: { flex: 1 },
    nextButtonDisabled: { opacity: 0.85 },
    gradientButton: {
        flexDirection: 'row', paddingVertical: 10,
        justifyContent: 'center', alignItems: 'center',
        gap: 4, paddingHorizontal: 14, minHeight: 42,
    },
    nextButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

    confirmOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    confirmCard: {
        width: '100%', maxWidth: 380,
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
        alignItems: 'center',
    },
    confirmIconCircle: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF3E0',
        justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    confirmTitle: {
        fontSize: 16, fontWeight: '700', color: '#2D2D2D',
        marginBottom: 6, textAlign: 'center',
    },
    confirmMessage: {
        fontSize: 12, color: '#8A8A8E', textAlign: 'center',
        lineHeight: 18, marginBottom: 16,
    },
    confirmButtons: { flexDirection: 'row', gap: 8, width: '100%' },
    confirmBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    confirmBtnCancel: { backgroundColor: '#F5F5F5' },
    confirmBtnCancelText: { fontSize: 13, fontWeight: '600', color: '#2D2D2D' },
    confirmBtnConfirm: { backgroundColor: '#FF6B9D' },
    confirmBtnConfirmText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

export default BookingScreen;