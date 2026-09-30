// src/components/RescheduleModal.jsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { bookingService } from '../services/bookingService';

const TIME_OPTIONS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
];

export default function RescheduleModal({
  visible,
  mode = 'customer-request',
  booking,
  onClose,
  onSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);

  // customer-request
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [reason, setReason] = useState('');

  // customer-admin-proposal
  const [adminAction, setAdminAction] = useState('accept');
  const [counterDate, setCounterDate] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // customer-after-rejection
  const [postRejectionAction, setPostRejectionAction] = useState('continue');
  const [postRejectionReason, setPostRejectionReason] = useState('');

  useEffect(() => {
    if (!visible) return;

    setSubmitting(false);
    setRequestedDate('');
    setRequestedTime('');
    setReason('');
    setAdminAction('accept');
    setCounterDate('');
    setCounterTime('');
    setCancelReason('');
    setPostRejectionAction('continue');
    setPostRejectionReason('');
  }, [visible]);

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const isValidDate = (value) => {
    if (!value) return false;
    const d = new Date(value);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(value);
    target.setHours(0, 0, 0, 0);
    return target >= today;
  };

  const safeBookingId = () =>
    booking?.booking_id || booking?.id || booking?.unique_id || null;

  const checkAvailability = async (date, time, excludeId) => {
    try {
      const res = await bookingService.validateSlot({
        event_date: date,
        event_time: time,
        exclude_booking_id: excludeId,
      });
      const payload = res?.data || {};
      return {
        available: payload.available === true,
        same_datetime: payload.same_datetime === true,
        conflict: payload.conflict || null,
      };
    } catch (e) {
      return {
        available: false,
        conflict:
          e?.response?.data?.message ||
          e?.message ||
          'Could not verify slot availability.',
      };
    }
  };

  const closeIfNotBusy = () => {
    if (submitting) return;
    if (typeof onClose === 'function') onClose();
  };

  // ------------------------------------------------------------
  // Propose new schedule
  // ------------------------------------------------------------
  const handlePropose = async () => {
    const bookingId = safeBookingId();
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking reference.');
      return;
    }

    if (!isValidDate(requestedDate)) {
      Alert.alert('Invalid date', 'Please enter a valid future date (YYYY-MM-DD).');
      return;
    }
    if (!requestedTime) {
      Alert.alert('Missing time', 'Please select a time slot.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      Alert.alert('Missing reason', 'Please enter at least 5 characters explaining the reschedule.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const check = await checkAvailability(requestedDate, requestedTime, bookingId);

      if (!check.available && !check.same_datetime) {
        const msg =
          check.conflict?.message ||
          check.conflict ||
          'The selected slot is not available.';
        Alert.alert('Slot not available', msg);
        setSubmitting(false);
        return;
      }

      const res = await bookingService.customerRequestReschedule(bookingId, {
        requested_date: requestedDate,
        requested_time: requestedTime,
        reason: reason.trim(),
      });

      if (res?.success === false) {
        Alert.alert('Cannot reschedule', res.message || 'Failed to send request.');
        setSubmitting(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Request Sent', 'Your reschedule request has been sent to the admin.', [
        { text: 'OK', onPress: () => typeof onSuccess === 'function' && onSuccess() },
      ]);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send reschedule request.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // Accept admin proposal
  // ------------------------------------------------------------
  const handleAcceptAdmin = async () => {
    const bookingId = safeBookingId();
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking reference.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await bookingService.customerRescheduleResponse(bookingId, {
        action: 'accept',
      });

      if (res?.success === false) {
        Alert.alert('Error', res.message || 'Failed to accept.');
        setSubmitting(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Accepted', 'You have accepted the new schedule.', [
        { text: 'OK', onPress: () => typeof onSuccess === 'function' && onSuccess() },
      ]);
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to accept.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // Counter-propose
  // ------------------------------------------------------------
  const handleCounterAdmin = async () => {
    const bookingId = safeBookingId();
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking reference.');
      return;
    }

    if (!isValidDate(counterDate)) {
      Alert.alert('Invalid date', 'Please enter a valid future date (YYYY-MM-DD).');
      return;
    }
    if (!counterTime) {
      Alert.alert('Missing time', 'Please select a time slot.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const check = await checkAvailability(counterDate, counterTime, bookingId);

      if (!check.available && !check.same_datetime) {
        const msg =
          check.conflict?.message ||
          check.conflict ||
          'The selected slot is not available.';
        Alert.alert('Slot not available', msg);
        setSubmitting(false);
        return;
      }

      const res = await bookingService.customerRescheduleResponse(bookingId, {
        action: 'counter',
        new_date: counterDate,
        new_time: counterTime,
        reason: reason.trim() || 'Customer proposed an alternative date.',
      });

      if (res?.success === false) {
        Alert.alert('Error', res.message || 'Failed to send counter proposal.');
        setSubmitting(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent', 'Your counter-proposal has been sent to the admin.', [
        { text: 'OK', onPress: () => typeof onSuccess === 'function' && onSuccess() },
      ]);
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to send.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // Cancel booking (during admin proposal)
  // ------------------------------------------------------------
  const handleCancelDuringAdmin = async () => {
    const bookingId = safeBookingId();
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking reference.');
      return;
    }

    Alert.alert(
      'Cancel Booking?',
      'The admin proposed a new date. Cancelling will cancel the entire booking. Continue?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            try {
              const res = await bookingService.customerRescheduleResponse(bookingId, {
                action: 'cancel',
                reason: cancelReason.trim() || 'Customer declined reschedule.',
              });

              if (res?.success === false) {
                Alert.alert('Error', res.message || 'Failed to cancel.');
                setSubmitting(false);
                return;
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Cancelled', 'Your booking has been cancelled.', [
                { text: 'OK', onPress: () => typeof onSuccess === 'function' && onSuccess() },
              ]);
            } catch (error) {
              const msg =
                error?.response?.data?.message || error?.message || 'Failed to cancel.';
              Alert.alert('Error', msg);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ------------------------------------------------------------
  // Post-rejection decision
  // ------------------------------------------------------------
  const handlePostRejection = async () => {
    const bookingId = safeBookingId();
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking reference.');
      return;
    }

    if (postRejectionAction === 'cancel') {
      Alert.alert(
        'Cancel Booking?',
        'This will cancel the entire booking. Continue?',
        [
          { text: 'Keep Booking', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => submitPostRejection('cancel', bookingId),
          },
        ]
      );
      return;
    }

    submitPostRejection('continue', bookingId);
  };

  const submitPostRejection = async (action, bookingId) => {
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await bookingService.customerPostRejectionDecision(bookingId, {
        action,
        reason: postRejectionReason.trim() || null,
      });

      if (res?.success === false) {
        Alert.alert('Error', res.message || 'Failed to submit decision.');
        setSubmitting(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        action === 'continue' ? 'Continued' : 'Cancelled',
        action === 'continue'
          ? 'You will keep the original schedule.'
          : 'Your booking has been cancelled.',
        [{ text: 'OK', onPress: () => typeof onSuccess === 'function' && onSuccess() }]
      );
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to submit.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // Field renderers
  // ------------------------------------------------------------
  const renderDateField = (value, onChange, label = 'New Date') => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#B0B0B0"
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />
      <Text style={styles.fieldHint}>Format: 2026-03-15</Text>
    </View>
  );

  const renderTimeField = (value, onChange, label = 'New Time') => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.timeGrid}>
        {TIME_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.timeChip, value === t && styles.timeChipActive]}
            onPress={() => onChange(t)}
            disabled={submitting}
          >
            <Text style={[styles.timeChipText, value === t && styles.timeChipTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ------------------------------------------------------------
  // Section renderers
  // ------------------------------------------------------------
  const renderCustomerRequest = () => (
    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.noticeBox}>
        <Feather name="info" size={14} color="#0D47A1" />
        <Text style={styles.noticeText}>
          Your request will be sent to the admin for approval. You can choose any available
          date and time.
        </Text>
      </View>

      {renderDateField(requestedDate, setRequestedDate, 'Requested Date')}
      {renderTimeField(requestedTime, setRequestedTime, 'Requested Time')}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Reason *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Explain why you want to reschedule..."
          placeholderTextColor="#B0B0B0"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          maxLength={500}
          editable={!submitting}
          textAlignVertical="top"
        />
        <Text style={styles.fieldHint}>{reason.length}/500</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={handlePropose}
        disabled={submitting}
      >
        <LinearGradient colors={['#FF6B9D', '#FF8FB1']} style={styles.primaryBtnGradient}>
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather name="send" size={16} color="#FFF" />
              <Text style={styles.primaryBtnText}>Send Request</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAdminProposal = () => (
    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.noticeBoxPurple}>
        <Feather name="bell" size={14} color="#6A1B9A" />
        <Text style={styles.noticeTextPurple}>
          Admin proposed a new schedule. Please choose how to respond.
        </Text>
      </View>

      <View style={styles.proposalCard}>
        <View style={styles.proposalRow}>
          <Text style={styles.proposalLabel}>Original</Text>
          <Text style={styles.proposalValue}>
            {booking?.date} · {booking?.timeSlot}
          </Text>
        </View>
        <View style={styles.proposalRow}>
          <Text style={styles.proposalLabel}>Proposed</Text>
          <Text style={[styles.proposalValue, { color: '#9C27B0', fontWeight: '700' }]}>
            {booking?.requested_date} · {booking?.requested_time}
          </Text>
        </View>
        {booking?.reschedule_reason ? (
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Reason</Text>
            <Text style={styles.proposalValue}>{booking.reschedule_reason}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.choiceRow}>
        <TouchableOpacity
          style={[styles.choiceBtn, adminAction === 'accept' && styles.choiceBtnActive]}
          onPress={() => setAdminAction('accept')}
          disabled={submitting}
        >
          <Feather
            name="check-circle"
            size={18}
            color={adminAction === 'accept' ? '#FFF' : '#4CAF50'}
          />
          <Text
            style={[styles.choiceBtnText, adminAction === 'accept' && styles.choiceBtnTextActive]}
          >
            Accept
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.choiceBtn, adminAction === 'counter' && styles.choiceBtnActive]}
          onPress={() => setAdminAction('counter')}
          disabled={submitting}
        >
          <Feather
            name="refresh-cw"
            size={18}
            color={adminAction === 'counter' ? '#FFF' : '#2196F3'}
          />
          <Text
            style={[styles.choiceBtnText, adminAction === 'counter' && styles.choiceBtnTextActive]}
          >
            Counter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.choiceBtn, adminAction === 'cancel' && styles.choiceBtnActiveDanger]}
          onPress={() => setAdminAction('cancel')}
          disabled={submitting}
        >
          <Feather
            name="x-circle"
            size={18}
            color={adminAction === 'cancel' ? '#FFF' : '#F44336'}
          />
          <Text
            style={[styles.choiceBtnText, adminAction === 'cancel' && styles.choiceBtnTextActive]}
          >
            Cancel
          </Text>
        </TouchableOpacity>
      </View>

      {adminAction === 'accept' ? (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionText}>
            You will be moved to the proposed date and time.
          </Text>
        </View>
      ) : null}

      {adminAction === 'counter' ? (
        <>
          {renderDateField(counterDate, setCounterDate, 'Your Proposed Date')}
          {renderTimeField(counterTime, setCounterTime, 'Your Proposed Time')}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Why is this time better for you?"
              placeholderTextColor="#B0B0B0"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!submitting}
              textAlignVertical="top"
            />
          </View>
        </>
      ) : null}

      {adminAction === 'cancel' ? (
        <View style={styles.sectionBoxDanger}>
          <Text style={styles.sectionTextDanger}>
            Cancelling will remove your booking entirely. This action cannot be undone.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea, { marginTop: 10 }]}
            placeholder="Reason for cancellation (optional)"
            placeholderTextColor="#B0B0B0"
            value={cancelReason}
            onChangeText={setCancelReason}
            multiline
            numberOfLines={3}
            maxLength={500}
            editable={!submitting}
            textAlignVertical="top"
          />
        </View>
      ) : null}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          adminAction === 'cancel' && styles.primaryBtnDanger,
          submitting && styles.btnDisabled,
        ]}
        onPress={
          adminAction === 'accept'
            ? handleAcceptAdmin
            : adminAction === 'counter'
            ? handleCounterAdmin
            : handleCancelDuringAdmin
        }
        disabled={submitting}
      >
        <LinearGradient
          colors={adminAction === 'cancel' ? ['#F44336', '#E53935'] : ['#FF6B9D', '#FF8FB1']}
          style={styles.primaryBtnGradient}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather
                name={
                  adminAction === 'accept'
                    ? 'check-circle'
                    : adminAction === 'counter'
                    ? 'refresh-cw'
                    : 'x-circle'
                }
                size={16}
                color="#FFF"
              />
              <Text style={styles.primaryBtnText}>
                {adminAction === 'accept'
                  ? 'Accept Proposal'
                  : adminAction === 'counter'
                  ? 'Send Counter Proposal'
                  : 'Cancel Booking'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAfterRejection = () => (
    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.noticeBoxDanger}>
        <Feather name="alert-circle" size={14} color="#B71C1C" />
        <Text style={styles.noticeTextDanger}>
          Your reschedule request was declined. You can continue with the original schedule,
          or cancel the booking.
        </Text>
      </View>

      <View style={styles.proposalCard}>
        <View style={styles.proposalRow}>
          <Text style={styles.proposalLabel}>Original Schedule</Text>
          <Text style={styles.proposalValue}>
            {booking?.date} · {booking?.timeSlot}
          </Text>
        </View>
        {booking?.reschedule_reason ? (
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Admin's Reason</Text>
            <Text style={styles.proposalValue}>{booking.reschedule_reason}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.choiceRow}>
        <TouchableOpacity
          style={[
            styles.choiceBtn,
            postRejectionAction === 'continue' && styles.choiceBtnActive,
          ]}
          onPress={() => setPostRejectionAction('continue')}
          disabled={submitting}
        >
          <Feather
            name="check-circle"
            size={18}
            color={postRejectionAction === 'continue' ? '#FFF' : '#4CAF50'}
          />
          <Text
            style={[
              styles.choiceBtnText,
              postRejectionAction === 'continue' && styles.choiceBtnTextActive,
            ]}
          >
            Continue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.choiceBtn,
            postRejectionAction === 'cancel' && styles.choiceBtnActiveDanger,
          ]}
          onPress={() => setPostRejectionAction('cancel')}
          disabled={submitting}
        >
          <Feather
            name="x-circle"
            size={18}
            color={postRejectionAction === 'cancel' ? '#FFF' : '#F44336'}
          />
          <Text
            style={[
              styles.choiceBtnText,
              postRejectionAction === 'cancel' && styles.choiceBtnTextActive,
            ]}
          >
            Cancel Booking
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Any additional note..."
          placeholderTextColor="#B0B0B0"
          value={postRejectionReason}
          onChangeText={setPostRejectionReason}
          multiline
          numberOfLines={3}
          maxLength={500}
          editable={!submitting}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          postRejectionAction === 'cancel' && styles.primaryBtnDanger,
          submitting && styles.btnDisabled,
        ]}
        onPress={handlePostRejection}
        disabled={submitting}
      >
        <LinearGradient
          colors={
            postRejectionAction === 'cancel'
              ? ['#F44336', '#E53935']
              : ['#FF6B9D', '#FF8FB1']
          }
          style={styles.primaryBtnGradient}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather
                name={postRejectionAction === 'cancel' ? 'x-circle' : 'check-circle'}
                size={16}
                color="#FFF"
              />
              <Text style={styles.primaryBtnText}>
                {postRejectionAction === 'cancel' ? 'Confirm Cancellation' : 'Continue'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  const getTitle = () => {
    if (mode === 'customer-admin-proposal') return 'Admin Proposed New Date';
    if (mode === 'customer-after-rejection') return 'Reschedule Declined';
    return 'Request Reschedule';
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeIfNotBusy}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeIfNotBusy}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="calendar-edit" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{getTitle()}</Text>
              <Text style={styles.headerSubtitle}>Booking {booking?.id || '—'}</Text>
            </View>
            <TouchableOpacity
              style={styles.headerClose}
              onPress={closeIfNotBusy}
              disabled={submitting}
            >
              <Feather name="x" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {mode === 'customer-admin-proposal'
            ? renderAdminProposal()
            : mode === 'customer-after-rejection'
            ? renderAfterRejection()
            : renderCustomerRequest()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#FF6B9D',
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  headerClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  body: { padding: 18, maxHeight: 600 },

  noticeBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#E3F2FD', borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 12, color: '#0D47A1', lineHeight: 17 },

  noticeBoxPurple: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#F3E5F5', borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  noticeTextPurple: { flex: 1, fontSize: 12, color: '#4A148C', lineHeight: 17 },

  noticeBoxDanger: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FFEBEE', borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  noticeTextDanger: { flex: 1, fontSize: 12, color: '#B71C1C', lineHeight: 17 },

  proposalCard: {
    backgroundColor: '#F8F9FA', borderRadius: 14, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#EEE',
  },
  proposalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  proposalLabel: { fontSize: 12, color: '#8E8E93', flexShrink: 0, marginRight: 8 },
  proposalValue: { fontSize: 13, color: '#1C1C1E', flexShrink: 1, textAlign: 'right' },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#5A5A5E', marginBottom: 6 },
  fieldHint: { fontSize: 11, color: '#B0B0B0', marginTop: 4 },
  input: {
    backgroundColor: '#F8F9FA', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E5EA',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1C1C1E',
  },
  textarea: { minHeight: 80 },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, backgroundColor: '#F8F9FA',
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  timeChipActive: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  timeChipText: { fontSize: 12, color: '#5A5A5E', fontWeight: '500' },
  timeChipTextActive: { color: '#FFF' },

  choiceRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  choiceBtn: {
    flex: 1, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#F8F9FA',
    borderWidth: 2, borderColor: 'transparent',
  },
  choiceBtnActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  choiceBtnActiveDanger: { backgroundColor: '#F44336', borderColor: '#F44336' },
  choiceBtnText: { fontSize: 13, fontWeight: '600', color: '#5A5A5E' },
  choiceBtnTextActive: { color: '#FFF' },

  sectionBox: {
    backgroundColor: '#E8F5E9', borderRadius: 12,
    padding: 14, marginBottom: 14,
  },
  sectionText: { fontSize: 13, color: '#1B5E20', lineHeight: 18 },

  sectionBoxDanger: {
    backgroundColor: '#FFEBEE', borderRadius: 12,
    padding: 14, marginBottom: 14,
  },
  sectionTextDanger: { fontSize: 13, color: '#B71C1C', lineHeight: 18 },

  primaryBtn: { borderRadius: 28, overflow: 'hidden', marginTop: 6 },
  primaryBtnDanger: {},
  primaryBtnGradient: {
    flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.6 },
});