// src/components/DynamicHeader.jsx
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';

const DynamicHeader = ({ 
  navigation, 
  title, 
  showBackButton = false,
  onMenuPress,
  onCartPress,
  onNotificationPress,
  showLogo = true 
}) => {
  const { colors } = useTheme();
  const { getCartCount } = useCart();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  
  const cartCount = getCartCount();

  return (
    <LinearGradient colors={[colors.primary + '10', 'transparent']} style={styles.headerGradient}>
      <View style={styles.header}>
        {/* Left Section - Menu or Back Button */}
        <TouchableOpacity 
          onPress={showBackButton ? () => navigation.goBack() : onMenuPress} 
          style={[styles.menuButton, { backgroundColor: colors.card }]}
        >
          <Feather name={showBackButton ? "arrow-left" : "menu"} size={22} color={colors.primary} />
        </TouchableOpacity>
        
        {/* Center Section - Logo or Title */}
        {showLogo ? (
          <View style={styles.logoContainer}>
            <Image source={require('../images/index-logo.png')} style={styles.headerLogo} resizeMode="contain" />
            <View>
              <Text style={[styles.companyName, { color: colors.text }]}>Dear Bab's</Text>
              <Text style={[styles.companyTagline, { color: colors.textSecondary }]}>Fastfood & Catering Services</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        )}
        
        {/* Right Section - Notifications & Cart */}
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: colors.card }]} 
            onPress={onNotificationPress}
          >
            <Feather name="bell" size={20} color={colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: colors.card }]} 
            onPress={onCartPress}
          >
            <Feather name="shopping-cart" size={20} color={colors.primary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerGradient: { 
    paddingTop: Platform.OS === 'ios' ? 55 : 45, 
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20 
  },
  menuButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2 
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    flex: 1, 
    justifyContent: 'center' 
  },
  headerLogo: { 
    width: 40, 
    height: 40, 
    borderRadius: 20 
  },
  companyName: { 
    fontSize: 16, 
    fontWeight: '700', 
    letterSpacing: -0.3 
  },
  companyTagline: { 
    fontSize: 9, 
    marginTop: 1 
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  iconButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2, 
    position: 'relative' 
  },
  cartBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#ff6b9d', 
    borderRadius: 9, 
    minWidth: 16, 
    height: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 3 
  },
  notificationBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#ff4444', 
    borderRadius: 9, 
    minWidth: 16, 
    height: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 3 
  },
  badgeText: { 
    color: '#fff', 
    fontSize: 9, 
    fontWeight: 'bold' 
  },
});

export default DynamicHeader;