// src/screens/CalendarScreen.jsx - UPDATED WITH VERTICAL FORM-STYLE INSIGHTS
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { bookingService } from '../services/bookingService';

const { width, height } = Dimensions.get('window');

const CalendarScreen = ({ navigation }) => {
  const { isGuest, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookedDates, setBookedDates] = useState([]);
  const [fullyBookedDates, setFullyBookedDates] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [limitedSlotsDates, setLimitedSlotsDates] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [availabilityData, setAvailabilityData] = useState({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Load calendar data
  const loadCalendarData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      console.log('🔄 Loading calendar data...');
      
      const [eventTypesResponse, calendarResponse, availabilityResponse] = await Promise.all([
        bookingService.getEventTypes(),
        bookingService.getCalendarEvents(),
        bookingService.getCalendarAvailability()
      ]);
      
      if (eventTypesResponse.success) {
        const types = eventTypesResponse.data?.data || eventTypesResponse.data || [];
        setEventTypes(types);
      }
      
      if (calendarResponse.success) {
        const calendarEvents = calendarResponse.data?.data || calendarResponse.data || [];
        const booked = calendarEvents.map(event => event.start || event.event_date);
        setBookedDates(booked);
        
        const formattedEvents = calendarEvents.map(event => ({
          date: event.start || event.event_date,
          title: event.title || event.event_type_name || 'Event',
          time: event.time || event.event_time || 'TBD',
          type: event.type || event.event_type || 'general',
          id: event.id || event.booking_id,
          status: event.status || event.booking_status,
          venue: event.venue || event.location || '',
        }));
        setEvents(formattedEvents);
      }
      
      if (availabilityResponse.success) {
        const availData = availabilityResponse.data?.data || availabilityResponse.data || [];
        const fullyBookedList = [];
        const unavailableList = [];
        const limitedSlotsList = [];
        const availMap = {};
        
        availData.forEach(item => {
          const date = item.availability_date || item.date;
          const status = item.status || 'available';
          const maxBookings = item.max_bookings || null;
          
          availMap[date] = {
            status: status,
            max_bookings: maxBookings,
            notes: item.notes || ''
          };
          
          if (status === 'fully_booked') {
            fullyBookedList.push(date);
          } else if (status === 'unavailable') {
            unavailableList.push(date);
          } else if (status === 'available' && maxBookings !== null && maxBookings > 0) {
            limitedSlotsList.push(date);
          }
        });
        
        setFullyBookedDates(fullyBookedList);
        setUnavailableDates(unavailableList);
        setLimitedSlotsDates(limitedSlotsList);
        setAvailabilityData(availMap);
      }
      
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isGuest) {
        loadCalendarData();
      } else {
        setLoading(false);
      }
    }, [isGuest, loadCalendarData])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getYear = () => currentDate.getFullYear();
  const getMonth = () => currentDate.getMonth();

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isBooked = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return bookedDates.some(date => date && date.startsWith(dateKey));
  };

  const isFullyBooked = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return fullyBookedDates.some(date => date && date.startsWith(dateKey));
  };

  const isUnavailable = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return unavailableDates.some(date => date && date.startsWith(dateKey));
  };

  const hasLimitedSlots = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return limitedSlotsDates.some(date => date && date.startsWith(dateKey));
  };

  const getDateAvailability = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return availabilityData[dateKey] || null;
  };

  const isToday = (year, month, day) => {
    const today = new Date();
    return today.getFullYear() === year && 
           today.getMonth() === month && 
           today.getDate() === day;
  };

  const isSelected = (year, month, day) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === year &&
           selectedDate.getMonth() === month &&
           selectedDate.getDate() === day;
  };

  const hasEvent = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return events.some(e => e.date && e.date.startsWith(dateKey));
  };

  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(new Date(getYear(), getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(new Date(getYear(), getMonth() + 1, 1));
  };

  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateSelect = (year, month, day) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const selected = new Date(year, month, day);
    setSelectedDate(selected);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCalendarData(false);
  };

  const buildCalendarDays = () => {
    const year = getYear();
    const month = getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const calendarDays = [];

    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({
        type: 'empty',
        key: `empty-${i}`,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const booked = isBooked(year, month, day);
      const fullyBooked = isFullyBooked(year, month, day);
      const unavailable = isUnavailable(year, month, day);
      const limitedSlots = hasLimitedSlots(year, month, day);
      const today = isToday(year, month, day);
      const selected = isSelected(year, month, day);
      const hasEventToday = hasEvent(year, month, day);
      const availability = getDateAvailability(year, month, day);

      calendarDays.push({
        type: 'day',
        key: `day-${day}`,
        day: day,
        booked: booked,
        fullyBooked: fullyBooked,
        unavailable: unavailable,
        limitedSlots: limitedSlots,
        today: today,
        selected: selected,
        hasEvent: hasEventToday,
        year: year,
        month: month,
        availability: availability,
        displayStatus: fullyBooked ? 'fully_booked' : 
                       unavailable ? 'unavailable' : 
                       booked ? 'booked' : 
                       limitedSlots ? 'limited' : 'available'
      });
    }

    return calendarDays;
  };

  const getEventStats = () => {
    const year = getYear();
    const month = getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    let bookedCount = 0;
    let availableCount = 0;
    let eventCount = 0;
    let fullyBookedCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (isBooked(year, month, day)) bookedCount++;
      else availableCount++;
      if (hasEvent(year, month, day)) eventCount++;
      if (isFullyBooked(year, month, day)) fullyBookedCount++;
    }

    return { bookedCount, availableCount, eventCount, fullyBookedCount };
  };

  const stats = getEventStats();

  const getEventTypeColor = (type) => {
    const found = eventTypes.find(t => t.slug === type || t.name === type);
    return found?.color || '#FF6B9D';
  };

  const getEventTypeIcon = (type) => {
    const found = eventTypes.find(t => t.slug === type || t.name === type);
    return found?.icon || 'calendar-star';
  };

  const renderEventsForSelectedDate = () => {
    if (!selectedDate) return null;
    
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateKey = formatDateKey(year, month, day);
    const dayEvents = events.filter(e => e.date && e.date.startsWith(dateKey));
    const availability = getDateAvailability(year, month, day);

    let statusMessage = null;
    let statusColor = '';
    let statusBgColor = '';
    let statusIcon = '';
    
    if (availability) {
      if (availability.status === 'fully_booked') {
        statusMessage = 'Fully Booked - No more slots available';
        statusColor = '#C62828';
        statusBgColor = '#FFEBEE';
        statusIcon = 'lock';
      } else if (availability.status === 'unavailable') {
        statusMessage = 'Unavailable - Date is blocked';
        statusColor = '#E65100';
        statusBgColor = '#FFF3E0';
        statusIcon = 'alert-circle';
      } else if (availability.status === 'available' && availability.max_bookings) {
        statusMessage = `${availability.max_bookings} slots available`;
        statusColor = '#2E7D32';
        statusBgColor = '#E8F5E9';
        statusIcon = 'check-circle';
      }
    }

    return (
      <View style={styles.eventsCard}>
        <View style={styles.eventsCardHeader}>
          <Text style={styles.eventsCardTitle}>
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </Text>
          <View style={styles.eventsCountBadge}>
            <Text style={styles.eventsCountText}>{dayEvents.length}</Text>
          </View>
        </View>
        
        {statusMessage && (
          <View style={[styles.statusMessage, { backgroundColor: statusBgColor }]}>
            <MaterialCommunityIcons 
              name={statusIcon} 
              size={16} 
              color={statusColor} 
            />
            <Text style={[styles.statusMessageText, { color: statusColor }]}>
              {statusMessage}
            </Text>
          </View>
        )}
        
        {dayEvents.length === 0 && !statusMessage ? (
          <View style={styles.noEventsContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#E0E0E0" />
            <Text style={styles.noEventsTitle}>No Events</Text>
            <Text style={styles.noEventsSubtext}>This day is available for booking</Text>
          </View>
        ) : (
          dayEvents.map((event, index) => (
            <TouchableOpacity 
              key={event.id || index}
              style={[styles.eventItem, { borderLeftColor: getEventTypeColor(event.type) }]}
              activeOpacity={0.7}
              onPress={() => {
                if (event.id) {
                  navigation.navigate('OrderDetail', { bookingId: event.id });
                }
              }}
            >
              <View style={styles.eventItemLeft}>
                <View style={[styles.eventIcon, { backgroundColor: getEventTypeColor(event.type) + '20' }]}>
                  <MaterialCommunityIcons 
                    name={getEventTypeIcon(event.type)} 
                    size={20} 
                    color={getEventTypeColor(event.type)} 
                  />
                </View>
                <View style={styles.eventDetails}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  <View style={styles.eventMeta}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color="#8A8A8E" />
                    <Text style={styles.eventMetaText}>{event.time}</Text>
                    {event.venue && (
                      <>
                        <MaterialCommunityIcons name="map-marker-outline" size={12} color="#8A8A8E" />
                        <Text style={styles.eventMetaText}>{event.venue}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
              <View style={[styles.eventStatusBadge, { backgroundColor: getEventTypeColor(event.type) + '20' }]}>
                <Text style={[styles.eventStatusText, { color: getEventTypeColor(event.type) }]}>
                  {event.status || 'Booked'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        
        {dayEvents.length > 0 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('Bookings')}
          >
            <Text style={styles.viewAllText}>View All Events</Text>
            <Feather name="chevron-right" size={16} color="#FF6B9D" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const calendarDays = buildCalendarDays();

  // Guest mode
  if (isGuest) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#FFFFFF', '#FFF8FA', '#FFF0F5']}
          style={styles.gradient}
        >
          <View style={styles.guestContainer}>
            <MaterialCommunityIcons name="calendar-lock" size={64} color="#D1D1D6" />
            <Text style={styles.guestTitle}>Access Calendar</Text>
            <Text style={styles.guestText}>
              Sign in to view your event calendar, manage bookings, and stay organized.
            </Text>
            <TouchableOpacity 
              style={styles.guestLoginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.guestLoginGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.guestLoginText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={styles.loadingText}>Loading your calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#FFFFFF', '#FFF8FA']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Calendar</Text>
            <View style={styles.yearBadge}>
              <Text style={styles.yearBadgeText}>{getYear()}</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={goToToday} 
              style={styles.todayButton}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.todayGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B9D"
              colors={['#FF6B9D']}
            />
          }
        >
          {/* Month Navigation */}
          <Animated.View 
            style={[
              styles.navigationCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              onPress={goToPreviousMonth} 
              style={styles.navButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#FF6B9D" />
            </TouchableOpacity>

            <View style={styles.monthYearContainer}>
              <Text style={styles.monthText}>{months[getMonth()]}</Text>
              <Text style={styles.yearText}>{getYear()}</Text>
            </View>

            <TouchableOpacity 
              onPress={goToNextMonth} 
              style={styles.navButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-right" size={24} color="#FF6B9D" />
            </TouchableOpacity>
          </Animated.View>

          {/* Stats / Insights - VERTICAL FORM STYLE */}
          <Animated.View 
            style={[
              styles.insightsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.insightsHeader}>
              <MaterialCommunityIcons name="chart-bar" size={18} color="#FF6B9D" />
              <Text style={styles.insightsTitle}>Month Overview</Text>
            </View>

            {/* Available Days */}
            <View style={styles.insightRow}>
              <View style={styles.insightIconWrapper}>
                <View style={[styles.insightIcon, styles.insightIconAvailable]}>
                  <MaterialCommunityIcons name="calendar-check" size={18} color="#4CAF50" />
                </View>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Available Days</Text>
                <Text style={styles.insightValue}>{stats.availableCount - stats.fullyBookedCount} days</Text>
              </View>
            </View>

            <View style={styles.insightDivider} />

            {/* Booked Days */}
            <View style={styles.insightRow}>
              <View style={styles.insightIconWrapper}>
                <View style={[styles.insightIcon, styles.insightIconBooked]}>
                  <MaterialCommunityIcons name="calendar-remove" size={18} color="#FF6B6B" />
                </View>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Booked Days</Text>
                <Text style={styles.insightValue}>{stats.fullyBookedCount + stats.bookedCount} days</Text>
              </View>
            </View>

            <View style={styles.insightDivider} />

            {/* Total Events */}
            <View style={styles.insightRow}>
              <View style={styles.insightIconWrapper}>
                <View style={[styles.insightIcon, styles.insightIconEvents]}>
                  <MaterialCommunityIcons name="calendar-star" size={18} color="#FF9800" />
                </View>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Total Events</Text>
                <Text style={styles.insightValue}>{stats.eventCount} events</Text>
              </View>
            </View>

            <View style={styles.insightDivider} />

            {/* Fully Booked */}
            <View style={styles.insightRow}>
              <View style={styles.insightIconWrapper}>
                <View style={[styles.insightIcon, styles.insightIconFull]}>
                  <MaterialCommunityIcons name="lock" size={18} color="#C62828" />
                </View>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Fully Booked</Text>
                <Text style={[styles.insightValue, { color: '#C62828' }]}>{stats.fullyBookedCount} days</Text>
              </View>
            </View>
          </Animated.View>

          {/* Calendar Grid */}
          <Animated.View 
            style={[
              styles.calendarCard,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <View style={styles.weekRow}>
              {weekDays.map((day, index) => (
                <Text
                  key={day}
                  style={[
                    styles.weekdayText,
                    (index === 0 || index === 6) && styles.weekendText
                  ]}
                >
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((item) => {
                if (item.type === 'empty') {
                  return <View key={item.key} style={styles.calendarDay} />;
                }
                
                let dayStyle = [styles.calendarDay];
                let textStyle = [styles.dayText];
                let statusIndicator = null;
                
                if (item.today) {
                  dayStyle.push(styles.todayDay);
                  textStyle.push(styles.todayText);
                }
                
                if (item.selected) {
                  dayStyle.push(styles.selectedDay);
                  textStyle.push(styles.selectedText);
                }
                
                if (item.fullyBooked && !item.selected) {
                  dayStyle.push(styles.fullyBookedDay);
                  textStyle.push(styles.fullyBookedText);
                } else if (item.unavailable && !item.selected) {
                  dayStyle.push(styles.unavailableDay);
                  textStyle.push(styles.unavailableText);
                } else if (item.booked && !item.selected && !item.today) {
                  dayStyle.push(styles.bookedDay);
                  textStyle.push(styles.bookedText);
                } else if (item.limitedSlots && !item.selected && !item.today) {
                  dayStyle.push(styles.limitedSlotsDay);
                }

                if (item.fullyBooked) {
                  statusIndicator = (
                    <View style={styles.statusIndicatorFull}>
                      <MaterialCommunityIcons name="lock" size={8} color="#FFF" />
                    </View>
                  );
                } else if (item.unavailable) {
                  statusIndicator = (
                    <View style={styles.statusIndicatorUnavailable}>
                      <MaterialCommunityIcons name="close" size={8} color="#FFF" />
                    </View>
                  );
                } else if (item.limitedSlots) {
                  statusIndicator = (
                    <View style={styles.statusIndicatorLimited}>
                      <Text style={styles.statusIndicatorText}>L</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={dayStyle}
                    onPress={() => handleDateSelect(item.year, item.month, item.day)}
                    activeOpacity={0.7}
                    disabled={item.unavailable}
                  >
                    <Text style={textStyle}>
                      {item.day}
                    </Text>
                    {statusIndicator}
                    {item.hasEvent && !item.fullyBooked && !item.unavailable && !item.today && (
                      <View style={styles.eventDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotAvailable]} />
                <Text style={styles.legendText}>Free</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotBooked]} />
                <Text style={styles.legendText}>Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotFull]} />
                <Text style={styles.legendText}>Full</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotUnavailable]} />
                <Text style={styles.legendText}>Closed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotLimited]} />
                <Text style={styles.legendText}>Limited</Text>
              </View>
            </View>
          </Animated.View>

          {/* Events for Selected Date */}
          {renderEventsForSelectedDate()}

          {/* Quick Actions */}
          <Animated.View 
            style={[
              styles.quickActions,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.quickActionButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('BookingTab')}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons name="calendar-plus" size={20} color="#FFF" />
                <Text style={styles.quickActionText}>New Booking</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              activeOpacity={0.7}
              onPress={onRefresh}
            >
              <LinearGradient
                colors={['#6C63FF', '#7B73FF']}
                style={styles.quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#FFF" />
                <Text style={styles.quickActionText}>Refresh</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradient: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  yearBadge: {
    backgroundColor: '#F0F0F5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  yearBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  todayGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navigationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearContainer: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  yearText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
    fontWeight: '500',
  },
  
  // ===== INSIGHTS - VERTICAL FORM STYLE =====
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  insightIconWrapper: {
    width: 40,
    alignItems: 'center',
  },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightIconAvailable: {
    backgroundColor: '#E8F5E9',
  },
  insightIconBooked: {
    backgroundColor: '#FFEBEE',
  },
  insightIconEvents: {
    backgroundColor: '#FFF3E0',
  },
  insightIconFull: {
    backgroundColor: '#FFEBEE',
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  insightValue: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  insightDivider: {
    height: 1,
    backgroundColor: '#F0F0F5',
  },

  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  weekendText: {
    color: '#FF6B9D',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    position: 'relative',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  todayDay: {
    backgroundColor: '#FF6B9D',
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedDay: {
    backgroundColor: '#FFF0F5',
    borderWidth: 2,
    borderColor: '#FF6B9D',
  },
  selectedText: {
    color: '#FF6B9D',
    fontWeight: '700',
  },
  bookedDay: {
    backgroundColor: '#FFF3E0',
  },
  bookedText: {
    color: '#E65100',
    fontWeight: '600',
  },
  fullyBookedDay: {
    backgroundColor: '#FFEBEE',
  },
  fullyBookedText: {
    color: '#C62828',
    fontWeight: '600',
  },
  unavailableDay: {
    backgroundColor: '#F5F5F5',
  },
  unavailableText: {
    color: '#9E9E9E',
  },
  limitedSlotsDay: {
    backgroundColor: '#E8F5E9',
  },
  statusIndicatorFull: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#C62828',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicatorUnavailable: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#9E9E9E',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicatorLimited: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicatorText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FF6B9D',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  legendDotAvailable: {
    backgroundColor: '#FFFFFF',
    borderColor: '#4CAF50',
  },
  legendDotBooked: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  legendDotFull: {
    backgroundColor: '#FFEBEE',
    borderColor: '#C62828',
  },
  legendDotUnavailable: {
    backgroundColor: '#F5F5F5',
    borderColor: '#9E9E9E',
  },
  legendDotLimited: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  legendText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
  eventsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  eventsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  eventsCountBadge: {
    backgroundColor: '#F0F0F5',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  eventsCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusMessageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noEventsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 12,
  },
  noEventsSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  eventItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  eventMetaText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  eventStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: 20,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 20,
    marginBottom: 8,
  },
  guestText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  guestLoginButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '100%',
  },
  guestLoginGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  guestLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default CalendarScreen;

//Update 08/30/26