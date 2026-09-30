import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

const CateringOrderScreen = ({ navigation, route }) => {
  const cartItemsFromHome = route.params?.cartItems || [];
  
  const [step, setStep] = useState(1);
  const [eventDetails, setEventDetails] = useState({
    eventType: '',
    pax: '',
    location: '',
    date: new Date(),
  });
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedItems, setSelectedItems] = useState(cartItemsFromHome.map(item => ({ ...item, quantity: item.quantity || 1 })));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);

  const eventTypes = ['Wedding', 'Birthday', 'Corporate', 'Seminar', 'Anniversary', 'Fiesta', 'Funeral', 'Other'];

  const packages = [
    { id: 1, name: 'Silver Package', price: 450, description: '1 Main + 1 Side + Rice + Drinks', popular: false },
    { id: 2, name: 'Gold Package', price: 750, description: '2 Mains + 2 Sides + Dessert + Premium Drinks', popular: true },
    { id: 3, name: 'Platinum Package', price: 1200, description: '3 Mains + 3 Sides + 2 Desserts + Open Bar', popular: false },
  ];

  const menuCategories = [
    { id: 'appetizers', name: 'Appetizers', icon: 'food-variant' },
    { id: 'meat', name: 'Meat Dishes', icon: 'food-steak' },
    { id: 'chicken', name: 'Chicken', icon: 'food-drumstick' },
    { id: 'seafood', name: 'Seafood', icon: 'fish' },
    { id: 'vegetarian', name: 'Vegetarian', icon: 'leaf' },
    { id: 'rice', name: 'Rice', icon: 'rice' },
    { id: 'desserts', name: 'Desserts', icon: 'cake' },
    { id: 'beverages', name: 'Beverages', icon: 'cup' },
  ];

  const menuItems = {
    appetizers: [{ id: 1, name: 'Spring Rolls', price: 250, description: 'Crispy vegetable spring rolls', dietary: 'Veg' }],
    meat: [{ id: 2, name: 'Beef Caldereta', price: 320, description: 'Tender beef in tomato sauce', dietary: 'Non-Veg' }],
    chicken: [{ id: 3, name: 'Chicken Curry', price: 280, description: 'Creamy coconut curry', dietary: 'Non-Veg' }],
    seafood: [{ id: 4, name: 'Grilled Salmon', price: 580, description: 'Fresh salmon with lemon butter', dietary: 'Non-Veg' }],
    vegetarian: [{ id: 5, name: 'Vegetable Curry', price: 220, description: 'Mixed vegetables in coconut curry', dietary: 'Veg' }],
    rice: [{ id: 6, name: 'Garlic Rice', price: 60, description: 'Fried rice with garlic', dietary: 'Veg' }],
    desserts: [{ id: 7, name: 'Chocolate Cake', price: 180, description: 'Decadent chocolate cake', dietary: 'Veg' }],
    beverages: [{ id: 8, name: 'Iced Tea', price: 50, description: 'Fresh brewed', dietary: 'Veg' }],
  };

  const calculateTotal = () => {
    const pax = parseInt(eventDetails.pax) || 0;
    let total = 0;
    if (selectedPackage) total += selectedPackage.price * pax;
    selectedItems.forEach(item => total += item.price * item.quantity * pax);
    return total;
  };

  const handleNextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1 && (!eventDetails.eventType || !eventDetails.pax || parseInt(eventDetails.pax) < 10)) {
      Alert.alert('Required', 'Please fill all event details (minimum 10 pax)');
      return;
    }
    if (step === 2 && !selectedPackage && selectedItems.length === 0) {
      Alert.alert('Selection Required', 'Please select a package or add menu items');
      return;
    }
    if (step < 3) setStep(step + 1);
    else Alert.alert('Booking Submitted', 'Your catering request has been sent', [{ text: 'OK', onPress: () => navigation.navigate('OrderTracking') }]);
  };

  const addMenuItem = (item) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
    setShowMenuModal(false);
  };

  const updateQuantity = (id, increment) => {
    setSelectedItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) {
        const newQuantity = item.quantity + increment;
        if (newQuantity <= 0) return prev.filter(i => i.id !== id);
        return prev.map(i => i.id === id ? { ...i, quantity: newQuantity } : i);
      }
      return prev;
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color="#ff6b9d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Catering Order</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepContainer}>
          <View style={styles.stepWrapper}>
            <View style={[styles.stepCircle, step >= 1 && styles.stepActive]}><Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text></View>
            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
            <View style={[styles.stepCircle, step >= 2 && styles.stepActive]}><Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text></View>
            <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
            <View style={[styles.stepCircle, step >= 3 && styles.stepActive]}><Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>3</Text></View>
          </View>
          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>Event</Text>
            <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>Menu</Text>
            <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>Summary</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Event Information</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Type *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {eventTypes.map((type) => (
                    <TouchableOpacity key={type} style={[styles.chip, eventDetails.eventType === type && styles.chipActive]} onPress={() => setEventDetails({ ...eventDetails, eventType: type })}>
                      <Text style={[styles.chipText, eventDetails.eventType === type && styles.chipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Number of Pax *</Text>
                <View style={styles.paxControl}>
                  <TouchableOpacity style={styles.paxButton} onPress={() => setEventDetails({ ...eventDetails, pax: Math.max(10, (parseInt(eventDetails.pax) || 10) - 10) })}><Feather name="minus" size={20} color="#ff6b9d" /></TouchableOpacity>
                  <TextInput style={styles.paxInput} keyboardType="numeric" value={eventDetails.pax.toString()} onChangeText={(text) => setEventDetails({ ...eventDetails, pax: text })} placeholder="Enter pax" placeholderTextColor="#c0c0c0" />
                  <TouchableOpacity style={styles.paxButton} onPress={() => setEventDetails({ ...eventDetails, pax: (parseInt(eventDetails.pax) || 0) + 10 })}><Feather name="plus" size={20} color="#ff6b9d" /></TouchableOpacity>
                </View>
                <Text style={styles.hint}>Minimum 10 pax required</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Date *</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Feather name="calendar" size={20} color="#ff6b9d" />
                  <Text style={styles.dateText}>{eventDetails.date.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.locationInput}>
                  <Feather name="map-pin" size={20} color="#ff6b9d" />
                  <TextInput style={styles.locationText} placeholder="Enter venue address" value={eventDetails.location} onChangeText={(text) => setEventDetails({ ...eventDetails, location: text })} />
                </View>
              </View>
            </View>
          )}

          {step === 2 && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Select Package</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packageScroll}>
                  {packages.map((pkg) => (
                    <TouchableOpacity key={pkg.id} style={[styles.packageCard, selectedPackage?.id === pkg.id && styles.packageCardActive]} onPress={() => setSelectedPackage(pkg)}>
                      {pkg.popular && <View style={styles.popularTag}><Text style={styles.popularTagText}>Popular</Text></View>}
                      <Text style={styles.packageName}>{pkg.name}</Text>
                      <Text style={styles.packagePrice}>₱{pkg.price}/pax</Text>
                      <Text style={styles.packageDesc}>{pkg.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Custom Menu</Text>
                  <TouchableOpacity style={styles.addMenuButton} onPress={() => setShowMenuModal(true)}>
                    <Feather name="plus" size={16} color="#fff" /><Text style={styles.addMenuButtonText}>Add Item</Text>
                  </TouchableOpacity>
                </View>
                {selectedItems.length > 0 ? selectedItems.map(item => (
                  <View key={item.id} style={styles.cartItem}>
                    <View><Text style={styles.cartItemName}>{item.name}</Text><Text style={styles.cartItemPrice}>₱{item.price} x {item.quantity}</Text></View>
                    <View style={styles.cartItemControls}>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, -1)}><Feather name="minus-circle" size={22} color="#ff6b9d" /></TouchableOpacity>
                      <Text style={styles.cartItemQty}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, 1)}><Feather name="plus-circle" size={22} color="#ff6b9d" /></TouchableOpacity>
                    </View>
                  </View>
                )) : (
                  <TouchableOpacity style={styles.emptyMenu} onPress={() => setShowMenuModal(true)}>
                    <Feather name="plus-circle" size={40} color="#ffb6d1" /><Text style={styles.emptyMenuText}>Add items to your menu</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Event Details</Text>
                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Event Type:</Text><Text style={styles.summaryValue}>{eventDetails.eventType || '—'}</Text></View>
                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Pax:</Text><Text style={styles.summaryValue}>{eventDetails.pax || '—'} persons</Text></View>
                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Date:</Text><Text style={styles.summaryValue}>{eventDetails.date.toLocaleDateString()}</Text></View>
                {eventDetails.location && <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Location:</Text><Text style={styles.summaryValue}>{eventDetails.location}</Text></View>}
              </View>
              {selectedPackage && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Selected Package</Text>
                  <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{selectedPackage.name}</Text><Text style={styles.summaryValue}>₱{selectedPackage.price} x {eventDetails.pax}</Text></View>
                  <Text style={styles.summaryTotal}>₱{(selectedPackage.price * (parseInt(eventDetails.pax) || 0)).toLocaleString()}</Text>
                </View>
              )}
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalAmount}>₱{calculateTotal().toLocaleString()}</Text>
                <Text style={styles.totalNote}>30% downpayment required</Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.bottomButtons}>
          {step > 1 && <TouchableOpacity style={styles.backStepButton} onPress={() => setStep(step - 1)}><Feather name="arrow-left" size={18} color="#ff6b9d" /><Text style={styles.backStepText}>Back</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.nextStepButton, step === 1 && styles.nextStepButtonFull]} onPress={handleNextStep}>
            <LinearGradient colors={['#ff6b9d', '#ff8fb1']} style={styles.nextStepGradient}>
              <Text style={styles.nextStepText}>{step === 3 ? 'Submit Order' : 'Next Step'}</Text><Feather name="arrow-right" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.priceBar}>
          <View><Text style={styles.priceLabel}>Total Amount</Text><Text style={styles.priceAmount}>₱{calculateTotal().toLocaleString()}</Text></View>
          <View style={styles.priceBadge}><Text style={styles.priceBadgeText}>30% DP</Text></View>
        </View>
      </LinearGradient>

      {showDatePicker && <DateTimePicker value={eventDetails.date} mode="date" display="default" onChange={(event, selectedDate) => { setShowDatePicker(false); if (selectedDate) setEventDetails({ ...eventDetails, date: selectedDate }); }} minimumDate={new Date()} />}
      
      <Modal animationType="slide" transparent visible={showMenuModal} onRequestClose={() => setShowMenuModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add Menu Items</Text><TouchableOpacity onPress={() => setShowMenuModal(false)}><Feather name="x" size={24} color="#ff6b9d" /></TouchableOpacity></View>
            <ScrollView style={styles.modalBody}>
              {menuCategories.map(category => (
                <View key={category.id} style={styles.modalCategory}>
                  <Text style={styles.modalCategoryTitle}><MaterialCommunityIcons name={category.icon} size={18} color="#ff6b9d" /> {category.name}</Text>
                  {menuItems[category.id]?.map(item => (
                    <TouchableOpacity key={item.id} style={styles.modalMenuItem} onPress={() => addMenuItem(item)}>
                      <View style={styles.modalMenuItemInfo}><Text style={styles.modalMenuItemName}>{item.name}</Text><Text style={styles.modalMenuItemDesc}>{item.description}</Text></View>
                      <Text style={styles.modalMenuItemPrice}>₱{item.price}</Text><Feather name="plus-circle" size={24} color="#ff6b9d" />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff0f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ff6b9d' },
  stepContainer: { paddingHorizontal: 40, marginBottom: 24 },
  stepWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: '#ff6b9d' },
  stepNumber: { fontSize: 14, fontWeight: '600', color: '#b0b0b0' },
  stepNumberActive: { color: '#fff' },
  stepLine: { width: 50, height: 2, backgroundColor: '#f0f0f0', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#ff6b9d' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 10 },
  stepLabel: { fontSize: 11, color: '#b0b0b0' },
  stepLabelActive: { color: '#ff6b9d', fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#ff6b9d', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#2d2d2d', marginBottom: 16 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#5a5a5e', marginBottom: 8 },
  chipScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8f8f8', marginRight: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#ff6b9d' },
  chipText: { fontSize: 13, color: '#6b6b6e' },
  chipTextActive: { color: '#fff' },
  paxControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  paxButton: { padding: 12, backgroundColor: '#fff0f5', borderRadius: 12, margin: 4 },
  paxInput: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: '#2d2d2d' },
  hint: { fontSize: 11, color: '#b0b0b0', marginTop: 6 },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', paddingHorizontal: 16, height: 50, gap: 12 },
  dateText: { flex: 1, fontSize: 14, color: '#2d2d2d' },
  locationInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', paddingHorizontal: 16, height: 50, gap: 12 },
  locationText: { flex: 1, fontSize: 14, color: '#2d2d2d' },
  packageScroll: { flexDirection: 'row' },
  packageCard: { width: 200, backgroundColor: '#f8f8f8', borderRadius: 16, padding: 16, marginRight: 12, borderWidth: 1, borderColor: '#f0f0f0', position: 'relative' },
  packageCardActive: { borderColor: '#ff6b9d', backgroundColor: '#fff8fa', borderWidth: 2 },
  popularTag: { position: 'absolute', top: -8, right: 12, backgroundColor: '#ff6b9d', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12 },
  popularTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  packageName: { fontSize: 16, fontWeight: '700', color: '#2d2d2d', marginBottom: 4 },
  packagePrice: { fontSize: 14, fontWeight: '700', color: '#ff6b9d', marginBottom: 8 },
  packageDesc: { fontSize: 11, color: '#8a8a8e' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addMenuButton: { flexDirection: 'row', backgroundColor: '#ff6b9d', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6, alignItems: 'center' },
  addMenuButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#2d2d2d' },
  cartItemPrice: { fontSize: 12, color: '#ff6b9d', marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartItemQty: { fontSize: 15, fontWeight: '600', color: '#2d2d2d', minWidth: 28, textAlign: 'center' },
  emptyMenu: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyMenuText: { fontSize: 13, color: '#b0b0b0', marginTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#8a8a8e' },
  summaryValue: { fontSize: 13, fontWeight: '500', color: '#2d2d2d' },
  summaryTotal: { fontSize: 16, fontWeight: '700', color: '#ff6b9d', textAlign: 'right', marginTop: 8 },
  totalCard: { backgroundColor: '#ff6b9d', borderRadius: 20, padding: 20, marginBottom: 20 },
  totalLabel: { fontSize: 13, color: '#fff', opacity: 0.9, marginBottom: 4 },
  totalAmount: { fontSize: 28, fontWeight: '800', color: '#fff' },
  totalNote: { fontSize: 11, color: '#fff', opacity: 0.8, marginTop: 6 },
  bottomButtons: { position: 'absolute', bottom: 70, left: 20, right: 20, flexDirection: 'row', gap: 12 },
  backStepButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 14, borderRadius: 28, borderWidth: 1, borderColor: '#ffd9e6', gap: 8 },
  backStepText: { fontSize: 14, fontWeight: '600', color: '#ff6b9d' },
  nextStepButton: { flex: 2, borderRadius: 28, overflow: 'hidden' },
  nextStepButtonFull: { flex: 1 },
  nextStepGradient: { flexDirection: 'row', paddingVertical: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextStepText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  priceBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0e0e8', shadowColor: '#ff6b9d', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
  priceLabel: { fontSize: 11, color: '#8a8a8e' },
  priceAmount: { fontSize: 20, fontWeight: '800', color: '#ff6b9d' },
  priceBadge: { backgroundColor: '#fff0f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  priceBadgeText: { fontSize: 11, fontWeight: '600', color: '#ff6b9d' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 28, width: width - 32, maxHeight: height * 0.85, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2d2d2d' },
  modalBody: { padding: 16, maxHeight: 500 },
  modalCategory: { marginBottom: 20 },
  modalCategoryTitle: { fontSize: 15, fontWeight: '700', color: '#ff6b9d', marginBottom: 10 },
  modalMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 10 },
  modalMenuItemInfo: { flex: 1 },
  modalMenuItemName: { fontSize: 14, fontWeight: '600', color: '#2d2d2d' },
  modalMenuItemDesc: { fontSize: 11, color: '#8a8a8e', marginTop: 2 },
  modalMenuItemPrice: { fontSize: 13, fontWeight: '700', color: '#ff6b9d' },
});

export default CateringOrderScreen;