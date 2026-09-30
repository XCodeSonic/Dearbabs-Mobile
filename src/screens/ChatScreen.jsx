// src/screens/ChatScreen.jsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { customerAPI } from '../services/api';

const getList = (payload) => {
  const data = payload?.data?.data || payload?.data || payload || [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

const getCustomerId = (user) => {
  const value = user?.customer_id || user?.customer?.customer_id || user?.id;
  const numberValue = parseInt(value, 10);
  return Number.isNaN(numberValue) ? value : numberValue;
};

const ChatScreen = ({ navigation }) => {
  const { user, isGuest } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  const customerId = getCustomerId(user);
  const currentUserId = user?.user_id || user?.id;

  const loadMessages = async () => {
    if (isGuest || !customerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await customerAPI.getMessages({ customer_id: customerId, per_page: 20, ensure_thread: 1 });
      const threads = getList(response);
      const thread = threads[0];
      const threadMessages = Array.isArray(thread?.messages) ? thread.messages : [];
      setMessages(threadMessages.map((message) => ({
        id: String(message.message_id || message.id || `${message.created_at}-${message.message}`),
        text: message.message,
        isUser: (message.sender_user_id || message.sender?.user_id) === currentUserId,
        time: message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        status: message.read_at ? 'read' : 'sent',
      })));
    } catch (error) {
      console.log('Chat load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 30000);
    return () => clearInterval(timer);
  }, [customerId, currentUserId, isGuest]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    if (isGuest || !customerId) {
      Alert.alert('Login Required', 'Please login to chat with support.');
      return;
    }

    const messageText = inputText.trim();
    const tempMessage = {
      id: `temp-${Date.now()}`,
      text: messageText,
      isUser: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
    };

    setInputText('');
    setMessages(prev => [...prev, tempMessage]);
    setSending(true);

    try {
      await customerAPI.sendMessage({ customer_id: customerId, message: messageText });
      await loadMessages();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send message.');
      setMessages(prev => prev.filter(message => message.id !== tempMessage.id));
    } finally {
      setSending(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const ChatBubble = ({ item }) => (
    <View style={[styles.messageRow, item.isUser ? styles.userRow : styles.adminRow]}>
      {!item.isUser && (
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="headset" size={16} color="#FF6B9D" />
          </View>
        </View>
      )}
      <View style={[styles.bubble, item.isUser ? styles.userBubble : styles.adminBubble]}>
        <Text style={[styles.messageText, item.isUser ? styles.userText : styles.adminText]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.time}>{item.time}</Text>
          {item.isUser && item.status === 'read' && <MaterialCommunityIcons name="check-all" size={12} color="#4CAF50" />}
          {item.isUser && item.status !== 'read' && <MaterialCommunityIcons name="check" size={12} color="#B0B0B0" />}
        </View>
      </View>
      {item.isUser && (
        <View style={styles.userAvatarContainer}>
          <View style={styles.userAvatar}><MaterialCommunityIcons name="account" size={16} color="#FFF" /></View>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-left" size={24} color="#FF6B9D" /></TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}><MaterialCommunityIcons name="headset" size={20} color="#FF6B9D" /></View>
          <View>
            <Text style={styles.headerTitle}>Customer Support</Text>
            <View style={styles.onlineStatus}><View style={styles.onlineDot} /><Text style={styles.onlineText}>Admin online</Text></View>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={loadMessages}><Feather name="refresh-cw" size={20} color="#FF6B9D" /></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#FF6B9D" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => <ChatBubble item={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Send a message to start chatting with support.</Text>}
        />
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#C6C6C8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]} onPress={sendMessage} disabled={!inputText.trim() || sending}>
          <LinearGradient colors={inputText.trim() && !sending ? ['#FF6B9D', '#FF8FB1'] : ['#E5E5EA', '#E5E5EA']} style={styles.sendGradient}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color={inputText.trim() ? '#FFF' : '#C6C6C8'} />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F5', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0F5', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  onlineText: { fontSize: 12, color: '#4CAF50', fontWeight: '500' },
  menuButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F5', justifyContent: 'center', alignItems: 'center' },
  messagesList: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  emptyText: { textAlign: 'center', color: '#8A8A8E', marginTop: 40, lineHeight: 20 },
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  adminRow: { justifyContent: 'flex-start' },
  avatarContainer: { marginRight: 8 },
  userAvatarContainer: { marginLeft: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF0F5', justifyContent: 'center', alignItems: 'center' },
  userAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF6B9D', justifyContent: 'center', alignItems: 'center' },
  bubble: { maxWidth: '72%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: '#FF6B9D', borderBottomRightRadius: 6 },
  adminBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#EFEFF4' },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFFFFF' },
  adminText: { color: '#1C1C1E' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  time: { fontSize: 10, color: '#B0B0B0' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EFEFF4', gap: 10 },
  inputWrapper: { flex: 1, backgroundColor: '#F8F8F8', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  input: { fontSize: 15, color: '#1C1C1E', minHeight: 24, maxHeight: 100 },
  sendButton: { borderRadius: 22, overflow: 'hidden' },
  sendButtonDisabled: { opacity: 0.75 },
  sendGradient: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});

export default ChatScreen;
