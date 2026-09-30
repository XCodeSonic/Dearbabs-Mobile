// src/screens/OrdersScreen.jsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import EditBookingModal from '../components/EditBookingModal';
import RescheduleModal from '../components/RescheduleModal';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNotifications } from '../contexts/NotificationContext';
import { bookingService } from '../services/bookingService';
import { paymentService } from '../services/paymentService';

const { width, height } = Dimensions.get('window');

const OrdersScreen = ({ navigation }) => {
  const { isGuest, user } = useAuth();
  const { getCartCount } = useCart();
  const { refreshNotifications } = useNotifications();

  const [activeTab, setActiveTab] = useState('upcoming');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
    const [referenceNumber, setReferenceNumber] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [paymentStep, setPaymentStep] = useState(1);
  // ⭐ Custom amount the customer wants to pay (defaults to remaining balance)
  const [customPaymentAmount, setCustomPaymentAmount] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState({ upcoming: [], past: [] });
  const [totalOrders, setTotalOrders] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState('customer-request');
  const [selectedRescheduleBooking, setSelectedRescheduleBooking] = useState(null);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ⭐ Cancel booking request state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelOrder, setSelectedCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const companyPaymentDetails = {
    gcash: {
      number: '09171234567',
      name: "Dear Bab's Catering",
      accountType: 'GCash',
    },
    maya: {
      number: '09171234567',
      name: "Dear Bab's Catering",
      accountType: 'Maya',
    },
  };

  useEffect(() => {
    if (!isGuest && user) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [isGuest, user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadOrders = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      const response = await bookingService.getBookings({ per_page: 100 });

      if (response.success) {
        let bookings = [];
        if (response.data?.data && Array.isArray(response.data.data)) {
          bookings = response.data.data;
        } else if (Array.isArray(response.data)) {
          bookings = response.data;
        } else if (response.data?.bookings && Array.isArray(response.data.bookings)) {
          bookings = response.data.bookings;
        }

        if (bookings.length === 0) {
          setOrders({ upcoming: [], past: [] });
          setTotalOrders(0);
          setPendingApprovalCount(0);
          setCompletedCount(0);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const userEmail = user?.email?.toLowerCase();

        const userBookings = bookings.filter((booking) => {
          const bookingEmail =
            booking.customer_email ||
            booking.email ||
            booking.customer?.email ||
            booking.customer?.person?.email ||
            booking.user?.email;
          return bookingEmail && bookingEmail.toLowerCase() === userEmail;
        });

        setTotalOrders(userBookings.length);

        const pendingApproval = [];
        const confirmed = [];
        const completed = [];
        const cancelled = [];
        const uniqueIds = new Set();

        userBookings.forEach((booking, index) => {
          const uniqueId = booking.booking_id || booking.id || `booking-${index}`;
          if (uniqueIds.has(uniqueId)) return;
          uniqueIds.add(uniqueId);

          let eventDate = null;
          if (booking.event_date) {
            try {
              eventDate = new Date(booking.event_date);
              if (isNaN(eventDate.getTime())) eventDate = null;
            } catch (e) {
              eventDate = null;
            }
          }

          const isFullyPaid =
            booking.payment_status === 'paid' ||
            (booking.balance !== undefined && booking.balance <= 0);
          const remainingBalance = booking.balance || booking.total_amount || 0;

          const orderData = {
            id: booking.booking_no || `BK-${booking.booking_id || booking.id || index + 1}`,
            unique_id: uniqueId,
            booking_id: booking.booking_id || booking.id || index + 1,
            eventType:
              booking.event_type_name || booking.event_type || booking.event_type?.name || 'Event',
            date: eventDate
              ? eventDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'TBD',
            pax: booking.guests_count || 0,
            status: booking.booking_status || 'pending_approval',
            total: booking.total_amount || 0,
            paymentStatus: booking.payment_status || 'unpaid',
            paymentMethod: booking.payment_method || null,
            progress: booking.progress || 0,
            timeSlot: booking.event_time || 'TBD',
            location: booking.venue || 'TBD',
            remainingBalance: remainingBalance,
            downpayment: (booking.total_amount || 0) * 0.3,
            rating: booking.rating || 0,
            feedback: booking.feedback || '',
            isPackage: booking.menu_selection_type === 'package',
            packageName: booking.package_summary?.name || booking.package?.name || null,
            packageId: booking.package_id || booking.package?.package_id || null,
            menuItems: booking.menu_items || booking.items || [],
            specialRequests: booking.special_requests || '',
            promotionName: booking.promotion?.name || null,
            promotionId: booking.promotion_id || booking.promotion?.promotion_id || null,
            isPromo: !!booking.promotion_id || !!booking.promotion,
            createdAt: booking.created_at || null,
            statusLabel: booking.booking_status || 'pending_approval',
            eventDate: eventDate,
            isFullyPaid: isFullyPaid,
            hasBalance: remainingBalance > 0,
            isPast: false,

            // Reschedule fields
            reschedule_proposed_by: booking.reschedule_proposed_by || null,
            reschedule_status: booking.reschedule_status || null,
            reschedule_reason: booking.reschedule_reason || null,
            requested_date: booking.requested_date || null,
            requested_time: booking.requested_time || null,
            original_event_date: booking.original_event_date || null,
            original_event_time: booking.original_event_time || null,
            reschedule_proposed_at: booking.reschedule_proposed_at || null,

            // Deadline + cutoff fields from backend
            customer_reschedule_deadline: booking.customer_reschedule_deadline || null,
            admin_reschedule_deadline: booking.admin_reschedule_deadline || null,
            customer_reschedule_response_hours: booking.customer_reschedule_response_hours ?? 24,
            admin_reschedule_response_hours: booking.admin_reschedule_response_hours ?? 48,
            cancellation_cutoff_days: booking.cancellation_cutoff_days ?? 3,
            is_within_cancellation_cutoff: booking.is_within_cancellation_cutoff ?? false,
            days_until_event: booking.days_until_event ?? null,

            // Deposit info
            deposit_percentage: booking.deposit_percentage ?? 30,
            required_deposit_amount: booking.required_deposit_amount ?? null,
            deposit_paid: booking.deposit_paid ?? 0,
            deposit_due_date: booking.deposit_due_date ?? null,
            is_late_booking: booking.is_late_booking ?? false,
          };

          const status = booking.booking_status || 'pending_approval';

          // ⭐ Cancelled/rejected bookings go straight to History — never Upcoming
          if (status === 'cancelled' || status === 'rejected') {
            orderData.isPast = true;
            cancelled.push(orderData);
          } else if (status === 'completed') {
            orderData.isPast = true;
            completed.push(orderData);
          } else if (status === 'pending_approval' || status === 'pending') {
            pendingApproval.push(orderData);
          } else if (
            status === 'confirmed' ||
            status === 'rescheduled' ||
            status === 'processing' ||
            status === 'reschedule_proposed' ||
            status === 'reschedule_requested' ||
            status === 'reschedule_rejected'
          ) {
            confirmed.push(orderData);
          }
        });

        setPendingApprovalCount(pendingApproval.length);
        setCompletedCount(completed.length);
        setOrders({
          upcoming: [...pendingApproval, ...confirmed],
          past: [...completed, ...cancelled],
        });
      } else {
        setOrders({ upcoming: [], past: [] });
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      if (orders.upcoming.length === 0 && orders.past.length === 0) {
        setOrders({ upcoming: [], past: [] });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const statusConfig = {
    pending_approval: { label: 'Pending Approval', color: '#FF9800', bg: '#FFF3E0', icon: 'clock-outline' },
    confirmed: { label: 'Confirmed', color: '#4CAF50', bg: '#E8F5E9', icon: 'check-circle' },
    processing: { label: 'Processing', color: '#FF9800', bg: '#FFF3E0', icon: 'clock-outline' },
    completed: { label: 'Completed', color: '#2196F3', bg: '#E3F2FD', icon: 'check-circle' },
    cancelled: { label: 'Cancelled', color: '#9E9E9E', bg: '#F5F5F5', icon: 'cancel' },
    rejected: { label: 'Rejected', color: '#F44336', bg: '#FFEBEE', icon: 'alert-circle' },
    rescheduled: { label: 'Rescheduled', color: '#2196F3', bg: '#E3F2FD', icon: 'calendar-clock' },
    reschedule_proposed: { label: 'Date Proposed', color: '#9C27B0', bg: '#F3E5F5', icon: 'calendar-edit' },
    reschedule_requested: { label: 'Awaiting Approval', color: '#FF9800', bg: '#FFF3E0', icon: 'clock-alert-outline' },
    reschedule_rejected: { label: 'Reschedule Denied', color: '#F44336', bg: '#FFEBEE', icon: 'calendar-remove' },
    draft: { label: 'Draft', color: '#9E9E9E', bg: '#F5F5F5', icon: 'file-document-outline' },
  };

  const paymentConfig = {
    paid: { label: 'Paid', color: '#4CAF50', bg: '#E8F5E9', icon: 'check-circle' },
    partial: { label: 'Partial', color: '#FF9800', bg: '#FFF3E0', icon: 'clock-outline' },
    unpaid: { label: 'Unpaid', color: '#F44336', bg: '#FFEBEE', icon: 'alert-circle' },
    pending: { label: 'Pending', color: '#FF9800', bg: '#FFF3E0', icon: 'clock-outline' },
    refunded: { label: 'Refunded', color: '#2196F3', bg: '#E3F2FD', icon: 'cash-refund' },
  };

  const paymentMethods = [
    { id: 'cash', name: 'Cash', icon: 'cash', color: '#4CAF50', description: 'Pay on delivery/setup' },
    { id: 'gcash', name: 'GCash', icon: 'qrcode', color: '#007AFF', description: 'Send via GCash' },
    { id: 'maya', name: 'Maya', icon: 'wallet', color: '#FF6B9D', description: 'Send via Maya' },
  ];

  const getProgressColor = (progress) => {
    if (progress < 30) return '#FF5722';
    if (progress < 70) return '#FF9800';
    return '#4CAF50';
  };

  const getStatusBadge = (status) => statusConfig[status] || statusConfig.pending_approval;

  // ⭐ Helper to check if cancellation is allowed
  const canCancelOrder = (order) => {
    if (!order) return { canCancel: false, reason: 'No booking selected.' };

    if (order.is_within_cancellation_cutoff === true) {
      return {
        canCancel: false,
        reason:
          'Cancellation is no longer available because the booking has reached the cancellation cutoff period.',
      };
    }

    const cutoffDays = order.cancellation_cutoff_days ?? 3;
    const eventDate = order.eventDate;

    if (eventDate && !isNaN(new Date(eventDate).getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const event = new Date(eventDate);
      event.setHours(0, 0, 0, 0);
      const daysUntil = Math.floor((event - today) / (1000 * 60 * 60 * 24));

      if (daysUntil >= 0 && daysUntil < cutoffDays) {
        return {
          canCancel: false,
          reason: `Cancellation is no longer available because the booking has reached the cancellation cutoff period (${cutoffDays} days before the event).`,
        };
      }
    }

    return { canCancel: true, reason: null };
  };

  // ⭐ Format deadline label
  const formatDeadline = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return null;
    }
  };

  if (isGuest) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#FF6B9D" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Orders</Text>
            <TouchableOpacity style={styles.filterButton}>
              <Feather name="filter" size={20} color="#FF6B9D" />
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Feather name="calendar" size={48} color="#C6C6C8" />
            </View>
            <Text style={styles.emptyTitle}>Login to View Orders</Text>
            <Text style={styles.emptyText}>
              Please login to view your orders and track your events.
            </Text>
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.bookButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const handleViewOrder = (order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const handleMakePayment = (order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ⭐ Prevent opening the payment modal when the balance is zero.
    const remaining = Number(order?.remainingBalance || 0);
    if (remaining <= 0.01) {
      Alert.alert(
        'Fully Paid',
        'This booking is already fully paid. Additional payment is not allowed.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedOrderForPayment(order);
    setPaymentMethod('');
    setReferenceNumber('');
    setProofImage(null);
    setCustomPaymentAmount(String(remaining)); // ⭐ Pre-fill with full balance
    setPaymentStep(1);
    setShowPaymentModal(true);
  };
  const handleSelectPaymentMethod = (methodId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaymentMethod(methodId);
    if (methodId === 'cash') {
      handleSubmitPayment();
    } else {
      setPaymentStep(2);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) setProofImage(result.assets[0].uri);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) setProofImage(result.assets[0].uri);
  };

   // ⭐ Validates the custom amount against the remaining balance
  const validatePaymentAmount = (rawAmount) => {
    const amount = Number(rawAmount);

    if (!amount || amount <= 0) {
      return { valid: false, message: 'Please enter a valid payment amount.' };
    }

    const remaining = Number(selectedOrderForPayment?.remainingBalance || 0);

    if (remaining <= 0.01) {
      return {
        valid: false,
        message:
          'This booking is already fully paid. Additional payment is not allowed.',
      };
    }

    if (amount > remaining + 0.01) {
      return {
        valid: false,
        message: 'Payment amount cannot exceed the remaining balance.',
      };
    }

    return { valid: true, amount, remaining };
  };

  const handleSubmitPayment = async () => {
    const validation = validatePaymentAmount(customPaymentAmount);
    if (!validation.valid) {
      Alert.alert('Invalid Amount', validation.message);
      return;
    }

    const payAmount = validation.amount;
    const isFullPayment = Math.abs(payAmount - validation.remaining) < 0.01;

    if (paymentMethod === 'cash') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Vibration.vibrate(10);
      setIsProcessing(true);

      try {
        const response = await paymentService.createPayment({
          booking_id: selectedOrderForPayment.booking_id,
          amount: payAmount,
          payment_method: 'cash',
          payment_type: isFullPayment ? 'full' : 'partial',
        });

        if (response.success) {
          setTimeout(() => {
            setIsProcessing(false);
            setShowPaymentModal(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            refreshNotifications();
            Alert.alert(
              'Payment Confirmed!',
              `Your cash payment of ₱${payAmount.toLocaleString()} has been confirmed.`,
              [{ text: 'OK', onPress: () => loadOrders(true) }]
            );
          }, 1500);
        } else {
          throw new Error(response.message || 'Payment failed');
        }
      } catch (error) {
        setIsProcessing(false);
        Alert.alert('Payment Failed', error.message || 'Failed to process payment');
      }
      return;
    }

    if (!referenceNumber.trim()) {
      Alert.alert('Required', 'Please enter the reference number.');
      return;
    }
    if (!proofImage) {
      Alert.alert('Required', 'Please upload a screenshot or photo of your payment.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.vibrate(10);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('booking_id', selectedOrderForPayment.booking_id);
      formData.append('amount', String(payAmount));
      formData.append('payment_method', paymentMethod);
      formData.append('payment_type', isFullPayment ? 'full' : 'partial');
      formData.append('reference_number', referenceNumber);
      formData.append('receipt_file', {
        uri: proofImage,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });

      const response = await paymentService.createPayment(formData);

      if (response.success) {
        setTimeout(() => {
          setIsProcessing(false);
          setShowPaymentModal(false);
          setShowSuccessModal(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setReferenceNumber('');
          setProofImage(null);
          setCustomPaymentAmount('');
          setPaymentMethod('');
          setPaymentStep(1);
          refreshNotifications();
          loadOrders(true);
        }, 2500);
      } else {
        throw new Error(response.message || 'Payment failed');
      }
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Payment Failed', error.message || 'Failed to process payment');
    }
  };

  const handleContactSupport = (order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Chat', { orderId: order.id });
  };

  const openRescheduleModal = (order, mode) => {
    setSelectedRescheduleBooking(order);
    setRescheduleMode(mode);
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedRescheduleBooking(null);
  };

  const openEditModal = (order) => {
    setEditingBooking(order);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingBooking(null);
  };

  const handleSaveEdit = async (payload) => {
    if (!editingBooking) return;
    setSavingEdit(true);
    try {
      const res = await bookingService.customerUpdate(editingBooking.booking_id, payload);
      if (res.success) {
        Alert.alert('Saved', 'Your booking has been updated.');
        closeEditModal();
        refreshNotifications();
        await loadOrders(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to update booking.');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to update booking.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ⭐ Opens the cancel confirmation modal (validates cutoff first)
  const handleRequestCancellation = (order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { canCancel, reason } = canCancelOrder(order);

    if (!canCancel) {
      Alert.alert(
        'Cancellation Not Available',
        reason || 'This booking cannot be cancelled at this time.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedCancelOrder(order);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // ⭐ Closes the cancel modal
  const closeCancelModal = () => {
    if (submittingCancel) return;
    setShowCancelModal(false);
    setSelectedCancelOrder(null);
    setCancelReason('');
  };

  // ⭐ Submits the cancellation request to the backend
  const submitCancellationRequest = async () => {
    if (!selectedCancelOrder) return;

    const reason = cancelReason.trim() || 'Cancelled by customer';

    setSubmittingCancel(true);
    try {
      const response = await bookingService.customerCancelBooking(
        selectedCancelOrder.booking_id,
        { reason }
      );

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowCancelModal(false);
        setSelectedCancelOrder(null);
        setCancelReason('');

        Alert.alert(
          'Booking Cancelled',
          'Your booking has been cancelled successfully.',
          [
            {
              text: 'OK',
              onPress: async () => {
                refreshNotifications();
                await loadOrders(true);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Cannot Cancel',
          response.message || 'Failed to cancel this booking.'
        );
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to cancel booking. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingCancel(false);
    }
  };

  const OrderCard = ({ item }) => {
    const status = getStatusBadge(item.status);
    const payment = paymentConfig[item.paymentStatus] || paymentConfig.unpaid;
    const isPendingApproval = item.status === 'pending_approval' || item.status === 'pending';
    const isConfirmed =
      item.status === 'confirmed' ||
      item.status === 'processing' ||
      item.status === 'rescheduled';
    const isCompleted = item.status === 'completed';
    const hasBalance = item.hasBalance || item.remainingBalance > 0;
    const canPay =
      (isConfirmed || isCompleted) &&
      hasBalance &&
      item.status !== 'cancelled' &&
      item.status !== 'rejected';

    const hasPendingAdminProposal =
      item.reschedule_status === 'pending' && item.reschedule_proposed_by === 'admin';
    const hasRejectedReschedule = item.status === 'reschedule_rejected';
    const hasPendingCustomerRequest =
      item.reschedule_status === 'pending' && item.reschedule_proposed_by === 'customer';
    const hasPendingCustomerReschedule = item.status === 'reschedule_requested';
    const canEdit = isPendingApproval;

    // ⭐ cutoff-aware cancel permission
    const cancelCheck = canCancelOrder(item);

    // ⭐ Show cancel while admin reschedule is pending
    const canCancelWhileReschedulePending = hasPendingAdminProposal;

    const showCancelButton =
      (isPendingApproval || isConfirmed || canCancelWhileReschedulePending) &&
      item.status !== 'cancelled' &&
      item.status !== 'rejected' &&
      item.status !== 'reschedule_rejected';

    return (
      <TouchableOpacity
        key={item.unique_id || item.id}
        style={[
          styles.orderCard,
          isPendingApproval && styles.orderCardPending,
          hasPendingAdminProposal && styles.orderCardRescheduleProposal,
          hasRejectedReschedule && styles.orderCardRescheduleRejected,
        ]}
        onPress={() => handleViewOrder(item)}
        activeOpacity={0.85}
      >
        {hasPendingAdminProposal && (
          <View style={styles.highlightStrip}>
            <Feather name="bell" size={12} color="#FFF" />
            <Text style={styles.highlightStripText}>
              NEW DATE PROPOSED — TAP TO RESPOND
            </Text>
          </View>
        )}
        {hasRejectedReschedule && (
          <View style={[styles.highlightStrip, styles.highlightStripDanger]}>
            <Feather name="alert-circle" size={12} color="#FFF" />
            <Text style={styles.highlightStripText}>
              RESCHEDULE DENIED — CHOOSE NEXT STEP
            </Text>
          </View>
        )}
        {hasPendingCustomerRequest && !hasPendingAdminProposal && !hasRejectedReschedule && (
          <View style={[styles.highlightStrip, styles.highlightStripInfo]}>
            <Feather name="clock" size={12} color="#FFF" />
            <Text style={styles.highlightStripText}>AWAITING ADMIN APPROVAL</Text>
          </View>
        )}

        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>{item.id}</Text>
            <Text style={styles.orderType}>{item.eventType}</Text>

            {item.isPackage && (
              <View style={styles.packageBadge}>
                <Text style={styles.packageBadgeText}>📦 Package</Text>
              </View>
            )}
            {isPendingApproval && (
              <View style={styles.pendingBadge}>
                <MaterialCommunityIcons name="clock-outline" size={10} color="#FF9800" />
                <Text style={styles.pendingBadgeText}>Awaiting Approval</Text>
              </View>
            )}
            {isCompleted && hasBalance && (
              <View style={styles.balanceDueBadge}>
                <MaterialCommunityIcons name="alert-circle" size={10} color="#FF5722" />
                <Text style={styles.balanceDueBadgeText}>Balance Due</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <MaterialCommunityIcons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailItem}>
            <Feather name="calendar" size={14} color="#8E8E93" />
            <Text style={styles.detailText}>{item.date}</Text>
          </View>
          <View style={styles.detailItem}>
            <Feather name="clock" size={14} color="#8E8E93" />
            <Text style={styles.detailText}>{item.timeSlot}</Text>
          </View>
          <View style={styles.detailItem}>
            <Feather name="users" size={14} color="#8E8E93" />
            <Text style={styles.detailText}>{item.pax} guests</Text>
          </View>
        </View>

        {item.isPackage && item.packageName && (
          <View style={styles.packageInfo}>
            <MaterialCommunityIcons name="package-variant" size={16} color="#FF6B9D" />
            <Text style={styles.packageInfoText}>Package: {item.packageName}</Text>
          </View>
        )}

        <View style={styles.paymentSection}>
          <View style={[styles.paymentBadge, { backgroundColor: payment.bg }]}>
            <MaterialCommunityIcons name={payment.icon} size={10} color={payment.color} />
            <Text style={[styles.paymentText, { color: payment.color }]}>
              {payment.label}
            </Text>
          </View>
          <Text style={styles.totalAmount}>₱{item.total.toLocaleString()}</Text>
        </View>

        {hasBalance && (
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Remaining Balance:</Text>
            <Text style={[styles.balanceAmount, { color: '#FF5722' }]}>
              ₱{item.remainingBalance.toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Event Progress</Text>
            <Text style={styles.progressPercent}>{item.progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${item.progress}%`, backgroundColor: getProgressColor(item.progress) },
              ]}
            />
          </View>
        </View>

        {/* ⭐ Reschedule deadline badge */}
        {hasPendingAdminProposal && item.customer_reschedule_deadline && (
          <View style={styles.deadlineBadge}>
            <Feather name="clock" size={10} color="#FFF" />
            <Text style={styles.deadlineText}>
              Respond by {formatDeadline(item.customer_reschedule_deadline)}
            </Text>
          </View>
        )}

        {/* ⭐ Admin response overdue info */}
        {hasPendingCustomerRequest && item.admin_reschedule_deadline && (
          <View style={[styles.deadlineBadge, styles.deadlineBadgeInfo]}>
            <Feather name="info" size={10} color="#FFF" />
            <Text style={styles.deadlineText}>
              Admin hasn't responded yet — deadline {formatDeadline(item.admin_reschedule_deadline)}
            </Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          {canEdit && (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openEditModal(item)}
            >
              <Feather name="edit-3" size={14} color="#FFF" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}

          {canPay && (
            <TouchableOpacity
              style={[styles.actionButton, styles.payButton]}
              onPress={() => handleMakePayment(item)}
            >
              <Feather name="credit-card" size={14} color="#FFF" />
              <Text style={styles.payButtonText}>Pay Balance</Text>
            </TouchableOpacity>
          )}

          {/* ⭐ Reschedule button only shown if there is NO pending reschedule */}
          {isConfirmed && !hasPendingAdminProposal && !hasPendingCustomerRequest && (
            <TouchableOpacity
              style={[styles.actionButton, styles.rescheduleButton]}
              onPress={() => openRescheduleModal(item, 'customer-request')}
            >
              <Feather name="refresh-cw" size={14} color="#FFF" />
              <Text style={styles.rescheduleButtonText}>Reschedule</Text>
            </TouchableOpacity>
          )}

          {/* ⭐ Customer responds to admin's reschedule */}
          {hasPendingAdminProposal && (
            <TouchableOpacity
              style={[styles.actionButton, styles.respondButton]}
              onPress={() => openRescheduleModal(item, 'customer-admin-proposal')}
            >
              <Feather name="bell" size={14} color="#FFF" />
              <Text style={styles.respondButtonText}>Respond</Text>
            </TouchableOpacity>
          )}

          {/* ⭐ Customer handles post-rejection decision */}
          {hasRejectedReschedule && (
            <TouchableOpacity
              style={[styles.actionButton, styles.decideButton]}
              onPress={() => openRescheduleModal(item, 'customer-after-rejection')}
            >
              <Feather name="alert-circle" size={14} color="#FFF" />
              <Text style={styles.decideButtonText}>Decide</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={() => handleContactSupport(item)}
          >
            <Feather name="message-circle" size={14} color="#FF6B9D" />
            <Text style={styles.contactButtonText}>Message</Text>
          </TouchableOpacity>

          {showCancelButton && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.cancelCustomerButton,
                !cancelCheck.canCancel && styles.cancelCustomerButtonDisabled,
              ]}
              onPress={() => handleRequestCancellation(item)}
            >
              <Feather
                name={cancelCheck.canCancel ? 'x-circle' : 'lock'}
                size={14}
                color={cancelCheck.canCancel ? '#FF4444' : '#9E9E9E'}
              />
              <Text
                style={[
                  styles.cancelCustomerText,
                  !cancelCheck.canCancel && styles.cancelCustomerTextDisabled,
                ]}
              >
                {cancelCheck.canCancel ? 'Cancel' : 'Cutoff'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const OrderDetailModal = () => (
    <Modal
      visible={showOrderDetail}
      transparent
      animationType="slide"
      onRequestClose={() => setShowOrderDetail(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowOrderDetail(false)}
        />
        <Animated.View
          style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}
        >
          <LinearGradient colors={['#FF6B9D', '#FF8FB1']} style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Order Details</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowOrderDetail(false)}
            >
              <Feather name="x" size={24} color="#FFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {selectedOrder && (
              <>
                <View style={styles.modalOrderId}>
                  <Text style={styles.modalOrderIdText}>{selectedOrder.id}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          statusConfig[selectedOrder.status]?.bg || '#F5F5F5',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={statusConfig[selectedOrder.status]?.icon || 'circle'}
                      size={12}
                      color={statusConfig[selectedOrder.status]?.color || '#8E8E93'}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: statusConfig[selectedOrder.status]?.color || '#8E8E93',
                        },
                      ]}
                    >
                      {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalEventType}>{selectedOrder.eventType}</Text>

                {selectedOrder.isPackage && selectedOrder.packageName && (
                  <View style={styles.modalPackageInfo}>
                    <MaterialCommunityIcons name="package-variant" size={20} color="#FF6B9D" />
                    <Text style={styles.modalPackageText}>
                      Package: {selectedOrder.packageName}
                    </Text>
                  </View>
                )}

                <View style={styles.modalInfoGrid}>
                  <View style={styles.modalInfoItem}>
                    <Feather name="calendar" size={16} color="#FF6B9D" />
                    <Text style={styles.modalInfoLabel}>Date</Text>
                    <Text style={styles.modalInfoValue}>{selectedOrder.date}</Text>
                  </View>
                  <View style={styles.modalInfoItem}>
                    <Feather name="clock" size={16} color="#FF6B9D" />
                    <Text style={styles.modalInfoLabel}>Time</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedOrder.timeSlot || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.modalInfoItem}>
                    <Feather name="users" size={16} color="#FF6B9D" />
                    <Text style={styles.modalInfoLabel}>Guests</Text>
                    <Text style={styles.modalInfoValue}>{selectedOrder.pax}</Text>
                  </View>
                  <View style={styles.modalInfoItem}>
                    <Feather name="map-pin" size={16} color="#FF6B9D" />
                    <Text style={styles.modalInfoLabel}>Location</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedOrder.location || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Reschedule proposal info in detail modal */}
                {selectedOrder.reschedule_proposed_by === 'admin' &&
                  selectedOrder.reschedule_status === 'pending' && (
                    <View style={styles.modalRescheduleBox}>
                      <Text style={styles.modalSectionTitle}>Reschedule Proposal</Text>
                      <View style={styles.modalRescheduleRow}>
                        <Text style={styles.modalPaymentLabel}>Original Date</Text>
                        <Text style={styles.modalPaymentValue}>
                          {selectedOrder.date} {selectedOrder.timeSlot}
                        </Text>
                      </View>
                      <View style={styles.modalRescheduleRow}>
                        <Text style={styles.modalPaymentLabel}>Proposed Date</Text>
                        <Text style={[styles.modalPaymentValue, { color: '#9C27B0' }]}>
                          {selectedOrder.requested_date} {selectedOrder.requested_time}
                        </Text>
                      </View>
                      {selectedOrder.reschedule_reason && (
                        <View style={styles.modalRescheduleRow}>
                          <Text style={styles.modalPaymentLabel}>Reason</Text>
                          <Text style={styles.modalPaymentValue}>
                            {selectedOrder.reschedule_reason}
                          </Text>
                        </View>
                      )}
                      {selectedOrder.customer_reschedule_deadline && (
                        <View style={styles.modalRescheduleRow}>
                          <Text style={styles.modalPaymentLabel}>Respond By</Text>
                          <Text style={[styles.modalPaymentValue, { color: '#E91E63' }]}>
                            {formatDeadline(selectedOrder.customer_reschedule_deadline)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                {selectedOrder.menuItems && selectedOrder.menuItems.length > 0 && (
                  <View style={styles.modalMenuSection}>
                    <Text style={styles.modalSectionTitle}>Menu Items</Text>
                    {selectedOrder.menuItems.map((item, index) => (
                      <View key={index} style={styles.modalMenuItem}>
                        <Text style={styles.modalMenuItemName}>
                          {item.quantity || 1}x {item.name || item.item_name || 'Item'}
                        </Text>
                        <Text style={styles.modalMenuItemPrice}>
                          ₱{item.total_price || item.price || item.unit_price || 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedOrder.specialRequests && (
                  <View style={styles.modalSpecialRequests}>
                    <Text style={styles.modalSectionTitle}>Special Requests</Text>
                    <Text style={styles.modalSpecialText}>
                      {selectedOrder.specialRequests}
                    </Text>
                  </View>
                )}

                <View style={styles.modalPaymentSection}>
                  <Text style={styles.modalSectionTitle}>Payment Details</Text>
                  <View style={styles.modalPaymentRow}>
                    <Text style={styles.modalPaymentLabel}>Total Amount</Text>
                    <Text style={styles.modalPaymentValue}>
                      ₱{selectedOrder.total.toLocaleString()}
                    </Text>
                  </View>
                  {selectedOrder.downpayment > 0 && (
                    <View style={styles.modalPaymentRow}>
                      <Text style={styles.modalPaymentLabel}>Downpayment (30%)</Text>
                      <Text style={styles.modalPaymentValue}>
                        ₱{selectedOrder.downpayment.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {selectedOrder.remainingBalance > 0 && (
                    <View style={styles.modalPaymentRow}>
                      <Text style={styles.modalPaymentLabel}>Remaining Balance</Text>
                      <Text
                        style={[
                          styles.modalPaymentValue,
                          styles.modalPaymentRemaining,
                        ]}
                      >
                        ₱{selectedOrder.remainingBalance.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalPaymentRow}>
                    <Text style={styles.modalPaymentLabel}>Payment Status</Text>
                    <View
                      style={[
                        styles.paymentBadge,
                        {
                          backgroundColor:
                            paymentConfig[selectedOrder.paymentStatus]?.bg || '#F5F5F5',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          paymentConfig[selectedOrder.paymentStatus]?.icon ||
                          'alert-circle'
                        }
                        size={10}
                        color={
                          paymentConfig[selectedOrder.paymentStatus]?.color ||
                          '#8E8E93'
                        }
                      />
                      <Text
                        style={[
                          styles.paymentText,
                          {
                            color:
                              paymentConfig[selectedOrder.paymentStatus]?.color ||
                              '#8E8E93',
                          },
                        ]}
                      >
                        {paymentConfig[selectedOrder.paymentStatus]?.label || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedOrder.remainingBalance > 0 &&
                  selectedOrder.status !== 'cancelled' &&
                  selectedOrder.status !== 'rejected' && (
                    <TouchableOpacity
                      style={styles.modalPayButton}
                      onPress={() => {
                        setShowOrderDetail(false);
                        handleMakePayment(selectedOrder);
                      }}
                    >
                      <LinearGradient
                        colors={['#FF6B9D', '#FF8FB1']}
                        style={styles.modalPayGradient}
                      >
                        <Feather name="credit-card" size={18} color="#FFF" />
                        <Text style={styles.modalPayText}>Pay Balance</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                <TouchableOpacity
                  style={styles.modalTrackButton}
                  onPress={() => {
                    setShowOrderDetail(false);
                    navigation.navigate('OrderTracking', { order: selectedOrder });
                  }}
                >
                  <Feather name="map-pin" size={18} color="#FF6B9D" />
                  <Text style={styles.modalTrackText}>Track Order</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );

  const PaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isProcessing) setShowPaymentModal(false);
      }}
    >
      <View style={styles.paymentModalOverlay}>
        <TouchableOpacity
          style={styles.paymentModalBackdrop}
          activeOpacity={1}
          onPress={() => {
            if (!isProcessing) setShowPaymentModal(false);
          }}
        />
        <Animated.View
          style={[styles.paymentModalContent, { transform: [{ scale: fadeAnim }] }]}
        >
          <View style={styles.paymentModalHeader}>
            <Text style={styles.paymentModalTitle}>
              {paymentStep === 1 ? 'Select Payment Method' : 'Payment Details'}
            </Text>
            {!isProcessing && (
              <TouchableOpacity
                style={styles.paymentModalClose}
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentStep(1);
                  setReferenceNumber('');
                  setProofImage(null);
                }}
              >
                <Feather name="x" size={22} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {selectedOrderForPayment && (
            <>
              {paymentStep === 1 && (
                <View style={styles.paymentStep1}>
                  <View style={styles.paymentOrderInfo}>
                    <Text style={styles.paymentOrderId}>
                      {selectedOrderForPayment.id}
                    </Text>
                    <Text style={styles.paymentOrderType}>
                      {selectedOrderForPayment.eventType}
                    </Text>
                    <Text style={styles.paymentAmount}>
                      ₱{selectedOrderForPayment.remainingBalance.toLocaleString()}
                    </Text>
                    <Text style={styles.paymentAmountLabel}>Remaining Balance</Text>
                  </View>

                  <View style={styles.paymentMethods}>
                    <Text style={styles.paymentMethodsTitle}>Select Payment Method</Text>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.paymentMethodItem,
                          paymentMethod === method.id && styles.paymentMethodItemActive,
                        ]}
                        onPress={() => handleSelectPaymentMethod(method.id)}
                      >
                        <View
                          style={[
                            styles.paymentMethodIcon,
                            { backgroundColor: method.color + '15' },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={method.icon}
                            size={24}
                            color={method.color}
                          />
                        </View>
                        <View style={styles.paymentMethodInfo}>
                          <Text style={styles.paymentMethodName}>{method.name}</Text>
                          <Text style={styles.paymentMethodDesc}>
                            {method.description}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.paymentMethodRadio,
                            paymentMethod === method.id &&
                              styles.paymentMethodRadioActive,
                          ]}
                        >
                          {paymentMethod === method.id && (
                            <View style={styles.paymentMethodRadioInner} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.paymentNote}>
                    <MaterialCommunityIcons name="information" size={16} color="#FF6B9D" />
                    <Text style={styles.paymentNoteText}>
                      For GCash/Maya payments, you will be asked to provide the reference
                      number and proof of payment.
                    </Text>
                  </View>
                </View>
              )}

              {paymentStep === 2 && (
                <ScrollView style={styles.paymentStep2} showsVerticalScrollIndicator={false}>
                  <View style={styles.paymentCompanyInfo}>
                    <MaterialCommunityIcons name="bank" size={24} color="#FF6B9D" />
                    <Text style={styles.paymentCompanyTitle}>Send Payment To:</Text>
                    <View style={styles.paymentCompanyDetails}>
                      <View style={styles.paymentCompanyRow}>
                        <Text style={styles.paymentCompanyLabel}>Account Name:</Text>
                        <Text style={styles.paymentCompanyValue}>
                          {paymentMethod === 'gcash'
                            ? companyPaymentDetails.gcash.name
                            : companyPaymentDetails.maya.name}
                        </Text>
                      </View>
                      <View style={styles.paymentCompanyRow}>
                        <Text style={styles.paymentCompanyLabel}>Account Number:</Text>
                        <Text style={styles.paymentCompanyValue}>
                          {paymentMethod === 'gcash'
                            ? companyPaymentDetails.gcash.number
                            : companyPaymentDetails.maya.number}
                        </Text>
                      </View>
                      <View style={styles.paymentCompanyRow}>
                        <Text style={styles.paymentCompanyLabel}>Amount:</Text>
                        <Text
                          style={[
                            styles.paymentCompanyValue,
                            styles.paymentCompanyAmount,
                          ]}
                        >
                          ₱{selectedOrderForPayment.remainingBalance.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                                  <View style={styles.paymentForm}>
                    <Text style={styles.paymentFormTitle}>Payment Confirmation</Text>

                    {/* ⭐ Custom payment amount — customer can pay less than the full balance */}
                    <View style={styles.paymentInputGroup}>
                      <Text style={styles.paymentInputLabel}>Payment Amount</Text>
                      <View style={styles.amountInputRow}>
                        <Text style={styles.amountCurrency}>₱</Text>
                        <TextInput
                          style={styles.amountInput}
                          placeholder="0.00"
                          placeholderTextColor="#B0B0B0"
                          keyboardType="decimal-pad"
                          value={customPaymentAmount}
                          onChangeText={(text) => {
                            // Keep only digits and a single decimal point
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            setCustomPaymentAmount(cleaned);
                          }}
                          editable={!isProcessing}
                        />
                      </View>
                      <Text style={styles.amountHint}>
                        Remaining balance: ₱
                        {selectedOrderForPayment?.remainingBalance?.toLocaleString()}
                      </Text>
                      <View style={styles.quickAmountRow}>
                        <TouchableOpacity
                          style={styles.quickAmountChip}
                          onPress={() =>
                            setCustomPaymentAmount(
                              String(selectedOrderForPayment?.remainingBalance || 0)
                            )
                          }
                        >
                          <Text style={styles.quickAmountChipText}>Full Balance</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickAmountChip}
                          onPress={() =>
                            setCustomPaymentAmount(
                              String(
                                Math.round(
                                  (selectedOrderForPayment?.remainingBalance || 0) / 2
                                )
                              )
                            )
                          }
                        >
                          <Text style={styles.quickAmountChipText}>50%</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickAmountChip}
                          onPress={() =>
                            setCustomPaymentAmount(
                              String(
                                Math.round(
                                  (selectedOrderForPayment?.remainingBalance || 0) * 0.3
                                )
                              )
                            )
                          }
                        >
                          <Text style={styles.quickAmountChipText}>30%</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.paymentInputGroup}>
                      <Text style={styles.paymentInputLabel}>Reference Number</Text>
                      <TextInput
                        style={styles.paymentInput}
                        placeholder="Enter reference number"
                        placeholderTextColor="#B0B0B0"
                        value={referenceNumber}
                        onChangeText={setReferenceNumber}
                        editable={!isProcessing}
                      />
                    </View>

                    <View style={styles.paymentInputGroup}>
                      <Text style={styles.paymentInputLabel}>Proof of Payment</Text>
                      <View style={styles.proofActions}>
                        <TouchableOpacity
                          style={[styles.proofButton, styles.proofCameraButton]}
                          onPress={handleTakePhoto}
                          disabled={isProcessing}
                        >
                          <Feather name="camera" size={20} color="#FFF" />
                          <Text style={styles.proofButtonText}>Take Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.proofButton, styles.proofGalleryButton]}
                          onPress={handlePickImage}
                          disabled={isProcessing}
                        >
                          <Feather name="image" size={20} color="#FF6B9D" />
                          <Text style={[styles.proofButtonText, styles.proofGalleryText]}>
                            Upload
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {proofImage && (
                        <View style={styles.proofPreview}>
                          <Image source={{ uri: proofImage }} style={styles.proofImage} />
                          <TouchableOpacity
                            style={styles.proofRemove}
                            onPress={() => setProofImage(null)}
                            disabled={isProcessing}
                          >
                            <Feather name="x" size={16} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </ScrollView>
              )}

              <View style={styles.paymentActions}>
                {paymentStep === 2 && (
                  <TouchableOpacity
                    style={styles.paymentBackButton}
                    onPress={() => setPaymentStep(1)}
                    disabled={isProcessing}
                  >
                    <Feather name="arrow-left" size={18} color="#8E8E93" />
                    <Text style={styles.paymentBackText}>Back</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.paymentConfirmButton,
                    isProcessing && styles.paymentConfirmDisabled,
                  ]}
                  onPress={paymentStep === 2 ? handleSubmitPayment : undefined}
                  disabled={paymentStep !== 2 || isProcessing}
                >
                  <LinearGradient
                    colors={['#FF6B9D', '#FF8FB1']}
                    style={styles.paymentConfirmGradient}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.paymentConfirmText}>Submit Payment</Text>
                        <Feather name="arrow-right" size={18} color="#FFF" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );

  const SuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-circle" size={64} color="#4CAF50" />
          </View>
          <Text style={styles.successTitle}>Payment Submitted!</Text>
          <Text style={styles.successText}>
            Your payment of ₱
            {selectedOrderForPayment?.remainingBalance?.toLocaleString()} via{' '}
            {paymentMethod?.toUpperCase()} has been submitted.
          </Text>
          <Text style={styles.successSubtext}>Reference Number: {referenceNumber}</Text>
          <View style={styles.successStatus}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#FF9800" />
            <Text style={styles.successStatusText}>
              Waiting for company confirmation. You will be notified once approved.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => {
              setShowSuccessModal(false);
              setPaymentStep(1);
              setReferenceNumber('');
              setProofImage(null);
              loadOrders(true);
            }}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8FB1']}
              style={styles.successGradient}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ⭐ Cancel Booking Confirmation Modal
  const CancelBookingModal = () => (
    <Modal
      visible={showCancelModal}
      transparent
      animationType="fade"
      onRequestClose={closeCancelModal}
    >
      <View style={styles.cancelModalOverlay}>
        <TouchableOpacity
          style={styles.cancelModalBackdrop}
          activeOpacity={1}
          onPress={closeCancelModal}
        />

        <View style={styles.cancelModalContent}>
          {/* Header */}
          <View style={styles.cancelModalHeader}>
            <View style={styles.cancelModalIconWrap}>
              <Feather name="alert-triangle" size={26} color="#FF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cancelModalTitle}>Cancel Booking?</Text>
              <Text style={styles.cancelModalSubtitle}>
                This action cannot be undone.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cancelModalClose}
              onPress={closeCancelModal}
              disabled={submittingCancel}
            >
              <Feather name="x" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {selectedCancelOrder && (
            <ScrollView
              style={styles.cancelModalBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Booking Summary */}
              <View style={styles.cancelSummaryBox}>
                <View style={styles.cancelSummaryRow}>
                  <Text style={styles.cancelSummaryLabel}>Booking #</Text>
                  <Text style={styles.cancelSummaryValue}>
                    {selectedCancelOrder.id}
                  </Text>
                </View>
                <View style={styles.cancelSummaryRow}>
                  <Text style={styles.cancelSummaryLabel}>Event</Text>
                  <Text style={styles.cancelSummaryValue}>
                    {selectedCancelOrder.eventType}
                  </Text>
                </View>
                <View style={styles.cancelSummaryRow}>
                  <Text style={styles.cancelSummaryLabel}>Date</Text>
                  <Text style={styles.cancelSummaryValue}>
                    {selectedCancelOrder.date}
                  </Text>
                </View>
                <View style={styles.cancelSummaryRow}>
                  <Text style={styles.cancelSummaryLabel}>Time</Text>
                  <Text style={styles.cancelSummaryValue}>
                    {selectedCancelOrder.timeSlot}
                  </Text>
                </View>
                {selectedCancelOrder.remainingBalance > 0 && (
                  <View style={styles.cancelSummaryRow}>
                    <Text style={styles.cancelSummaryLabel}>Balance</Text>
                    <Text
                      style={[
                        styles.cancelSummaryValue,
                        { color: '#FF5722', fontWeight: '700' },
                      ]}
                    >
                      ₱{selectedCancelOrder.remainingBalance.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Warning */}
              <View style={styles.cancelWarningBox}>
                <Feather name="info" size={14} color="#E65100" />
                <Text style={styles.cancelWarningText}>
                  Cancelling will remove this booking from your active list.
                  Any deposit already paid may be subject to the cancellation
                  policy. Please contact support if you have questions.
                </Text>
              </View>

              {/* Reason Input */}
              <Text style={styles.cancelInputLabel}>
                Reason for cancellation (optional)
              </Text>
              <TextInput
                style={styles.cancelReasonInput}
                placeholder="e.g. Change of plans, unexpected conflict..."
                placeholderTextColor="#B0B0B0"
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!submittingCancel}
                textAlignVertical="top"
              />
              <Text style={styles.cancelCharCount}>
                {cancelReason.length}/500
              </Text>
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.cancelModalFooter}>
            <TouchableOpacity
              style={[styles.cancelFooterBtn, styles.cancelFooterBtnKeep]}
              onPress={closeCancelModal}
              disabled={submittingCancel}
            >
              <Text style={styles.cancelFooterBtnKeepText}>Keep Booking</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelFooterBtn,
                styles.cancelFooterBtnConfirm,
                submittingCancel && styles.cancelFooterBtnDisabled,
              ]}
              onPress={submitCancellationRequest}
              disabled={submittingCancel}
            >
              {submittingCancel ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Feather name="x-circle" size={16} color="#FFF" />
                  <Text style={styles.cancelFooterBtnConfirmText}>
                    Yes, Cancel
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Feather name="calendar" size={48} color="#C6C6C8" />
      </View>
      <Text style={styles.emptyTitle}>No orders found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'upcoming'
          ? "You don't have any upcoming events. Start planning your next celebration!"
          : "You haven't completed any events yet."}
      </Text>
      <TouchableOpacity
        style={styles.bookButton}
        onPress={() => navigation.navigate('BookingTab')}
      >
        <Text style={styles.bookButtonText}>Book an Event</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View
        style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}
      >
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={{ marginTop: 16, color: '#8E8E93' }}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={['#FFFFFF', '#FFF8FA', '#FFF0F5']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FF6B9D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            My Orders
            {totalOrders > 0 && <Text style={styles.orderCount}> ({totalOrders})</Text>}
          </Text>
          <TouchableOpacity style={styles.filterButton} onPress={() => loadOrders(true)}>
            <Feather name="refresh-cw" size={20} color="#FF6B9D" />
          </TouchableOpacity>
        </View>

        <View style={styles.statusSummary}>
          <View style={styles.statusSummaryItem}>
            <View style={[styles.statusSummaryDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.statusSummaryLabel}>Pending</Text>
            <Text style={styles.statusSummaryCount}>{pendingApprovalCount}</Text>
          </View>
          <View style={styles.statusSummaryDivider} />
          <View style={styles.statusSummaryItem}>
            <View style={[styles.statusSummaryDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.statusSummaryLabel}>Confirmed</Text>
            <Text style={styles.statusSummaryCount}>
              {
                orders.upcoming.filter(
                  (o) =>
                    o.status === 'confirmed' ||
                    o.status === 'processing' ||
                    o.status === 'rescheduled'
                ).length
              }
            </Text>
          </View>
          <View style={styles.statusSummaryDivider} />
          <View style={styles.statusSummaryItem}>
            <View style={[styles.statusSummaryDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.statusSummaryLabel}>Completed</Text>
            <Text style={styles.statusSummaryCount}>{completedCount}</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
              Upcoming ({orders.upcoming.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              History ({orders.past.length})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={orders[activeTab]}
          renderItem={({ item }) => <OrderCard item={item} />}
          keyExtractor={(item) =>
            item.unique_id?.toString() ||
            item.id?.toString() ||
            item.booking_id?.toString()
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={EmptyState}
          refreshing={refreshing}
          onRefresh={() => loadOrders(false)}
        />
      </LinearGradient>

      <OrderDetailModal />
      <PaymentModal />
      <SuccessModal />
      <CancelBookingModal />

      <RescheduleModal
        visible={showRescheduleModal}
        mode={rescheduleMode}
        booking={selectedRescheduleBooking}
        onClose={closeRescheduleModal}
        onSuccess={() => {
          closeRescheduleModal();
          refreshNotifications();
          loadOrders(true);
        }}
      />

      <EditBookingModal
        visible={showEditModal}
        booking={editingBooking}
        saving={savingEdit}
        onClose={closeEditModal}
        onSave={handleSaveEdit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FF6B9D' },
  orderCount: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSummary: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statusSummaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusSummaryDot: { width: 8, height: 8, borderRadius: 4 },
  statusSummaryLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  statusSummaryCount: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  statusSummaryDivider: { width: 1, height: 24, backgroundColor: '#E5E5EA' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 26, alignItems: 'center' },
  tabActive: { backgroundColor: '#FF6B9D' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  orderCardPending: { borderWidth: 2, borderColor: '#FFE0B2' },
  orderCardRescheduleProposal: {
    borderWidth: 2,
    borderColor: '#9C27B0',
    shadowColor: '#9C27B0',
    shadowOpacity: 0.15,
  },
  orderCardRescheduleRejected: {
    borderWidth: 2,
    borderColor: '#F44336',
    shadowColor: '#F44336',
    shadowOpacity: 0.15,
  },
  highlightStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
  },
  highlightStripDanger: { backgroundColor: '#F44336' },
  highlightStripInfo: { backgroundColor: '#2196F3' },
  highlightStripText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: { fontSize: 12, fontWeight: '600', color: '#FF6B9D', marginBottom: 4 },
  orderType: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  packageBadge: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  packageBadgeText: { fontSize: 9, color: '#FF6B9D', fontWeight: '600' },
  balanceDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  balanceDueBadgeText: { fontSize: 9, color: '#FF5722', fontWeight: '500' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  pendingBadgeText: { fontSize: 9, color: '#FF9800', fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
  orderDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#8E8E93' },
  packageInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  packageInfoText: { fontSize: 12, color: '#FF6B9D', fontWeight: '500' },
  paymentSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paymentText: { fontSize: 11, fontWeight: '600' },
  totalAmount: { fontSize: 16, fontWeight: '700', color: '#FF6B9D' },
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  balanceLabel: { fontSize: 12, color: '#8E8E93' },
  balanceAmount: { fontSize: 14, fontWeight: '700', color: '#FF5722' },
  progressSection: { marginBottom: 12 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 11, color: '#8E8E93' },
  progressPercent: { fontSize: 11, fontWeight: '600', color: '#1C1C1E' },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
    flex: 1,
    minWidth: 60,
  },
  editButton: { backgroundColor: '#3F51B5' },
  editButtonText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  payButton: { backgroundColor: '#FF6B9D' },
  payButtonText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  rescheduleButton: { backgroundColor: '#2196F3' },
  rescheduleButtonText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  respondButton: { backgroundColor: '#9C27B0' },
  respondButtonText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  decideButton: { backgroundColor: '#F44336' },
  decideButtonText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  contactButton: { backgroundColor: '#FFF0F5' },
  contactButtonText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
  cancelCustomerButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  cancelCustomerButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  cancelCustomerText: { fontSize: 12, fontWeight: '600', color: '#FF4444' },
  cancelCustomerTextDisabled: { color: '#9E9E9E' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  bookButton: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  bookButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: { padding: 20 },
  modalOrderId: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalOrderIdText: { fontSize: 14, fontWeight: '600', color: '#FF6B9D' },
  modalEventType: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  modalPackageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F5',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalPackageText: { fontSize: 14, color: '#FF6B9D', fontWeight: '500' },
  modalInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  modalInfoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
  },
  modalInfoLabel: { fontSize: 10, color: '#8E8E93', marginTop: 4 },
  modalInfoValue: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', marginTop: 2 },
  modalMenuSection: { marginBottom: 16 },
  modalMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalMenuItemName: { fontSize: 13, color: '#1C1C1E' },
  modalMenuItemPrice: { fontSize: 13, fontWeight: '600', color: '#FF6B9D' },
  modalSpecialRequests: {
    backgroundColor: '#FFF8FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalSpecialText: { fontSize: 13, color: '#8E8E93', lineHeight: 18 },
  modalPaymentSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  modalPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPaymentLabel: { fontSize: 12, color: '#8E8E93' },
  modalPaymentValue: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  modalPaymentRemaining: { color: '#FF5722', fontSize: 14 },
  modalPayButton: { borderRadius: 28, overflow: 'hidden', marginBottom: 12 },
  modalPayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  modalPayText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  modalTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F5',
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  modalTrackText: { fontSize: 14, fontWeight: '600', color: '#FF6B9D' },
  paymentModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  paymentModalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  paymentModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: width - 40,
    maxHeight: height * 0.85,
    overflow: 'hidden',
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paymentModalTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  paymentModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentStep1: { padding: 16 },
  paymentOrderInfo: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paymentOrderId: { fontSize: 12, color: '#8E8E93' },
  paymentOrderType: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  paymentAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF6B9D',
    marginTop: 8,
  },
  paymentAmountLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  paymentMethods: { paddingTop: 16 },
  paymentMethodsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  paymentMethodItemActive: { borderColor: '#FF6B9D', backgroundColor: '#FFF0F5' },
  paymentMethodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodInfo: { flex: 1 },
  paymentMethodName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  paymentMethodDesc: { fontSize: 11, color: '#8E8E93' },
  paymentMethodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethodRadioActive: { borderColor: '#FF6B9D' },
  paymentMethodRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B9D',
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  paymentNoteText: { flex: 1, fontSize: 12, color: '#8E8E93', lineHeight: 16 },
  paymentStep2: { padding: 16 },
  paymentCompanyInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  paymentCompanyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 4,
    marginBottom: 12,
  },
  paymentCompanyDetails: { backgroundColor: '#FFF', borderRadius: 12, padding: 12 },
  paymentCompanyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paymentCompanyLabel: { fontSize: 12, color: '#8E8E93' },
  paymentCompanyValue: { fontSize: 12, fontWeight: '500', color: '#1C1C1E' },
  paymentCompanyAmount: { fontSize: 16, fontWeight: '700', color: '#FF6B9D' },
  paymentForm: { marginTop: 8 },
  paymentFormTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  paymentInputGroup: { marginBottom: 16 },
  paymentInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5A5A5E',
    marginBottom: 6,
  },
  paymentInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  proofActions: { flexDirection: 'row', gap: 10 },
  proofButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  proofCameraButton: { backgroundColor: '#FF6B9D' },
  proofGalleryButton: {
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FF6B9D',
  },
  proofButtonText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  proofGalleryText: { color: '#FF6B9D' },
  proofPreview: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  proofImage: { width: '100%', height: 150, borderRadius: 12 },
  proofRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofHint: { fontSize: 11, color: '#B0B0B0', marginTop: 6 },
  paymentActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  paymentBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 4,
  },
  paymentBackText: { fontSize: 14, color: '#8E8E93' },
  paymentConfirmButton: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  paymentConfirmDisabled: { opacity: 0.5 },
  paymentConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  paymentConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B9D',
    marginBottom: 12,
  },
  successStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  successStatusText: { flex: 1, fontSize: 12, color: '#8E8E93', lineHeight: 16 },
  successButton: { borderRadius: 28, overflow: 'hidden', width: '100%' },
  successGradient: { paddingVertical: 14, alignItems: 'center' },
  successButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // ⭐ Deadline badges
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#9C27B0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  deadlineBadgeInfo: {
    backgroundColor: '#2196F3',
  },
  deadlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // ⭐ Reschedule box in detail modal
  modalRescheduleBox: {
    backgroundColor: '#F3E5F5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  modalRescheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  // ⭐ Cancel Booking Modal styles
  cancelModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 8, 15, 0.65)',
    padding: 20,
  },
  cancelModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cancelModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: width - 40,
    maxWidth: 480,
    maxHeight: height * 0.85,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  cancelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cancelModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cancelModalSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  cancelModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    maxHeight: height * 0.5,
  },
  cancelSummaryBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cancelSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelSummaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  cancelSummaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },
  cancelWarningBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  cancelWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#8A5A00',
    lineHeight: 17,
  },
  cancelInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A5A5E',
    marginBottom: 6,
  },
  cancelReasonInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 90,
  },
  cancelCharCount: {
    fontSize: 11,
    color: '#B0B0B0',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
  cancelModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelFooterBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancelFooterBtnKeep: {
    backgroundColor: '#F5F5F5',
  },
  cancelFooterBtnKeepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A5A5E',
  },
  cancelFooterBtnConfirm: {
    backgroundColor: '#FF4444',
  },
  cancelFooterBtnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  cancelFooterBtnDisabled: {
    opacity: 0.6,
  },
    // ⭐ Custom amount input styles
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  amountCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B9D',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    paddingVertical: 10,
  },
  amountHint: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 6,
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickAmountChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FFD6E5',
  },
  quickAmountChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  
});

export default OrdersScreen;