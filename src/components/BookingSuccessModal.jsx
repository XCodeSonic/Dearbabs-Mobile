// src/components/BookingSuccessModal.jsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

const BookingSuccessModal = ({
    visible,
    onClose,
    onViewOrders,
    onGoHome,
    booking = {},
}) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(0)).current;
    const confettiAnims = useRef(
        Array.from({ length: 6 }, () => new Animated.Value(0))
    ).current;

    useEffect(() => {
        if (visible) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Entry animation
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 7,
                    tension: 60,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();

            // Check-mark pop after the card has settled
            setTimeout(() => {
                Animated.spring(checkAnim, {
                    toValue: 1,
                    friction: 5,
                    tension: 100,
                    useNativeDriver: true,
                }).start();
            }, 180);

            // Confetti sparkle burst
            confettiAnims.forEach((anim, index) => {
                anim.setValue(0);
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 700,
                    delay: 220 + index * 45,
                    useNativeDriver: true,
                }).start();
            });
        } else {
            scaleAnim.setValue(0.8);
            fadeAnim.setValue(0);
            checkAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    // Format helpers
    const eventDateLabel = booking.event_date
        ? new Date(booking.event_date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : 'N/A';

    const guestLabel =
        booking.guests_count != null
            ? `${booking.guests_count} guest${booking.guests_count === 1 ? '' : 's'}`
            : 'N/A';

    const totalLabel =
        booking.total_amount != null
            ? `₱${Number(booking.total_amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`
            : 'N/A';

    const depositLabel =
        booking.required_deposit != null
            ? `₱${Number(booking.required_deposit).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`
            : null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Animated.View
                style={[
                    successStyles.overlay,
                    { opacity: fadeAnim },
                ]}
            >
                <Animated.View
                    style={[
                        successStyles.card,
                        {
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* ==== TOP GRADIENT HEADER ==== */}
                    <LinearGradient
                        colors={['#FF6B9D', '#FF8FB1', '#FFA0C0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={successStyles.header}
                    >
                        {/* Sparkles */}
                        {confettiAnims.map((anim, i) => {
                            const angle = (i / confettiAnims.length) * Math.PI * 2;
                            const distance = 80;
                            const translateX = anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, Math.cos(angle) * distance],
                            });
                            const translateY = anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, Math.sin(angle) * distance],
                            });
                            const opacity = anim.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, 1, 0],
                            });
                            const size = 6 + (i % 3) * 3;

                            return (
                                <Animated.View
                                    key={i}
                                    style={[
                                        successStyles.sparkle,
                                        {
                                            width: size,
                                            height: size,
                                            borderRadius: size / 2,
                                            opacity,
                                            transform: [{ translateX }, { translateY }],
                                        },
                                    ]}
                                />
                            );
                        })}

                        {/* Animated checkmark */}
                        <Animated.View
                            style={[
                                successStyles.checkCircle,
                                {
                                    transform: [{ scale: checkAnim }],
                                },
                            ]}
                        >
                            <View style={successStyles.checkInner}>
                                <Feather name="check" size={44} color="#FF6B9D" />
                            </View>
                        </Animated.View>
                    </LinearGradient>

                    {/* ==== BODY ==== */}
                    <View style={successStyles.body}>
                        <Text style={successStyles.title}>Booking Submitted!</Text>
                        <Text style={successStyles.subtitle}>
                            Your event request has been sent to our team for review.
                        </Text>

                        {/* Reference pill */}
                        {!!booking.booking_no && (
                            <View style={successStyles.refPill}>
                                <MaterialCommunityIcons
                                    name="ticket-confirmation-outline"
                                    size={14}
                                    color="#FF6B9D"
                                />
                                <Text style={successStyles.refLabel}>Ref #</Text>
                                <Text style={successStyles.refValue}>
                                    {booking.booking_no}
                                </Text>
                            </View>
                        )}

                        {/* Summary card */}
                        <View style={successStyles.summaryCard}>
                            <View style={successStyles.summaryRow}>
                                <View style={successStyles.summaryIconBox}>
                                    <Feather name="calendar" size={14} color="#FF6B9D" />
                                </View>
                                <View style={successStyles.summaryTextBlock}>
                                    <Text style={successStyles.summaryLabel}>Event Date</Text>
                                    <Text style={successStyles.summaryValue} numberOfLines={1}>
                                        {eventDateLabel}
                                    </Text>
                                </View>
                            </View>

                            <View style={successStyles.summaryDivider} />

                            <View style={successStyles.summaryRow}>
                                <View style={successStyles.summaryIconBox}>
                                    <Feather name="users" size={14} color="#FF6B9D" />
                                </View>
                                <View style={successStyles.summaryTextBlock}>
                                    <Text style={successStyles.summaryLabel}>Guests</Text>
                                    <Text style={successStyles.summaryValue}>{guestLabel}</Text>
                                </View>
                            </View>

                            <View style={successStyles.summaryDivider} />

                            <View style={successStyles.summaryRow}>
                                <View style={successStyles.summaryIconBox}>
                                    <Feather name="dollar-sign" size={14} color="#FF6B9D" />
                                </View>
                                <View style={successStyles.summaryTextBlock}>
                                    <Text style={successStyles.summaryLabel}>Estimated Total</Text>
                                    <Text style={successStyles.summaryValue}>{totalLabel}</Text>
                                </View>
                            </View>

                            {depositLabel && (
                                <>
                                    <View style={successStyles.summaryDivider} />
                                    <View style={successStyles.summaryRow}>
                                        <View
                                            style={[
                                                successStyles.summaryIconBox,
                                                successStyles.summaryIconBoxHighlight,
                                            ]}
                                        >
                                            <Feather name="shield" size={14} color="#FF9800" />
                                        </View>
                                        <View style={successStyles.summaryTextBlock}>
                                            <Text style={successStyles.summaryLabel}>
                                                Required Deposit (30%)
                                            </Text>
                                            <Text
                                                style={[
                                                    successStyles.summaryValue,
                                                    successStyles.summaryValueHighlight,
                                                ]}
                                            >
                                                {depositLabel}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* Next-step hint */}
                        <View style={successStyles.infoBox}>
                            <Feather name="info" size={13} color="#FF6B9D" />
                            <Text style={successStyles.infoText}>
                                We'll notify you once our team approves your booking. Please
                                settle the deposit to lock the date.
                            </Text>
                        </View>

                        {/* Actions */}
                        <View style={successStyles.actions}>
                            <TouchableOpacity
                                style={[successStyles.btn, successStyles.btnSecondary]}
                                onPress={onGoHome}
                                activeOpacity={0.8}
                            >
                                <Feather name="home" size={16} color="#FF6B9D" />
                                <Text style={successStyles.btnSecondaryText}>Home</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[successStyles.btn, successStyles.btnPrimaryWrapper]}
                                onPress={onViewOrders}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#FF6B9D', '#FF8FB1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={successStyles.btnPrimaryGradient}
                                >
                                    <Feather name="list" size={16} color="#FFF" />
                                    <Text style={successStyles.btnPrimaryText}>
                                        View My Bookings
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={successStyles.dismissLink}
                            onPress={onClose}
                            activeOpacity={0.6}
                        >
                            <Text style={successStyles.dismissLinkText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const successStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(20, 8, 15, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        overflow: 'hidden',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
        elevation: 14,
    },

    // Header
    header: {
        paddingTop: 34,
        paddingBottom: 26,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    sparkle: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        top: '50%',
        left: '50%',
        marginTop: -3,
        marginLeft: -3,
    },
    checkCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.55)',
    },
    checkInner: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },

    // Body
    body: {
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: 18,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1C1C1E',
        letterSpacing: -0.4,
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 16,
        paddingHorizontal: 10,
    },

    // Reference pill
    refPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF0F5',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#FFDCE6',
    },
    refLabel: {
        fontSize: 11,
        color: '#C2185B',
        fontWeight: '500',
    },
    refValue: {
        fontSize: 12,
        color: '#C2185B',
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // Summary
    summaryCard: {
        width: '100%',
        backgroundColor: '#FBF7F9',
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F0E8EB',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    summaryIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryIconBoxHighlight: {
        backgroundColor: '#FFF3E0',
    },
    summaryTextBlock: { flex: 1 },
    summaryLabel: {
        fontSize: 10,
        color: '#8E8E93',
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 1,
    },
    summaryValue: {
        fontSize: 13,
        color: '#1C1C1E',
        fontWeight: '700',
    },
    summaryValueHighlight: {
        color: '#E65100',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#F0E8EB',
        marginVertical: 10,
    },

    // Info box
    infoBox: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        backgroundColor: '#FFF5F8',
        borderRadius: 12,
        padding: 11,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#FFE8EE',
        width: '100%',
    },
    infoText: {
        flex: 1,
        fontSize: 11,
        color: '#8A8A8E',
        lineHeight: 16,
    },

    // Actions
    actions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginBottom: 8,
    },
    btn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnSecondary: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#FFF5F8',
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
    },
    btnSecondaryText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FF6B9D',
    },
    btnPrimaryWrapper: { overflow: 'hidden' },
    btnPrimaryGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        width: '100%',
    },
    btnPrimaryText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    dismissLink: {
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    dismissLinkText: {
        fontSize: 12,
        color: '#B0B0B0',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
});

export default BookingSuccessModal;