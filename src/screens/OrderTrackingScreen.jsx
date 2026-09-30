// src/screens/OrderTrackingScreen.jsx - PROFESSIONAL UI
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

const OrderTrackingScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const activeOrders = [
    {
      id: 'ORD-2024-001',
      eventType: 'Wedding Reception',
      eventDate: 'Dec 31, 2024',
      pax: 150,
      total: 85000,
      status: 'preparing',
      statusColor: '#FF9800',
      progress: 45,
      timeline: [
        { id: 1, status: 'Booking Confirmed', date: 'Nov 15, 2024', completed: true, icon: 'check-circle', time: '10:30 AM' },
        { id: 2, status: 'Menu Finalized', date: 'Nov 20, 2024', completed: true, icon: 'check-circle', time: '2:15 PM' },
        { id: 3, status: 'Payment Received', date: 'Nov 25, 2024', completed: true, icon: 'check-circle', time: '9:00 AM' },
        { id: 4, status: 'Food Preparation', date: 'Dec 30, 2024', completed: false, icon: 'clock-outline', time: 'In Progress' },
        { id: 5, status: 'Delivery/Setup', date: 'Dec 31, 2024', completed: false, icon: 'truck-delivery', time: 'Scheduled' },
        { id: 6, status: 'Event Service', date: 'Dec 31, 2024', completed: false, icon: 'party-popper', time: 'Scheduled' },
        { id: 7, status: 'Completion', date: 'Dec 31, 2024', completed: false, icon: 'flag-checkered', time: 'Scheduled' },
      ],
      menuItems: ['Classic Adobo', 'Sinigang na Baboy', 'Lechon Kawali', 'Garlic Rice'],
      specialRequests: 'Vegetarian options for 10 guests',
    },
    {
      id: 'ORD-2024-002',
      eventType: 'Corporate Seminar',
      eventDate: 'Jan 15, 2025',
      pax: 80,
      total: 42000,
      status: 'confirmed',
      statusColor: '#4CAF50',
      progress: 15,
      timeline: [
        { id: 1, status: 'Booking Confirmed', date: 'Dec 10, 2024', completed: true, icon: 'check-circle', time: '11:00 AM' },
        { id: 2, status: 'Menu Finalized', date: 'Pending', completed: false, icon: 'clock-outline', time: 'Awaiting' },
        { id: 3, status: 'Payment Received', date: 'Dec 10, 2024', completed: true, icon: 'check-circle', time: '11:30 AM' },
        { id: 4, status: 'Food Preparation', date: 'Jan 15, 2025', completed: false, icon: 'clock-outline', time: 'Scheduled' },
        { id: 5, status: 'Delivery/Setup', date: 'Jan 15, 2025', completed: false, icon: 'truck-delivery', time: 'Scheduled' },
        { id: 6, status: 'Event Service', date: 'Jan 15, 2025', completed: false, icon: 'party-popper', time: 'Scheduled' },
        { id: 7, status: 'Completion', date: 'Jan 15, 2025', completed: false, icon: 'flag-checkered', time: 'Scheduled' },
      ],
      menuItems: ['Pancit Canton', 'Lumpiang Shanghai', 'Vegetable Curry', 'Iced Tea'],
      specialRequests: 'Halal food preparation required',
    },
  ];

  const pastOrders = [
    { 
      id: 'ORD-2024-000', 
      eventType: 'Birthday Party', 
      date: 'Nov 15, 2024', 
      pax: 50, 
      total: 27500, 
      status: 'Completed',
      rating: 5,
    },
    { 
      id: 'ORD-2024-00', 
      eventType: 'Anniversary Celebration', 
      date: 'Oct 20, 2024', 
      pax: 30, 
      total: 18500, 
      status: 'Completed',
      rating: 4,
    },
  ];

  const getStatusIcon = (status) => {
    switch(status) {
      case 'confirmed': return 'check-circle';
      case 'preparing': return 'clock-outline';
      case 'completed': return 'check-circle';
      default: return 'clock-outline';
    }
  };

  const getProgressColor = (progress) => {
    if (progress < 25) return '#FF9800';
    if (progress < 75) return '#2196F3';
    return '#4CAF50';
  };

  const OrderCard = ({ order, onPress }) => (
    <TouchableOpacity 
      style={styles.orderCard} 
      onPress={() => {
        setSelectedOrder(order);
        onPress();
      }}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#FFF', '#FFF8FA']}
        style={styles.orderCardGradient}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderId}>{order.id}</Text>
            <Text style={styles.orderType}>{order.eventType}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: order.statusColor + '15' }]}>
            <MaterialCommunityIcons name={getStatusIcon(order.status)} size={12} color={order.statusColor} />
            <Text style={[styles.statusText, { color: order.statusColor }]}>
              {order.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailItem}>
            <Feather name="calendar" size={14} color="#8A8A8E" />
            <Text style={styles.detailText}>{order.eventDate}</Text>
          </View>
          <View style={styles.detailItem}>
            <Feather name="users" size={14} color="#8A8A8E" />
            <Text style={styles.detailText}>{order.pax} guests</Text>
          </View>
          <View style={styles.detailItem}>
            <Feather name="dollar-sign" size={14} color="#8A8A8E" />
            <Text style={styles.detailText}>₱{order.total.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Event Progress</Text>
            <Text style={styles.progressPercent}>{order.progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${order.progress}%`, backgroundColor: getProgressColor(order.progress) }]} />
          </View>
        </View>

        <View style={styles.orderFooter}>
          <TouchableOpacity style={styles.trackButton}>
            <MaterialCommunityIcons name="map-marker-path" size={16} color="#FF6B9D" />
            <Text style={styles.trackButtonText}>Track Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactButton}>
            <Feather name="message-circle" size={16} color="#FF6B9D" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const TimelineView = ({ timeline }) => (
    <View style={styles.timelineCard}>
      <Text style={styles.sectionTitle}>Event Timeline</Text>
      {timeline.map((item, index) => (
        <View key={item.id} style={styles.timelineItem}>
          <View style={styles.timelineIconContainer}>
            <View style={[
              styles.timelineIcon,
              item.completed && styles.timelineIconCompleted
            ]}>
              <MaterialCommunityIcons 
                name={item.icon} 
                size={18} 
                color={item.completed ? '#FFF' : '#B0B0B0'} 
              />
            </View>
            {index < timeline.length - 1 && (
              <View style={[
                styles.timelineLine,
                item.completed && styles.timelineLineCompleted
              ]} />
            )}
          </View>
          
          <View style={styles.timelineContent}>
            <View style={styles.timelineHeader}>
              <Text style={[
                styles.timelineStatus,
                item.completed && styles.timelineStatusCompleted
              ]}>
                {item.status}
              </Text>
              <Text style={styles.timelineTime}>{item.time}</Text>
            </View>
            <Text style={styles.timelineDate}>{item.date}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const OrderDetailView = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backToOrdersButton}
        onPress={() => setSelectedOrder(null)}
      >
        <Feather name="arrow-left" size={20} color="#FF6B9D" />
        <Text style={styles.backToOrdersText}>Back to Orders</Text>
      </TouchableOpacity>

      {/* Order Summary Card */}
      <View style={styles.summaryCard}>
        <LinearGradient
          colors={['#FF6B9D', '#FF8FB1']}
          style={styles.summaryGradient}
        >
          <Text style={styles.summaryOrderId}>{selectedOrder.id}</Text>
          <Text style={styles.summaryEventType}>{selectedOrder.eventType}</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Feather name="calendar" size={16} color="#FFF" />
              <Text style={styles.summaryStatText}>{selectedOrder.eventDate}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Feather name="users" size={16} color="#FFF" />
              <Text style={styles.summaryStatText}>{selectedOrder.pax} guests</Text>
            </View>
            <View style={styles.summaryStat}>
              <Feather name="dollar-sign" size={16} color="#FFF" />
              <Text style={styles.summaryStatText}>₱{selectedOrder.total.toLocaleString()}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Timeline */}
      <TimelineView timeline={selectedOrder.timeline} />

      {/* Menu Items */}
      <View style={styles.menuCard}>
        <Text style={styles.sectionTitle}>Menu Selection</Text>
        {selectedOrder.menuItems.map((item, index) => (
          <View key={index} style={styles.menuItem}>
            <MaterialCommunityIcons name="food" size={16} color="#FF6B9D" />
            <Text style={styles.menuItemText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Special Requests */}
      {selectedOrder.specialRequests && (
        <View style={styles.specialRequestsCard}>
          <Text style={styles.sectionTitle}>Special Requests</Text>
          <Text style={styles.specialRequestsText}>{selectedOrder.specialRequests}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.chatButton}>
          <MaterialCommunityIcons name="chat-processing" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Chat with Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quotationButton}>
          <Feather name="file-text" size={20} color="#FF6B9D" />
          <Text style={styles.quotationButtonText}>Download Quotation</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const OrdersListView = () => (
    <>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.tabActive]} 
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active Orders ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.tabActive]} 
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past Orders ({pastOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Orders */}
      {activeTab === 'active' && (
        <View style={styles.ordersList}>
          {activeOrders.map(order => (
            <OrderCard key={order.id} order={order} onPress={() => {}} />
          ))}
        </View>
      )}

      {/* Past Orders */}
      {activeTab === 'past' && (
        <View style={styles.ordersList}>
          {pastOrders.map(order => (
            <View key={order.id} style={styles.pastOrderCard}>
              <View style={styles.pastOrderHeader}>
                <View>
                  <Text style={styles.pastOrderId}>{order.id}</Text>
                  <Text style={styles.pastOrderType}>{order.eventType}</Text>
                </View>
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={12} color="#4CAF50" />
                  <Text style={styles.completedText}>{order.status}</Text>
                </View>
              </View>
              
              <View style={styles.pastOrderDetails}>
                <View style={styles.detailItem}>
                  <Feather name="calendar" size={12} color="#8A8A8E" />
                  <Text style={styles.pastOrderDate}>{order.date}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Feather name="users" size={12} color="#8A8A8E" />
                  <Text style={styles.pastOrderDate}>{order.pax} guests</Text>
                </View>
                <View style={styles.detailItem}>
                  <Feather name="dollar-sign" size={12} color="#8A8A8E" />
                  <Text style={styles.pastOrderTotal}>₱{order.total.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Feather 
                    key={star}
                    name={star <= order.rating ? 'star' : 'star'} 
                    size={16} 
                    color={star <= order.rating ? '#FFB800' : '#E0E0E0'} 
                  />
                ))}
                <TouchableOpacity style={styles.reorderButton}>
                  <Text style={styles.reorderButtonText}>Reorder</Text>
                  <Feather name="refresh-cw" size={14} color="#FF6B9D" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#FFFFFF', '#FFF8FA', '#FFF0F5']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FF6B9D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <TouchableOpacity style={styles.filterButton}>
            <Feather name="filter" size={20} color="#FF6B9D" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {selectedOrder ? <OrderDetailView /> : <OrdersListView />}
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B9D',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FF6B9D',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8E',
  },
  tabTextActive: {
    color: '#FFF',
  },
  ordersList: {
    gap: 16,
  },
  orderCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  orderCardGradient: {
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B9D',
  },
  orderType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2D',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B6B6E',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#8A8A8E',
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  orderFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F5',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  trackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F5',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  backToOrdersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backToOrdersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  summaryCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
  },
  summaryGradient: {
    padding: 20,
  },
  summaryOrderId: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  summaryEventType: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 20,
  },
  summaryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryStatText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
  },
  timelineCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineIconCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineLine: {
    position: 'absolute',
    top: 36,
    bottom: -20,
    width: 2,
    backgroundColor: '#E0E0E0',
  },
  timelineLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
  },
  timelineStatusCompleted: {
    color: '#4CAF50',
  },
  timelineTime: {
    fontSize: 11,
    color: '#B0B0B0',
  },
  timelineDate: {
    fontSize: 12,
    color: '#8A8A8E',
  },
  menuCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    fontSize: 13,
    color: '#2D2D2D',
  },
  specialRequestsCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  specialRequestsText: {
    fontSize: 13,
    color: '#6B6B6E',
    lineHeight: 18,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 20,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B9D',
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  quotationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F5',
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  quotationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  pastOrderCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pastOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pastOrderId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  pastOrderType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2D',
    marginTop: 2,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  completedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
  },
  pastOrderDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  pastOrderDate: {
    fontSize: 11,
    color: '#8A8A8E',
  },
  pastOrderTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B9D',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 6,
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reorderButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B9D',
  },
});

export default OrderTrackingScreen;