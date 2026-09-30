// src/components/EditBookingModal.jsx
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const EditBookingModal = ({ visible, booking, onClose, onSave, saving = false }) => {
  const [form, setForm] = useState({
    venue: '',
    guests_count: '',
    event_date: new Date(),
    event_time: '',
    special_requests: '',
    delivery_address: '',
    delivery_contact_person: '',
    delivery_contact_phone: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible && booking) {
      setForm({
        venue: booking.location || booking.venue || '',
        guests_count: String(booking.pax || ''),
        event_date: booking.eventDate ? new Date(booking.eventDate) : new Date(),
        event_time: booking.timeSlot || '',
        special_requests: booking.specialRequests || '',
        delivery_address: booking.location || '',
        delivery_contact_person: '',
        delivery_contact_phone: '',
      });
    }
  }, [visible, booking]);

  if (!visible) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!form.venue.trim()) {
      Alert.alert('Required', 'Please enter the venue.');
      return;
    }
    const guests = parseInt(form.guests_count, 10);
    if (!guests || guests < 10) {
      Alert.alert('Required', 'Minimum of 10 guests required.');
      return;
    }
    onSave({
      venue: form.venue.trim(),
      guests_count: guests,
      event_date: form.event_date.toISOString().split('T')[0],
      event_time: form.event_time,
      special_requests: form.special_requests,
      delivery_address: form.delivery_address,
      delivery_contact_person: form.delivery_contact_person,
      delivery_contact_phone: form.delivery_contact_phone,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Feather name="edit-3" size={20} color="#FF6B9D" />
            </View>
            <Text style={styles.title}>Edit Booking</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>VENUE *</Text>
            <TextInput
              style={styles.input}
              value={form.venue}
              onChangeText={(t) => setField('venue', t)}
              placeholder="Event venue"
              placeholderTextColor="#C0C0C0"
            />

            <Text style={styles.fieldLabel}>GUESTS *</Text>
            <TextInput
              style={styles.input}
              value={form.guests_count}
              onChangeText={(t) => setField('guests_count', t)}
              keyboardType="numeric"
              placeholder="e.g. 50"
              placeholderTextColor="#C0C0C0"
            />

            <Text style={styles.fieldLabel}>EVENT DATE</Text>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Feather name="calendar" size={16} color="#FF6B9D" />
              <Text style={styles.dateText}>
                {form.event_date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Feather name="chevron-down" size={16} color="#B0B0B0" />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>EVENT TIME</Text>
            <TextInput
              style={styles.input}
              value={form.event_time}
              onChangeText={(t) => setField('event_time', t)}
              placeholder="e.g. 12:00 PM"
              placeholderTextColor="#C0C0C0"
            />

            <Text style={styles.fieldLabel}>SPECIAL REQUESTS</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.special_requests}
              onChangeText={(t) => setField('special_requests', t)}
              placeholder="Dietary restrictions, themes..."
              placeholderTextColor="#C0C0C0"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.note}>
              <Feather name="info" size={13} color="#FF6B9D" />
              <Text style={styles.noteText}>
                Editing is only allowed while the booking is pending approval.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.btnGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Feather name="check" size={14} color="#FFF" />
                    <Text style={styles.btnPrimaryText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={form.event_date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(event, picked) => {
                setShowDatePicker(false);
                if (picked) setField('event_date', picked);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFF',
    borderRadius: 22,
    paddingTop: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8EB',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { paddingHorizontal: 18, paddingTop: 12 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A8A8E',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E0E3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2D2D2D',
    minHeight: 42,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E0E3',
    paddingHorizontal: 12,
    height: 46,
  },
  dateText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#2D2D2D' },
  note: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F8',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FFE8EE',
  },
  noteText: { flex: 1, fontSize: 11, color: '#8A8A8E', lineHeight: 15 },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0E8EB',
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: { backgroundColor: '#F5F5F5' },
  btnCancelText: { fontSize: 13, fontWeight: '700', color: '#2D2D2D' },
  btnPrimary: { overflow: 'hidden' },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});

export default EditBookingModal;