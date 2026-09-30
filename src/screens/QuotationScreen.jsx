import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const QuotationScreen = ({ navigation }) => {
  const quotations = [
    { id: 1, eventType: 'Wedding Reception', date: 'Dec 31, 2024', pax: 150, status: 'pending', breakdown: { food: 45000, labor: 15000, delivery: 5000, equipment: 8000 } },
  ];

  const calculateTotal = (b) => Object.values(b).reduce((a, b) => a + b, 0);

  const handleShare = async (q) => {
    const total = calculateTotal(q.breakdown);
    await Share.share({ message: `Dear Bab's Quotation\nEvent: ${q.eventType}\nTotal: ₱${total.toLocaleString()}` });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5']} style={styles.gradient}>
        <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color="#ff6b9d" /></TouchableOpacity><Text style={styles.headerTitle}>Quotations</Text><View style={{ width: 40 }} /></View>
        <ScrollView>
          {quotations.map(q => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.eventType}>{q.eventType}</Text>
              <Text style={styles.date}>{q.date} • {q.pax} pax</Text>
              <View style={styles.breakdown}><Text>Food: ₱{q.breakdown.food.toLocaleString()}</Text><Text>Labor: ₱{q.breakdown.labor.toLocaleString()}</Text><Text>Delivery: ₱{q.breakdown.delivery.toLocaleString()}</Text><Text>Equipment: ₱{q.breakdown.equipment.toLocaleString()}</Text></View>
              <Text style={styles.total}>Total: ₱{calculateTotal(q.breakdown).toLocaleString()}</Text>
              <View style={styles.actions}><TouchableOpacity onPress={() => handleShare(q)}><Text style={styles.share}>Share</Text></TouchableOpacity><TouchableOpacity><Text style={styles.approve}>Approve</Text></TouchableOpacity></View>
            </View>
          ))}
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
  card: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20 },
  eventType: { fontSize: 18, fontWeight: '700', color: '#2d2d2d' },
  date: { fontSize: 12, color: '#8a8a8e', marginBottom: 12 },
  breakdown: { gap: 4, marginBottom: 12 },
  total: { fontSize: 16, fontWeight: '700', color: '#ff6b9d', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 16 },
  share: { color: '#ff6b9d', fontWeight: '600' },
  approve: { color: '#4caf50', fontWeight: '600' },
});

export default QuotationScreen;