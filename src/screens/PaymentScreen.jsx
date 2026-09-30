import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../contexts/CartContext';

const PaymentScreen = ({ navigation }) => {
  const { totalAmount, clearCart } = useCart();
  const [selectedMethod, setSelectedMethod] = useState('gcash');
  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: '',
  });

  const paymentMethods = [
    { id: 'gcash', name: 'GCash', icon: 'smartphone', color: '#007aff' },
    { id: 'maya', name: 'Maya', icon: 'smartphone', color: '#0055ff' },
    { id: 'bank', name: 'Bank Transfer', icon: 'building', color: '#34a853' },
    { id: 'card', name: 'Credit/Debit Card', icon: 'credit-card', color: '#ff6b9d' },
  ];

  const handlePayment = () => {
    if (selectedMethod === 'card' && (!paymentDetails.cardNumber || !paymentDetails.expiryDate || !paymentDetails.cvv)) {
      Alert.alert('Error', 'Please fill in all card details');
      return;
    }
    
    Alert.alert(
      'Payment Successful',
      `Your payment of ₱${totalAmount.toLocaleString()} has been processed!`,
      [{ text: 'OK', onPress: () => { clearCart(); navigation.navigate('Home'); } }]
    );
  };

  const downpayment = totalAmount * 0.3;
  const remaining = totalAmount - downpayment;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#ff6b9d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>₱{totalAmount.toLocaleString()}</Text>
            <View style={styles.amountBreakdown}>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>30% Downpayment</Text><Text style={styles.breakdownValue}>₱{downpayment.toLocaleString()}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Remaining Balance</Text><Text style={styles.breakdownValue}>₱{remaining.toLocaleString()}</Text></View>
            </View>
          </View>

          <View style={styles.methodsCard}>
            <Text style={styles.cardTitle}>Select Payment Method</Text>
            {paymentMethods.map(method => (
              <TouchableOpacity key={method.id} style={[styles.methodItem, selectedMethod === method.id && styles.methodItemSelected]} onPress={() => setSelectedMethod(method.id)}>
                <View style={[styles.methodIcon, { backgroundColor: method.color + '15' }]}><Feather name={method.icon} size={22} color={method.color} /></View>
                <Text style={styles.methodName}>{method.name}</Text>
                <View style={[styles.radioCircle, selectedMethod === method.id && styles.radioSelected]} />
              </TouchableOpacity>
            ))}
          </View>

          {selectedMethod === 'card' && (
            <View style={styles.cardDetailsCard}>
              <Text style={styles.cardTitle}>Card Details</Text>
              <TextInput style={styles.input} placeholder="Cardholder Name" value={paymentDetails.cardName} onChangeText={(text) => setPaymentDetails({ ...paymentDetails, cardName: text })} />
              <TextInput style={styles.input} placeholder="Card Number" keyboardType="numeric" maxLength={16} value={paymentDetails.cardNumber} onChangeText={(text) => setPaymentDetails({ ...paymentDetails, cardNumber: text })} />
              <View style={styles.row}><TextInput style={[styles.input, styles.halfInput]} placeholder="MM/YY" value={paymentDetails.expiryDate} onChangeText={(text) => setPaymentDetails({ ...paymentDetails, expiryDate: text })} /><TextInput style={[styles.input, styles.halfInput]} placeholder="CVV" keyboardType="numeric" maxLength={3} secureTextEntry value={paymentDetails.cvv} onChangeText={(text) => setPaymentDetails({ ...paymentDetails, cvv: text })} /></View>
            </View>
          )}

          {selectedMethod === 'gcash' && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>GCash Payment</Text>
              <Text style={styles.infoText}>Send payment to:</Text>
              <Text style={styles.infoNumber}>09123456789</Text>
              <Text style={styles.infoName}>Dear Bab's Catering</Text>
              <TouchableOpacity style={styles.uploadButton}><Feather name="upload" size={18} color="#ff6b9d" /><Text style={styles.uploadText}>Upload Proof of Payment</Text></TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.payButton} onPress={handlePayment}>
            <LinearGradient colors={['#ff6b9d', '#ff8fb1']} style={styles.payGradient}>
              <Text style={styles.payButtonText}>Pay ₱{downpayment.toLocaleString()} (30% DP)</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff0f5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ff6b9d' },
  amountCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 16, alignItems: 'center' },
  amountLabel: { fontSize: 13, color: '#8a8a8e', marginBottom: 8 },
  amountValue: { fontSize: 34, fontWeight: '800', color: '#ff6b9d', marginBottom: 16 },
  amountBreakdown: { width: '100%', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { fontSize: 13, color: '#8a8a8e' },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#2d2d2d' },
  methodsCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2d2d2d', marginBottom: 16 },
  methodItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  methodItemSelected: { backgroundColor: '#fff8fa', marginHorizontal: -20, paddingHorizontal: 20 },
  methodIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  methodName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#2d2d2d' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#b0b0b0' },
  radioSelected: { borderColor: '#ff6b9d', backgroundColor: '#ff6b9d' },
  cardDetailsCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 16 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  infoCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 16, alignItems: 'center' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#2d2d2d', marginBottom: 12 },
  infoText: { fontSize: 13, color: '#8a8a8e', marginBottom: 8 },
  infoNumber: { fontSize: 20, fontWeight: '700', color: '#ff6b9d', marginBottom: 4 },
  infoName: { fontSize: 12, color: '#8a8a8e', marginBottom: 16 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#fff0f5', borderRadius: 20 },
  uploadText: { fontSize: 13, color: '#ff6b9d', fontWeight: '500' },
  payButton: { marginHorizontal: 20, marginBottom: 30, borderRadius: 30, overflow: 'hidden' },
  payGradient: { paddingVertical: 16, alignItems: 'center' },
  payButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default PaymentScreen;