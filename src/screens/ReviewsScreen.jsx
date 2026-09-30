import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { reviewAPI } from '../services/api';
import { bookingService } from '../services/bookingService';

const getList = (payload) => {
  const data = payload?.data?.data || payload?.data || payload || [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

const ReviewsScreen = ({ navigation }) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [reviewsResponse, bookingsResponse] = await Promise.allSettled([
        reviewAPI.getReviews({ per_page: 100 }),
        bookingService.getBookings({ per_page: 100 }),
      ]);

      if (reviewsResponse.status === 'fulfilled') {
        setReviews(getList(reviewsResponse.value));
      }
      if (bookingsResponse.status === 'fulfilled') {
        setBookings(getList(bookingsResponse.value));
      }
    } catch (error) {
      console.log('Reviews load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reviewableBookings = useMemo(() => {
    const reviewedBookingIds = new Set(reviews.map(r => r.booking_id));
    return bookings.filter(booking => booking.booking_id && !reviewedBookingIds.has(booking.booking_id));
  }, [bookings, reviews]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSubmit = async () => {
    if (!selectedBookingId) {
      Alert.alert('Select Booking', 'Please choose the booking you want to review.');
      return;
    }
    if (!rating) {
      Alert.alert('Rating Required', 'Please choose a rating from 1 to 5 stars.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await reviewAPI.createReview({
        booking_id: selectedBookingId,
        rating,
        food_rating: rating,
        service_rating: rating,
        value_rating: rating,
        overall_rating: rating,
        comment: review,
      });

      if (response.data?.success) {
        Alert.alert('Thank You!', 'Your review has been submitted.');
        setRating(0);
        setReview('');
        setSelectedBookingId(null);
        loadData();
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to submit review.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderReview = ({ item }) => {
    const customer = item.booking?.service_event?.customer?.person || item.booking?.serviceEvent?.customer?.person;
    const name = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Customer';
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewName}>{name}</Text>
          <View style={styles.reviewStars}>{[1,2,3,4,5].map(s => <Feather key={s} name="star" size={14} color={s <= (item.overall_rating || 0) ? '#FFB800' : '#e0e0e0'} />)}</View>
        </View>
        <Text style={styles.reviewText}>{item.comment || 'No comment provided.'}</Text>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#ff6b9d" /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color="#ff6b9d" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Reviews</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={reviews}
          keyExtractor={(item) => `review-${item.review_id || item.id}`}
          renderItem={renderReview}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ff6b9d']} />}
          ListHeaderComponent={
            <View>
              <View style={styles.card}>
                <Text style={styles.label}>Select booking to review</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookingList}>
                  {reviewableBookings.length === 0 ? (
                    <Text style={styles.emptyText}>No reviewable bookings found.</Text>
                  ) : reviewableBookings.map(booking => (
                    <TouchableOpacity
                      key={`booking-${booking.booking_id}`}
                      style={[styles.bookingChip, selectedBookingId === booking.booking_id && styles.bookingChipActive]}
                      onPress={() => setSelectedBookingId(booking.booking_id)}
                    >
                      <Text style={[styles.bookingChipText, selectedBookingId === booking.booking_id && styles.bookingChipTextActive]}>
                        #{booking.booking_reference || booking.booking_id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Rate your experience</Text>
                <View style={styles.stars}>{[1,2,3,4,5].map(s => <TouchableOpacity key={s} onPress={() => setRating(s)}><Feather name="star" size={40} color={s <= rating ? '#FFB800' : '#e0e0e0'} /></TouchableOpacity>)}</View>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Your review</Text>
                <TextInput style={styles.input} placeholder="Share your experience..." multiline numberOfLines={5} value={review} onChangeText={setReview} />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
                <LinearGradient colors={['#ff6b9d', '#ff8fb1']} style={styles.submitGradient}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Review</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.allReviewsTitle}>All Customer Reviews</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No customer reviews yet.</Text>}
          contentContainerStyle={styles.content}
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff0f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ff6b9d' },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', color: '#2d2d2d', marginBottom: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 16, padding: 16, fontSize: 14, height: 120, textAlignVertical: 'top' },
  submitButton: { borderRadius: 30, overflow: 'hidden', marginBottom: 24 },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bookingList: { gap: 8 },
  bookingChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#fff0f5' },
  bookingChipActive: { backgroundColor: '#ff6b9d' },
  bookingChipText: { color: '#ff6b9d', fontWeight: '700' },
  bookingChipTextActive: { color: '#fff' },
  allReviewsTitle: { fontSize: 18, fontWeight: '800', color: '#2d2d2d', marginBottom: 12 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewName: { fontSize: 14, fontWeight: '700', color: '#2d2d2d' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 14, color: '#555', lineHeight: 20 },
  emptyText: { color: '#8a8a8e', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
});

export default ReviewsScreen;
