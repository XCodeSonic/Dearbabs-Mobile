import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  RefreshControl,
  SafeAreaView,
  Switch,
  AppState, // ⭐ #2 — Added for session verification on resume
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../utils/toast';
import { Ionicons, FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getBaseUrl } from '../services/api';

const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window');

// ==================== THEME CONTEXT ====================
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem('themePreference');
      if (saved !== null) {
        setIsDarkMode(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      await AsyncStorage.setItem('themePreference', JSON.stringify(newMode));
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// ==================== THEME STYLES ====================
const getThemeStyles = (isDark) => ({
  background: isDark ? '#121212' : '#F8FAFC',
  card: isDark ? '#1E1E1E' : '#FFFFFF',
  cardBorder: isDark ? '#333333' : '#E5E7EB',
  text: isDark ? '#FFFFFF' : '#1F2937',
  textSecondary: isDark ? '#9CA3AF' : '#6B7280',
  textMuted: isDark ? '#6B7280' : '#9CA3AF',
  input: isDark ? '#2D2D2D' : '#F9FAFB',
  inputBorder: isDark ? '#444444' : '#E5E7EB',
  shadow: isDark ? 'transparent' : '#000',
  headerBg: isDark ? '#1E1E1E' : '#FFFFFF',
  statusBar: isDark ? 'light-content' : 'dark-content',
  borderColor: isDark ? '#333333' : '#E5E7EB',
  divider: isDark ? '#2D2D2D' : '#F3F4F6',
  badgeBg: isDark ? '#2D2D2D' : '#F3F4F6',
  chipBg: isDark ? '#2D2D2D' : '#F3F4F6',
  scheduleCard: isDark ? '#1E1E1E' : '#FFFFFF',
  scheduleCardWarning: isDark ? '#2D2D2D' : '#FFFBEB',
});

// ==================== API CONFIGURATION ====================
const API_BASE_URL = `${getBaseUrl().replace(/\/+$/, '')}/v1`;

const normalizeEmployee = (employee = {}) => {
  const firstName = employee.person?.first_name || employee.first_name || '';
  const lastName = employee.person?.last_name || employee.last_name || '';
  const fullName = employee.person?.full_name || employee.name || `${firstName} ${lastName}`.trim();

  return {
    ...employee,
    name: fullName || employee.employee_code || `Employee #${employee.employee_id}`,
    profile_photo_url: employee.profile_photo_url || employee.person?.profile_photo_url || employee.person?.profile_photo || null,
  };
};

// ==================== API SERVICE ====================
const api = {
  async request(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (requiresAuth) {
      const token = await AsyncStorage.getItem('authToken') || await AsyncStorage.getItem('@auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        throw { status: 401, message: 'No authentication token found' };
      }
    }

    const config = { method, headers };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const responseData = await response.json();

          if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('currentEmployee');
          await AsyncStorage.removeItem('recentEmployeeIds');
          Toast.show({ type: 'error', text1: 'Session Expired', text2: 'Please login again' });
          throw { status: 401, message: 'Unauthorized. Please login again.' };
        }

        // ⭐ #2 — When the server says the account is inactive (403),
        //    wipe local sessions so the app can't keep calling APIs.
        if (response.status === 403) {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('currentEmployee');
          throw {
            status: 403,
            message: responseData.message || 'Your account is inactive. Please contact an administrator.',
            data: responseData,
          };
        }

        throw { status: response.status, message: responseData.message || 'Request failed', data: responseData };
      }
      return responseData;
    } catch (error) {
      console.error('API Error:', endpoint, error);
      throw error;
    }
  },

  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  },

  async login(employeeId) {
    const response = await this.request('/attendance/login', 'POST', { employee_id: employeeId }, true);
    if (response.success) {
      const userData = response.data?.user || response.data?.employee || response.data;
      if (userData) {
        const employeeData = userData.employee_id ? userData : {
          ...userData,
          employee_id: userData.id || userData.user_id,
          employee_code: userData.username || userData.id,
        };
        response.data.employee = normalizeEmployee(employeeData);

        const mainToken = await AsyncStorage.getItem('@auth_token');
        if (mainToken) {
          await AsyncStorage.setItem('authToken', mainToken);
        }
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(response.data.employee));
      }
    }
    return response;
  },

  async clockIn(data) {
    const formattedData = { ...data, employee_id: data.employee_id != null ? String(data.employee_id) : data.employee_id };
    if (formattedData.selfie && !formattedData.selfie.includes('base64,')) {
      formattedData.selfie = `data:image/jpeg;base64,${formattedData.selfie}`;
    }
    return this.request('/attendance/time-in', 'POST', formattedData, true);
  },

  async clockOut(data) {
    const formattedData = { ...data, employee_id: data.employee_id != null ? String(data.employee_id) : data.employee_id };
    if (formattedData.selfie && !formattedData.selfie.includes('base64,')) {
      formattedData.selfie = `data:image/jpeg;base64,${formattedData.selfie}`;
    }
    return this.request('/attendance/time-out', 'POST', formattedData, true);
  },

  async getAttendanceHistory(employeeId, filters) {
    const queryParams = new URLSearchParams({
      employee_id: employeeId,
      ...filters
    }).toString();
    return this.request(`/attendance/history?${queryParams}`, 'GET', null, true);
  },

  async getAttendanceSummary(employeeId) {
    return this.request(`/attendance/summary?employee_id=${employeeId}`, 'GET', null, true);
  },

  async getTodayAttendance(employeeId) {
    return this.request(`/attendance/today?employee_id=${employeeId}`, 'GET', null, true);
  },

  async getAttendanceByDateRange(employeeId, startDate, endDate) {
    const queryParams = new URLSearchParams({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate
    }).toString();
    return this.request(`/attendance/range?${queryParams}`, 'GET', null, true);
  },

  async getEmployeeRequests(employeeId, status = null) {
    let url = `/employee-requests?employee_id=${employeeId}`;
    if (status) url += `&status=${status}`;
    return this.request(url, 'GET', null, true);
  },

  async createRequest(data) {
    return this.request('/employee-requests', 'POST', data, true);
  },

  async updateRequestStatus(requestId, status, adminNotes = null) {
    return this.request(`/employee-requests/${requestId}/status`, 'PUT', { status, admin_notes: adminNotes }, true);
  },

  async cancelRequest(requestId) {
    return this.request(`/employee-requests/${requestId}/cancel`, 'POST', null, true);
  },

  async getRequestStats(employeeId) {
    return this.request(`/employee-requests/stats/${employeeId}`, 'GET', null, true);
  },

  async getLeaveBalance(employeeId) {
    return this.request(`/employee-requests/leave-balance?employee_id=${employeeId}`, 'GET', null, true);
  },

  async updateEmployee(employeeId, data) {
    return this.request(`/employees/${employeeId}`, 'PUT', data, true);
  },

  // ⭐ NEW — Employees can update their OWN person fields without admin rights.
  //    Hits /auth/self-profile (added in AuthController).
  async updateSelfProfile(data) {
    return this.request('/auth/self-profile', 'PUT', data, true);
  },

  async updateProfilePhoto(data) {
    return this.request('/auth/profile-photo', 'POST', data, true);
  },

  async logout() {
    try {
      await this.request('/attendance/logout', 'POST', null, true);
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('currentEmployee');
      await AsyncStorage.removeItem('recentEmployeeIds');
    }
  }
};

// ==================== LOGIN SCREEN ====================
const LoginScreen = ({ navigation, onBackToMainApp, onAppLogout }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentIds, setRecentIds] = useState([]);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    loadRecentIds();
    checkServerConnection();
    checkAutoLogin();
  }, []);

  const checkAutoLogin = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const employee = await AsyncStorage.getItem('currentEmployee');
      if (token && employee) {
        const parsedEmployee = normalizeEmployee(JSON.parse(employee));
        navigation.replace('Dashboard', { employee: parsedEmployee });
      }
    } catch (error) {
      console.log('Auto-login error:', error);
    }
  };

  const checkServerConnection = async () => {
    try {
      const data = await api.checkHealth();
      setServerStatus(data.success ? 'online' : 'offline');
      if (data.success) {
        Toast.show({ type: 'success', text1: 'Connected', text2: `Server at ${API_BASE_URL}` });
      } else {
        setServerStatus('offline');
        Toast.show({ type: 'error', text1: 'Connection Error', text2: 'Server returned error' });
      }
    } catch (error) {
      setServerStatus('offline');
      Toast.show({ type: 'error', text1: 'Connection Error', text2: `Cannot connect to server` });
    }
  };

  const loadRecentIds = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentEmployeeIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        const validIds = Array.isArray(parsed)
          ? parsed.filter(id => id && typeof id === 'string' && id.trim().length > 0)
          : [];
        setRecentIds([...new Set(validIds)]);
      }
    } catch (error) {
      console.log('Error loading recent IDs:', error);
      setRecentIds([]);
    }
  };

  const saveRecentId = async (id) => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) return;

    try {
      const cleanId = id.trim().toUpperCase();
      let updated = [cleanId, ...recentIds.filter(i => i !== cleanId)];
      updated = updated.slice(0, 5);
      setRecentIds(updated);
      await AsyncStorage.setItem('recentEmployeeIds', JSON.stringify(updated));
    } catch (error) {
      console.log('Error saving recent ID:', error);
    }
  };

  const clearRecentIds = async () => {
    Alert.alert('Clear Recent IDs', 'Are you sure you want to clear all recent employee IDs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('recentEmployeeIds');
            setRecentIds([]);
            Toast.show({ type: 'success', text1: 'Cleared', text2: 'Recent IDs cleared' });
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to clear recent IDs' });
          }
        }
      }
    ]);
  };

  const goBackToMainApp = () => {
    if (onBackToMainApp) {
      onBackToMainApp();
      return;
    }
    const parentNavigation = navigation.getParent?.();
    if (parentNavigation?.canGoBack?.()) {
      parentNavigation.goBack();
      return;
    }
    parentNavigation?.navigate?.('Main');
  };

  const handleExitToMainApp = async () => {
    Alert.alert(
      'Logout & Exit',
      'This will log you out of Attendance Tracking and return to the customer app. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'authToken',
                'currentEmployee',
              ]);

              if (onBackToMainApp) {
                onBackToMainApp();
              } else if (onAppLogout) {
                await onAppLogout();
              } else {
                const parentNavigation = navigation.getParent?.();
                parentNavigation?.navigate?.('Main');
              }
            } catch (error) {
              console.log('Exit error:', error);
            }
          },
        },
      ]
    );
  };

  const handleProceed = async () => {
    const trimmedId = employeeId.trim().toUpperCase();
    if (!trimmedId) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter Employee ID' });
      return;
    }
    setLoading(true);
    try {
      const response = await api.login(trimmedId);
      if (response.success && response.data && response.data.employee) {
        await saveRecentId(trimmedId);
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(response.data.employee));
        navigation.replace('Dashboard', { employee: response.data.employee });
        Toast.show({ type: 'success', text1: 'Welcome!', text2: `Hello ${response.data.employee.name}` });
      } else {
        Toast.show({ type: 'error', text1: 'Login Failed', text2: response.message || 'Invalid Employee ID' });
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.status === 404) {
        Toast.show({ type: 'error', text1: 'Employee Not Found', text2: 'The employee ID you entered does not exist.' });
      } else if (error.status === 403) {
        // ⭐ #2 — Clear, actionable message when admin deactivates the employee
        Toast.show({
          type: 'error',
          text1: 'Account Inactive',
          text2: error.message || 'Your account has been disabled. Please contact an administrator.',
          visibilityTime: 6000,
        });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Network error. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4FF" />

      <View style={styles.serverStatus}>
        <View style={[styles.serverStatusDot, serverStatus === 'online' ? styles.serverOnline : styles.serverOffline]} />
        <Text style={styles.serverStatusText}>
          {serverStatus === 'online' ? 'Server Online' : serverStatus === 'offline' ? 'Server Offline' : 'Checking...'}
        </Text>
      </View>

      <View style={styles.loginCard}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <FontAwesome5 name="fingerprint" size={48} color="#2563EB" />
          </View>
          <Text style={styles.appTitle}>Attendance Tracker</Text>
          <Text style={styles.appSubtitle}>Dear Bab's Fastfood & Catering Services</Text>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="id-card-outline" size={22} color="#9CA3AF" />
          <TextInput
            style={styles.input}
            placeholder="Enter Employee ID"
            placeholderTextColor="#9CA3AF"
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          {employeeId.length > 0 && !loading && (
            <TouchableOpacity onPress={() => setEmployeeId('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {recentIds.length > 0 && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
              {recentIds.map((id, index) => (
                <TouchableOpacity key={index} style={styles.recentChip} onPress={() => setEmployeeId(id)} disabled={loading}>
                  <Text style={styles.recentChipText}>{id}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.clearChip} onPress={clearRecentIds} disabled={loading}>
                <Ionicons name="close-circle" size={14} color="#EF4444" />
                <Text style={styles.clearChipText}>Clear</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={[styles.loginButton, loading && styles.disabledButton]} onPress={handleProceed} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Proceed</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToMobileButton} onPress={goBackToMainApp} disabled={loading}>
          <Ionicons name="arrow-back-outline" size={18} color="#2563EB" />
          <Text style={styles.backToMobileText}>Back to Mobile App</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backToMobileButton, { marginTop: 4 }]}
          onPress={handleExitToMainApp}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={[styles.backToMobileText, { color: '#EF4444' }]}>
            Logout & Exit to Main App
          </Text>
        </TouchableOpacity>

        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>ℹ️ Use your employee code (e.g., EMP-001) or employee ID</Text>
        </View>
      </View>
    </View>
  );
};

// ==================== ADMIN MENU DRAWER ====================
const AdminMenuDrawer = ({ visible, onClose, employee, onNavigate, onLogout }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginAttempts, setLoginAttempts] = useState(5);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [lockoutDuration, setLockoutDuration] = useState(15);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadLoginHistory();
    }
  }, [visible]);

  const loadLoginHistory = async () => {
    setLoading(true);
    try {
      const mockHistory = [
        { id: 1, username: 'admin', role: 'Administrator', login_date: '2026-08-26', login_time: '10:30 AM', logout_time: '5:45 PM', duration: '7h 15m', status: 'Active' },
        { id: 2, username: 'admin', role: 'Administrator', login_date: '2026-08-25', login_time: '9:15 AM', logout_time: '6:00 PM', duration: '8h 45m', status: 'Completed' },
        { id: 3, username: 'admin', role: 'Administrator', login_date: '2026-08-24', login_time: '8:45 AM', logout_time: '5:30 PM', duration: '8h 45m', status: 'Completed' },
      ];
      setLoginHistory(mockHistory);
    } catch (error) {
      console.log('Error loading login history:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuSections = [
    { title: 'Account', items: [{ key: 'profile', label: 'Account Profile', icon: 'person-circle-outline' }, { key: 'history', label: 'Login History', icon: 'time-outline' }] },
    { title: 'Security Settings', items: [{ key: 'attempts', label: 'Login Attempt Settings', icon: 'shield-outline' }, { key: 'timeout', label: 'Session Timeout', icon: 'timer-outline' }, { key: 'lockout', label: 'Lockout Duration', icon: 'lock-closed-outline' }] },
    { title: 'Actions', items: [{ key: 'logout', label: 'Logout', icon: 'log-out-outline' }] }
  ];

  const [activeSection, setActiveSection] = useState('profile');

  const renderContent = () => {
    switch (activeSection) {
      case 'profile': return renderProfile();
      case 'history': return renderLoginHistory();
      case 'attempts': return renderSecuritySetting('Maximum Login Attempts', loginAttempts, setLoginAttempts, [3, 5, 10]);
      case 'timeout': return renderSecuritySetting('Session Timeout (Minutes)', sessionTimeout, setSessionTimeout, [15, 30, 60, 120, 240]);
      case 'lockout': return renderSecuritySetting('Lockout Duration (Minutes)', lockoutDuration, setLockoutDuration, [5, 10, 15, 30, 60]);
      default: return renderProfile();
    }
  };

  const renderProfile = () => (
    <View style={[styles.adminProfileContainer, { backgroundColor: theme.background }]}>
      <View style={[styles.adminProfileHeader, { backgroundColor: theme.card }]}>
        {employee?.profile_photo_url ? (
          <Image source={{ uri: employee.profile_photo_url }} style={styles.adminProfileAvatar} />
        ) : (
          <View style={[styles.adminProfileAvatarPlaceholder, { backgroundColor: '#EBF5FF' }]}>
            <Text style={styles.adminProfileAvatarInitial}>{employee?.name?.charAt(0) || 'A'}</Text>
          </View>
        )}
        <View style={styles.adminProfileInfo}>
          <Text style={[styles.adminProfileName, { color: theme.text }]}>{employee?.name || 'Administrator'}</Text>
          <Text style={[styles.adminProfileUsername, { color: theme.textSecondary }]}>@{employee?.username || 'admin'}</Text>
          <Text style={[styles.adminProfileRole, { color: '#2563EB' }]}>{employee?.role || 'Administrator'}</Text>
        </View>
      </View>
      <View style={[styles.adminProfileDetails, { backgroundColor: theme.card }]}>
        <View style={[styles.adminProfileDetail, { borderBottomColor: theme.divider }]}><Text style={[styles.adminProfileDetailLabel, { color: theme.textSecondary }]}>Email</Text><Text style={[styles.adminProfileDetailValue, { color: theme.text }]}>{employee?.email || 'admin@catering.com'}</Text></View>
        <View style={[styles.adminProfileDetail, { borderBottomColor: theme.divider }]}><Text style={[styles.adminProfileDetailLabel, { color: theme.textSecondary }]}>Account Status</Text><View style={styles.adminProfileStatus}><View style={styles.adminProfileStatusDot} /><Text style={[styles.adminProfileStatusText, { color: '#10B981' }]}>Active</Text></View></View>
        <View style={[styles.adminProfileDetail, { borderBottomColor: theme.divider }]}><Text style={[styles.adminProfileDetailLabel, { color: theme.textSecondary }]}>Last Login</Text><Text style={[styles.adminProfileDetailValue, { color: theme.text }]}>Today, 10:30 AM</Text></View>
      </View>
    </View>
  );

  const renderLoginHistory = () => (
    <View style={[styles.adminHistoryContainer, { backgroundColor: theme.background }]}>
      <Text style={[styles.adminHistoryTitle, { color: theme.text }]}>Login History</Text>
      <View style={styles.adminHistoryFilters}>
        <TouchableOpacity style={[styles.adminHistoryFilter, { backgroundColor: theme.chipBg }]}><Text style={[styles.adminHistoryFilterText, { color: theme.textSecondary }]}>All</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.adminHistoryFilter, styles.adminHistoryFilterActive]}><Text style={[styles.adminHistoryFilterText, styles.adminHistoryFilterTextActive]}>Active</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.adminHistoryFilter, { backgroundColor: theme.chipBg }]}><Text style={[styles.adminHistoryFilterText, { color: theme.textSecondary }]}>Completed</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.adminHistoryFilter, { backgroundColor: theme.chipBg }]}><Text style={[styles.adminHistoryFilterText, { color: theme.textSecondary }]}>Failed</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator size="small" color="#2563EB" /> : loginHistory.map((item) => (
        <View key={item.id} style={[styles.adminHistoryItem, { backgroundColor: theme.card }]}>
          <View style={styles.adminHistoryItemLeft}>
            <View style={[styles.adminHistoryAvatar, { backgroundColor: '#EBF5FF' }]}><Text style={styles.adminHistoryAvatarText}>{item.username.charAt(0).toUpperCase()}</Text></View>
            <View><Text style={[styles.adminHistoryName, { color: theme.text }]}>{item.username}</Text><Text style={[styles.adminHistoryRole, { color: theme.textSecondary }]}>{item.role}</Text></View>
          </View>
          <View style={styles.adminHistoryItemRight}>
            <Text style={[styles.adminHistoryDate, { color: theme.textSecondary }]}>{item.login_date}</Text>
            <Text style={[styles.adminHistoryTime, { color: theme.textMuted }]}>{item.login_time}</Text>
            <View style={[styles.adminHistoryStatus, { backgroundColor: item.status === 'Active' ? '#10B98120' : '#6B728020' }]}>
              <Text style={[styles.adminHistoryStatusText, { color: item.status === 'Active' ? '#10B981' : '#6B7280' }]}>{item.status}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderSecuritySetting = (title, value, onValueChange, options) => (
    <View style={[styles.adminSettingItem, { backgroundColor: theme.card }]}>
      <Text style={[styles.adminSettingLabel, { color: theme.text }]}>{title}</Text>
      <View style={styles.adminSettingOptions}>
        {options.map((opt) => (
          <TouchableOpacity key={opt} style={[styles.adminSettingOption, value === opt && styles.adminSettingOptionActive, { backgroundColor: value === opt ? '#EBF5FF' : theme.chipBg }]} onPress={() => onValueChange(opt)}>
            <Text style={[styles.adminSettingOptionText, value === opt && styles.adminSettingOptionTextActive, { color: value === opt ? '#2563EB' : theme.textSecondary }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={[styles.adminDrawerOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <TouchableOpacity style={styles.adminDrawerBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.adminDrawerContainer, { backgroundColor: theme.background }]}>
          <SafeAreaView style={styles.adminDrawerSafeArea}>
            <View style={[styles.adminDrawerHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.adminDrawerTitle, { color: theme.text }]}>Account Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.adminDrawerClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.adminDrawerBody}>
              <View style={[styles.adminDrawerMenu, { backgroundColor: theme.card, borderRightColor: theme.borderColor }]}>
                {menuSections.map((section, idx) => (
                  <View key={idx}>
                    <Text style={[styles.adminDrawerMenuSection, { color: theme.textMuted }]}>{section.title}</Text>
                    {section.items.map((item) => (
                      <TouchableOpacity key={item.key} style={[styles.adminDrawerMenuItem, activeSection === item.key && styles.adminDrawerMenuItemActive]} onPress={() => { if (item.key === 'logout') { onLogout(); } else { setActiveSection(item.key); } }}>
                        <Ionicons name={item.icon} size={20} color={activeSection === item.key ? '#2563EB' : theme.textSecondary} />
                        <Text style={[styles.adminDrawerMenuItemText, activeSection === item.key && styles.adminDrawerMenuItemTextActive, { color: activeSection === item.key ? '#2563EB' : theme.textSecondary }]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
              <View style={[styles.adminDrawerContent, { backgroundColor: theme.background }]}>{renderContent()}</View>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

// ==================== NAVIGATION DRAWER ====================
const NavigationDrawer = ({ visible, onClose, employee, currentScreen, onNavigate, onLogout }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);

  const menuItems = [
    { key: 'Home', label: 'Home', icon: 'home-outline' },
    { key: 'Attendance', label: 'Attendance', icon: 'time-outline' },
    { key: 'Request', label: 'Request', icon: 'document-text-outline' },
    { key: 'Schedule', label: 'Schedule', icon: 'calendar-outline' },
    { key: 'Profile', label: 'Profile', icon: 'person-outline' },
  ];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={[styles.drawerOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <TouchableOpacity style={styles.drawerOverlayTouch} onPress={onClose} activeOpacity={1} />
        <View style={[styles.drawerContainer, { backgroundColor: theme.card }]}>
          <SafeAreaView style={styles.drawerSafeArea}>
            <View style={[styles.drawerHeader, { backgroundColor: theme.card }]}>
              <View style={styles.drawerProfile}>
                {employee?.profile_photo_url ? (
                  <Image source={{ uri: employee.profile_photo_url }} style={styles.drawerAvatar} />
                ) : (
                  <View style={[styles.drawerAvatarPlaceholder, { backgroundColor: '#EBF5FF' }]}>
                    <Text style={styles.drawerAvatarInitial}>{employee?.name?.charAt(0) || 'E'}</Text>
                  </View>
                )}
                <View style={styles.drawerProfileInfo}>
                  <Text style={[styles.drawerName, { color: theme.text }]}>{employee?.name || 'Employee'}</Text>
                  <Text style={[styles.drawerId, { color: theme.textSecondary }]}>{employee?.employee_code || employee?.employee_id}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.drawerCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.drawerDivider, { backgroundColor: theme.borderColor }]} />
            <ScrollView style={styles.drawerMenu}>
              {menuItems.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.drawerMenuItem, currentScreen === item.key && styles.drawerMenuItemActive]} onPress={() => { onNavigate(item.key); onClose(); }}>
                  <Ionicons name={item.icon} size={22} color={currentScreen === item.key ? '#2563EB' : theme.textSecondary} />
                  <Text style={[styles.drawerMenuItemText, currentScreen === item.key && styles.drawerMenuItemTextActive, { color: currentScreen === item.key ? '#2563EB' : theme.textSecondary }]}>{item.label}</Text>
                  {currentScreen === item.key && <View style={styles.drawerMenuItemActiveIndicator} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={[styles.drawerFooter, { borderTopColor: theme.borderColor }]}>
              <TouchableOpacity style={styles.drawerLogoutBtn} onPress={onLogout}>
                <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                <Text style={styles.drawerLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

// ==================== BOTTOM NAVIGATION ====================
const BottomNavigation = ({ currentScreen, onNavigate }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);

  const tabs = [
    { key: 'Home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'Attendance', label: 'Attendance', icon: 'time-outline', activeIcon: 'time' },
    { key: 'Request', label: 'Request', icon: 'document-text-outline', activeIcon: 'document-text' },
    { key: 'Schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
    { key: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  return (
    <View style={[styles.bottomNav, { backgroundColor: theme.card, borderTopColor: theme.borderColor }]}>
      {tabs.map((tab) => {
        const isActive = currentScreen === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={styles.bottomNavItem} onPress={() => onNavigate(tab.key)} activeOpacity={0.7}>
            <View style={[styles.bottomNavIconWrapper, isActive && styles.bottomNavIconWrapperActive]}>
              <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={22} color={isActive ? '#fff' : theme.textMuted} />
            </View>
            <Text style={[styles.bottomNavLabel, isActive && styles.bottomNavLabelActive, { color: isActive ? '#2563EB' : theme.textMuted }]}>{tab.label}</Text>
            {isActive && <View style={styles.bottomNavActiveIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ==================== HOME SCREEN ====================
const HomeScreen = ({ employee, navigation, onLogout, pendingRequests }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [currentTime, setCurrentTime] = useState(moment());
  const [stats, setStats] = useState({ presentDays: 0, thisMonth: 0, thisWeek: 0 });
  const [todayStatus, setTodayStatus] = useState('not_started');
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [scheduleWarning, setScheduleWarning] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setCurrentTime(moment()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.getAttendanceSummary(employee.employee_id);
      if (response.success) {
        const todayStatusValue = response.data.today_status || response.data.status || 'not_started';
        setTodayStatus(todayStatusValue);
        setTodaySchedule(response.data.today_schedule);
        setStats({
          presentDays: response.data.current_month?.present_days || response.data.present_days || 0,
          thisMonth: response.data.current_month?.present_days || response.data.this_month || 0,
          thisWeek: response.data.last_30_days?.present_days || response.data.this_week || 0,
        });
        if (!response.data.today_schedule && todayStatusValue === 'not_started') {
          setScheduleWarning("You don't have a schedule for today. Please contact admin.");
        } else {
          setScheduleWarning(null);
        }
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = () => {
    switch (todayStatus) {
      case 'completed': return { text: 'Completed', color: '#10B981' };
      case 'checked-in':
      case 'timed_in': return { text: 'Checked In', color: '#F59E0B' };
      default: return { text: 'Not Started', color: '#EF4444' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const formatScheduleTime = (time24) => {
    if (!time24) return '--:-- --';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <View style={[styles.homeContainer, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.welcomeSection, { backgroundColor: theme.card }]}>
          <View style={styles.welcomeContent}>
            <Text style={[styles.welcomeGreeting, { color: theme.textSecondary }]}>Good {currentTime.format('A') === 'AM' ? 'Morning' : 'Afternoon'}! 👋</Text>
            <Text style={[styles.welcomeName, { color: theme.text }]}>{employee?.name || 'Employee'}</Text>
            <Text style={[styles.welcomeId, { color: theme.textMuted }]}>ID: {employee?.employee_code || employee?.employee_id}</Text>
          </View>
          <View style={styles.welcomeAvatar}>
            {employee?.profile_photo_url ? (
              <Image source={{ uri: employee.profile_photo_url }} style={styles.welcomeAvatarImage} />
            ) : (
              <View style={[styles.welcomeAvatarPlaceholder, { backgroundColor: '#EBF5FF' }]}>
                <Text style={styles.welcomeAvatarInitial}>{employee?.name?.charAt(0) || 'E'}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.dateTimeCard}>
          <Text style={styles.dayText}>{currentTime.format('dddd')}</Text>
          <Text style={styles.dateText}>{currentTime.format('MMMM D, YYYY')}</Text>
          <Text style={styles.timeText}>{currentTime.format('hh:mm:ss A')}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EBF5FF' }]}>
              <FontAwesome5 name="calendar-check" size={20} color="#2563EB" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.presentDays}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Days Present</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EBF5FF' }]}>
              <FontAwesome5 name="chart-line" size={20} color="#2563EB" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.thisMonth}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>This Month</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EBF5FF' }]}>
              <FontAwesome5 name="calendar-week" size={20} color="#2563EB" />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.thisWeek}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>This Week</Text>
          </View>
        </View>

        <View style={[styles.scheduleCard, scheduleWarning && styles.scheduleCardWarning, { backgroundColor: scheduleWarning ? theme.scheduleCardWarning : theme.scheduleCard, borderLeftColor: scheduleWarning ? "#F59E0B" : "#2563EB" }]}>
          <View style={styles.scheduleHeader}>
            <MaterialIcons name="schedule" size={20} color={scheduleWarning ? "#F59E0B" : "#2563EB"} />
            <Text style={[styles.scheduleHeaderText, scheduleWarning && styles.scheduleHeaderTextWarning, { color: scheduleWarning ? "#D97706" : theme.text }]}>Today's Schedule</Text>
          </View>
          {todaySchedule ? (
            <View style={styles.scheduleContent}>
              <View style={styles.scheduleTimeRow}>
                <View style={styles.scheduleTimeItem}>
                  <Text style={[styles.scheduleTimeLabel, { color: theme.textSecondary }]}>Time In</Text>
                  <Text style={[styles.scheduleTimeValue, { color: theme.text }]}>{formatScheduleTime(todaySchedule.start_time)}</Text>
                </View>
                <View style={styles.scheduleTimeItem}>
                  <Text style={[styles.scheduleTimeLabel, { color: theme.textSecondary }]}>Time Out</Text>
                  <Text style={[styles.scheduleTimeValue, { color: theme.text }]}>{formatScheduleTime(todaySchedule.end_time)}</Text>
                </View>
              </View>
              <View style={[styles.scheduleMeta, { borderTopColor: theme.divider }]}>
                <Text style={[styles.scheduleShiftType, { color: '#2563EB' }]}>{todaySchedule.shift_type === 'regular' ? 'Regular Shift' : 'On-Call'}</Text>
                {todaySchedule.placement && (
                  <Text style={[styles.schedulePlacement, { color: theme.textSecondary }]}><Ionicons name="location-outline" size={12} color={theme.textSecondary} /> {todaySchedule.placement}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.scheduleNoSchedule}>
              <MaterialIcons name="info-outline" size={24} color="#F59E0B" />
              <Text style={[styles.scheduleNoScheduleText, { color: '#F59E0B' }]}>No schedule assigned for today</Text>
              <Text style={[styles.scheduleNoScheduleSubtext, { color: theme.textMuted }]}>Please contact your admin</Text>
            </View>
          )}
        </View>

        <View style={[styles.statusCard, { backgroundColor: theme.card }]}>
          <View style={styles.statusCardRow}>
            <Text style={[styles.statusCardLabel, { color: theme.textSecondary }]}>Current Status</Text>
            <View style={[styles.statusCardBadge, { backgroundColor: statusDisplay.color + '15' }]}>
              <View style={[styles.statusCardDot, { backgroundColor: statusDisplay.color }]} />
              <Text style={[styles.statusCardText, { color: statusDisplay.color }]}>{statusDisplay.text}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ==================== ATTENDANCE SCREEN ====================
const AttendanceScreen = ({ employee, navigation }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [todayStatus, setTodayStatus] = useState('not_started');
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [attendanceType, setAttendanceType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(moment().month());
  const [selectedYear, setSelectedYear] = useState(moment().year());
  // ⭐ #NEW — historyStats now includes awol_count & ea_count
  const [historyStats, setHistoryStats] = useState({
    total_records: 0,
    time_ins: 0,
    time_outs: 0,
    awol_count: 0,
    ea_count: 0,
  });
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    loadTodayStatus();
    loadHistory();
  }, [selectedMonth, selectedYear]);

  const loadTodayStatus = async () => {
    setLoading(true);
    try {
      const response = await api.getAttendanceSummary(employee.employee_id);
      if (response.success) {
        const todayStatusValue = response.data.today_status || response.data.status || 'not_started';
        setTodayStatus(todayStatusValue);
        setTodaySchedule(response.data.today_schedule);
        if (!response.data.today_schedule && todayStatusValue === 'not_started') {
          setScheduleWarning("You don't have a schedule for today. Please contact admin.");
        } else {
          setScheduleWarning(null);
        }
      }
    } catch (error) {
      console.log('Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await api.getAttendanceHistory(employee.employee_id, {
        year: selectedYear,
        month: selectedMonth + 1,
        per_page: 100,
      });
      if (response.success) {
        const records = response.data?.data || response.data || [];

        // ⭐ #NEW — compute AWOL / EA counts client-side too
        const computedStats = {
          total_records: records.length,
          time_ins: records.filter((r) => r.type === 'IN').length,
          time_outs: records.filter((r) => r.type === 'OUT').length,
          awol_count: records.filter((r) => r.attendance_flag === 'awol').length,
          ea_count: records.filter((r) => r.attendance_flag === 'emergency_absent').length,
        };

        setHistory(records);
        // Merge: prefer backend numbers when provided, otherwise use client-computed.
        setHistoryStats({
          ...computedStats,
          ...(response.stats || {}),
          // Ensure flag counts are never undefined:
          awol_count: response.stats?.awol_count ?? computedStats.awol_count,
          ea_count: response.stats?.ea_count ?? computedStats.ea_count,
        });
      }
    } catch (error) {
      console.log('Error loading history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusDisplay = () => {
    switch (todayStatus) {
      case 'completed': return { text: 'Completed', color: '#10B981' };
      case 'checked-in':
      case 'timed_in': return { text: 'Checked In', color: '#F59E0B' };
      default: return { text: 'Not Started', color: '#EF4444' };
    }
  };

  const statusDisplay = getStatusDisplay();

  const checkCooldown = async () => {
    try {
      const lastClockIn = await AsyncStorage.getItem(`lastClockIn_${employee.employee_id}`);
      if (lastClockIn) {
        const lastTime = new Date(parseInt(lastClockIn));
        const diffMinutes = Math.floor((new Date() - lastTime) / 60000);
        if (diffMinutes < 10) {
          setCooldownRemaining(10 - diffMinutes);
          return false;
        }
        setCooldownRemaining(0);
      }
      return true;
    } catch (error) {
      return true;
    }
  };

  const handleTimeInPress = async () => {
    if (isProcessing) return;
    if (['checked-in', 'timed_in', 'completed'].includes(todayStatus)) {
      Toast.show({ type: 'info', text1: 'Already Checked In', text2: 'You have already checked in today' });
      return;
    }
    const canClockIn = await checkCooldown();
    if (!canClockIn) {
      Toast.show({ type: 'info', text1: 'Cooldown Active', text2: `Please wait ${cooldownRemaining} minutes` });
      return;
    }
    setAttendanceType('IN');
    setShowCamera(true);
  };

  const handleTimeOutPress = async () => {
    if (isProcessing) return;
    if (!['checked-in', 'timed_in'].includes(todayStatus)) {
      Toast.show({ type: 'info', text1: 'Not Checked In', text2: 'Please check in first' });
      return;
    }
    setAttendanceType('OUT');
    setShowCamera(true);
  };

  const handleAttendanceSuccess = (result, options = {}) => {
    setShowCamera(false);
    setAttendanceResult(result);
    setShowResultModal(true);

    setTimeout(() => {
      loadTodayStatus();
      loadHistory();
    }, 500);

    if (options.logoutAfter && navigation) {
      setTimeout(() => {
        setShowResultModal(false);
        setAttendanceResult(null);
        navigation.replace('Login');
      }, 2500);
    }
  };

  const closeResultModal = () => {
    setShowResultModal(false);
    setAttendanceResult(null);
  };

  const formatScheduleTime = (time24) => {
    if (!time24) return '--:-- --';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTypeColor = (type) => type === 'IN' ? '#10B981' : '#EF4444';
  const getTypeIcon = (type) => type === 'IN' ? 'log-in-outline' : 'log-out-outline';

  // ⭐ #9 — Flag badge colors for history records
  const getFlagBadge = (flag) => {
    switch (flag) {
      case 'awol': return { label: 'AWOL', bg: '#FEE2E2', color: '#991B1B' };
      case 'emergency_absent': return { label: 'EA', bg: '#FEF3C7', color: '#B45309' };
      case 'on_leave': return { label: 'Leave', bg: '#E0E7FF', color: '#3730A3' };
      case 'late_in': return { label: 'Late In', bg: '#FEF3C7', color: '#B45309' };
      default: return null;
    }
  };

  return (
    <View style={[styles.attendanceContainer, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.scheduleCard, scheduleWarning && styles.scheduleCardWarning, { backgroundColor: scheduleWarning ? theme.scheduleCardWarning : theme.scheduleCard, borderLeftColor: scheduleWarning ? "#F59E0B" : "#2563EB" }]}>
          <View style={styles.scheduleHeader}>
            <MaterialIcons name="schedule" size={20} color={scheduleWarning ? "#F59E0B" : "#2563EB"} />
            <Text style={[styles.scheduleHeaderText, scheduleWarning && styles.scheduleHeaderTextWarning, { color: scheduleWarning ? "#D97706" : theme.text }]}>Today's Schedule</Text>
          </View>
          {todaySchedule ? (
            <View style={styles.scheduleContent}>
              <View style={styles.scheduleTimeRow}>
                <View style={styles.scheduleTimeItem}>
                  <Text style={[styles.scheduleTimeLabel, { color: theme.textSecondary }]}>Time In</Text>
                  <Text style={[styles.scheduleTimeValue, { color: theme.text }]}>{formatScheduleTime(todaySchedule.start_time)}</Text>
                </View>
                <View style={styles.scheduleTimeItem}>
                  <Text style={[styles.scheduleTimeLabel, { color: theme.textSecondary }]}>Time Out</Text>
                  <Text style={[styles.scheduleTimeValue, { color: theme.text }]}>{formatScheduleTime(todaySchedule.end_time)}</Text>
                </View>
              </View>
              <View style={[styles.scheduleMeta, { borderTopColor: theme.divider }]}>
                <Text style={[styles.scheduleShiftType, { color: '#2563EB' }]}>{todaySchedule.shift_type === 'regular' ? 'Regular Shift' : 'On-Call'}</Text>
                {todaySchedule.placement && (
                  <Text style={[styles.schedulePlacement, { color: theme.textSecondary }]}><Ionicons name="location-outline" size={12} color={theme.textSecondary} /> {todaySchedule.placement}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.scheduleNoSchedule}>
              <MaterialIcons name="info-outline" size={24} color="#F59E0B" />
              <Text style={[styles.scheduleNoScheduleText, { color: '#F59E0B' }]}>No schedule assigned for today</Text>
              <Text style={[styles.scheduleNoScheduleSubtext, { color: theme.textMuted }]}>Please contact your admin</Text>
            </View>
          )}
        </View>

        <View style={[styles.attendanceCenter, { backgroundColor: isDarkMode ? '#1E2A3A' : '#F8FAFF', borderColor: isDarkMode ? '#2D3A4A' : '#2563EB30' }]}>
          <View style={styles.attendanceCenterHeader}>
            <View style={styles.attendanceCenterTitleRow}>
              <MaterialIcons name="touch-app" size={24} color="#2563EB" />
              <Text style={[styles.attendanceCenterTitle, { color: theme.text }]}>Attendance Center</Text>
            </View>
            <View style={styles.attendanceCenterBadge}>
              <Text style={styles.attendanceCenterBadgeText}>Today</Text>
            </View>
          </View>

          <View style={[styles.attendanceStatusCard, { backgroundColor: theme.card, borderColor: theme.borderColor }]}>
            <View style={styles.attendanceStatusRow}>
              <Text style={[styles.attendanceStatusLabel, { color: theme.textSecondary }]}>Current Status</Text>
              <View style={[styles.attendanceStatusValueContainer, { backgroundColor: statusDisplay.color + '15' }]}>
                <View style={[styles.attendanceStatusDot, { backgroundColor: statusDisplay.color }]} />
                <Text style={[styles.attendanceStatusValue, { color: statusDisplay.color }]}>{statusDisplay.text}</Text>
              </View>
            </View>
            {todaySchedule && (
              <View style={[styles.attendanceScheduleRow, { borderTopColor: theme.divider }]}>
                <Text style={[styles.attendanceScheduleLabel, { color: theme.textSecondary }]}>Scheduled Time</Text>
                <Text style={[styles.attendanceScheduleValue, { color: theme.text }]}>
                  {formatScheduleTime(todaySchedule.start_time)} — {formatScheduleTime(todaySchedule.end_time)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.timeInButton, (['checked-in', 'timed_in', 'completed'].includes(todayStatus) || isProcessing) && styles.disabledButton]}
              onPress={handleTimeInPress}
              disabled={['checked-in', 'timed_in', 'completed'].includes(todayStatus) || loading || isProcessing}>
              <View style={styles.buttonIconContainer}>
                <Ionicons name="log-in-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.buttonText}>Time In</Text>
              {!['checked-in', 'timed_in', 'completed'].includes(todayStatus) && !isProcessing && (
                <Text style={styles.buttonSubtext}>Start your shift</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeOutButton, (!['checked-in', 'timed_in'].includes(todayStatus) || isProcessing) && styles.disabledButton]}
              onPress={handleTimeOutPress}
              disabled={!['checked-in', 'timed_in'].includes(todayStatus) || loading || isProcessing}>
              <View style={styles.buttonIconContainer}>
                <Ionicons name="log-out-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.buttonText}>Time Out</Text>
              {['checked-in', 'timed_in'].includes(todayStatus) && !isProcessing && (
                <Text style={styles.buttonSubtext}>End your shift</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ⭐ #NEW — History stats bar now shows 5 metrics including AWOL & EA */}
        <View style={[styles.historyStatsBar, { backgroundColor: theme.card }]}>
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: theme.text }]}>{historyStats.total_records}</Text>
            <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.historyStatDivider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: '#10B981' }]}>{historyStats.time_ins}</Text>
            <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>Time Ins</Text>
          </View>
          <View style={[styles.historyStatDivider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: '#EF4444' }]}>{historyStats.time_outs}</Text>
            <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>Time Outs</Text>
          </View>
          <View style={[styles.historyStatDivider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: '#DC2626' }]}>{historyStats.awol_count || 0}</Text>
            <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>AWOL</Text>
          </View>
          <View style={[styles.historyStatDivider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: '#D97706' }]}>{historyStats.ea_count || 0}</Text>
            <Text style={[styles.historyStatLabel, { color: theme.textSecondary }]}>EA</Text>
          </View>
        </View>

        <View style={styles.monthSelectorContainer}>
          <Text style={[styles.monthSelectorLabel, { color: theme.textSecondary }]}>Select Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
            {months.map((month, index) => (
              <TouchableOpacity key={index} style={[styles.monthChip, selectedMonth === index && styles.monthChipActive, { backgroundColor: selectedMonth === index ? '#2563EB' : theme.chipBg }]} onPress={() => setSelectedMonth(index)}>
                <Text style={[styles.monthChipText, selectedMonth === index && styles.monthChipTextActive, { color: selectedMonth === index ? '#fff' : theme.textSecondary }]}>{month}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {historyLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <View style={styles.historyList}>
            {history.length > 0 ? history.map((record, index) => {
              const flagBadge = getFlagBadge(record.attendance_flag);
              return (
                <View key={record.id || index} style={[styles.recordCard, { backgroundColor: theme.card }]}>
                  {record.selfie_url ? (
                    <Image source={{ uri: record.selfie_url }} style={styles.recordSelfie} />
                  ) : (
                    <View style={[styles.recordSelfie, styles.recordSelfiePlaceholder, { backgroundColor: theme.chipBg }]}>
                      <Ionicons name="camera" size={30} color={theme.textMuted} />
                    </View>
                  )}
                  <View style={styles.recordInfo}>
                    <Text style={[styles.recordDate, { color: theme.text }]}>{moment(record.timestamp).format('MMMM D, YYYY')}</Text>
                    <Text style={[styles.recordTime, { color: theme.textSecondary }]}>{moment(record.timestamp).format('h:mm:ss A')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={[styles.recordTypeBadge, { backgroundColor: getTypeColor(record.type) + '20' }]}>
                        <Ionicons name={getTypeIcon(record.type)} size={12} color={getTypeColor(record.type)} />
                        <Text style={[styles.recordTypeText, { color: getTypeColor(record.type) }]}>Time {record.type}</Text>
                      </View>
                      {/* ⭐ #9 — Attendance flag badge (AWOL / EA / Leave / Late In) */}
                      {flagBadge && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 10,
                            backgroundColor: flagBadge.bg,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: flagBadge.color, letterSpacing: 0.3 }}>
                            {flagBadge.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.recordIcon, { backgroundColor: getTypeColor(record.type) + '20' }]}>
                    <Ionicons name={getTypeIcon(record.type)} size={24} color={getTypeColor(record.type)} />
                  </View>
                </View>
              );
            }) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={60} color={theme.textMuted} />
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>No attendance records found</Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.textMuted }]}>Select a different month</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowCamera(false)}>
        <CameraCaptureScreen employee={employee} attendanceType={attendanceType} onClose={() => setShowCamera(false)} onSuccess={handleAttendanceSuccess} />
      </Modal>

      <Modal visible={showResultModal} transparent animationType="fade" onRequestClose={closeResultModal}>
        <View style={styles.resultOverlay}>
          <View style={[styles.resultModal, { backgroundColor: theme.card }]}>
            <View style={styles.resultHeader}>
              <Ionicons name={attendanceResult?.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={50} color={attendanceResult?.type === 'success' ? '#10B981' : '#EF4444'} />
              <Text style={[styles.resultTitle, { color: theme.text }]}>{attendanceResult?.title || 'Attendance Recorded'}</Text>
            </View>
            <View style={styles.resultBody}>
              {attendanceResult?.details?.map((detail, index) => (
                <View key={index} style={[styles.resultDetailRow, { borderBottomColor: theme.divider }]}>
                  <Text style={[styles.resultDetailLabel, { color: theme.textSecondary }]}>{detail.label}</Text>
                  <Text style={[styles.resultDetailValue, { color: theme.text }]}>{detail.value}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.resultButton} onPress={closeResultModal}>
              <Text style={styles.resultButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ==================== REQUEST SCREEN ====================
const RequestScreen = ({ employee }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState({ used: 0, remaining: 3, total: 3 });

  useEffect(() => {
    loadRequests();
    loadLeaveBalance();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.getEmployeeRequests(employee.employee_id);
      if (response.success) {
        setRequests(response.data.data || response.data || []);
      }
      const statsResponse = await api.getRequestStats(employee.employee_id);
      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load requests' });
    } finally {
      setLoading(false);
    }
  };

  const loadLeaveBalance = async () => {
    try {
      const response = await api.getLeaveBalance(employee.employee_id);
      if (response.success && response.data) {
        setLeaveBalance({
          used: response.data.used || 0,
          remaining: response.data.remaining || 3,
          total: response.data.total || 3,
        });
      }
    } catch (error) {
      console.log('Error loading leave balance:', error);
    }
  };

  const handleCancelRequest = async (request) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: async () => {
        try {
          await api.cancelRequest(request.id);
          Toast.show({ type: 'success', text1: 'Cancelled', text2: 'Request cancelled successfully' });
          loadRequests();
          loadLeaveBalance();
        } catch (error) {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to cancel request' });
        }
      }}
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'cancelled': return '#6B7280';
      default: return '#F59E0B';
    }
  };

  const filteredRequests = requests.filter(req => {
    if (selectedFilter === 'all') return true;
    return req.status === selectedFilter;
  });

  return (
    <View style={[styles.requestContainer, { backgroundColor: theme.background }]}>
      <View style={[styles.requestStatsBar, { backgroundColor: theme.card }]}>
        <View style={styles.requestStatItem}>
          <Text style={[styles.requestStatValue, { color: '#F59E0B' }]}>{stats.pending || 0}</Text>
          <Text style={[styles.requestStatLabel, { color: theme.textSecondary }]}>Pending</Text>
        </View>
        <View style={[styles.requestStatDivider, { backgroundColor: theme.borderColor }]} />
        <View style={styles.requestStatItem}>
          <Text style={[styles.requestStatValue, { color: '#10B981' }]}>{stats.approved || 0}</Text>
          <Text style={[styles.requestStatLabel, { color: theme.textSecondary }]}>Approved</Text>
        </View>
        <View style={[styles.requestStatDivider, { backgroundColor: theme.borderColor }]} />
        <View style={styles.requestStatItem}>
          <Text style={[styles.requestStatValue, { color: '#EF4444' }]}>{stats.rejected || 0}</Text>
          <Text style={[styles.requestStatLabel, { color: theme.textSecondary }]}>Rejected</Text>
        </View>
      </View>

      <View style={[styles.leaveBalanceCard, { backgroundColor: theme.card }]}>
        <View style={styles.leaveBalanceHeader}>
          <Ionicons name="calendar-outline" size={20} color="#2563EB" />
          <Text style={[styles.leaveBalanceTitle, { color: theme.text }]}>Leave Balance (Yearly)</Text>
        </View>
        <View style={styles.leaveBalanceRow}>
          <View style={styles.leaveBalanceItem}>
            <Text style={[styles.leaveBalanceValue, { color: theme.text }]}>{leaveBalance.total}</Text>
            <Text style={[styles.leaveBalanceLabel, { color: theme.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.leaveBalanceDivider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.leaveBalanceItem}>
            <Text style={[styles.leaveBalanceValue, { color: '#F59E0B' }]}>{leaveBalance.used}</Text>
            <Text style={[styles.leaveBalanceLabel, { color: theme.textSecondary }]}>Used</Text>
          </View>
          <View style={[styles.leaveBalanceDivider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.leaveBalanceItem}>
            <Text style={[styles.leaveBalanceValue, { color: '#10B981' }]}>{leaveBalance.remaining}</Text>
            <Text style={[styles.leaveBalanceLabel, { color: theme.textSecondary }]}>Remaining</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.createRequestBtn} onPress={() => setShowCreateModal(true)}>
        <Ionicons name="add-circle-outline" size={24} color="#fff" />
        <Text style={styles.createRequestBtnText}>Create New Request</Text>
      </TouchableOpacity>

      <View style={[styles.requestFilterTabs, { backgroundColor: theme.card }]}>
        {['all', 'pending', 'approved', 'rejected'].map((filter) => (
          <TouchableOpacity key={filter} style={[styles.requestFilterTab, selectedFilter === filter && styles.requestFilterTabActive]} onPress={() => setSelectedFilter(filter)}>
            <Text style={[styles.requestFilterTabText, selectedFilter === filter && styles.requestFilterTabTextActive, { color: selectedFilter === filter ? '#fff' : theme.textSecondary }]}>
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={({ item }) => (
            <View style={[styles.requestCard, { backgroundColor: theme.card }]}>
              <View style={styles.requestCardHeader}>
                <View style={[styles.requestTypeBadge, { backgroundColor: item.type_color || '#EBF5FF' }]}>
                  <Ionicons name={item.request_type === 'dayoff' ? 'sunny-outline' : item.request_type === 'swap' ? 'swap-horizontal-outline' : item.request_type === 'sick' ? 'medkit-outline' : 'airplane-outline'} size={14} color={item.type_color || '#2563EB'} />
                  <Text style={[styles.requestTypeText, { color: item.type_color || '#2563EB' }]}>
                    {item.request_type === 'dayoff' ? 'Day Off' : item.request_type === 'swap' ? 'Shift Swap' : item.request_type === 'sick' ? 'Sick Leave' : 'Leave'}
                  </Text>
                </View>
                <View style={[styles.requestStatusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <View style={[styles.requestStatusDot, { backgroundColor: getStatusColor(item.status) }]} />
                  <Text style={[styles.requestStatusText, { color: getStatusColor(item.status) }]}>
                    {item.status_label || item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.requestCardDates}>
                <Text style={[styles.requestDateText, { color: theme.textSecondary }]}>
                  {item.request_type === 'dayoff'
                    ? moment(item.start_date).format('MMM D, YYYY')
                    : `${moment(item.start_date).format('MMM D, YYYY')} - ${moment(item.end_date).format('MMM D, YYYY')}`}
                </Text>
                {/* ⭐ #4 — Full shift swap summary (From time → To time, From emp → To emp) */}
                {item.request_type === 'swap' && (item.swap_summary || item.swap_from_time || item.swap_to_time || item.swap_shift_time) && (
                  <Text style={[styles.requestTimeText, { color: theme.textMuted }]}>
                    {item.swap_summary
                      ? item.swap_summary
                      : `Time: ${item.swap_from_time || item.swap_shift_time || '—'} → ${item.swap_to_time || '—'}${item.swap_from_employee_name || item.swap_to_employee_name ? ` (${item.swap_from_employee_name || '—'} → ${item.swap_to_employee_name || '—'})` : ''}`}
                  </Text>
                )}
              </View>
              <Text style={[styles.requestReason, { color: theme.text }]} numberOfLines={2}>{item.reason}</Text>
              {item.medical_certificate_url && (
                <TouchableOpacity style={styles.medicalCertBtn}>
                  <Ionicons name="document-attach-outline" size={16} color="#2563EB" />
                  <Text style={styles.medicalCertText}>View Medical Certificate</Text>
                </TouchableOpacity>
              )}
              {item.status === 'pending' && (
                <TouchableOpacity style={styles.requestCancelBtn} onPress={() => handleCancelRequest(item)}>
                  <Text style={styles.requestCancelText}>Cancel Request</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={60} color={theme.textMuted} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>No requests found</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.textMuted }]}>Tap "Create New Request" to get started</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={true}
        />
      )}

      <CreateRequestModal
        visible={showCreateModal}
        employee={employee}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => { loadRequests(); loadLeaveBalance(); }}
        leaveBalance={leaveBalance}
      />
    </View>
  );
};

// ==================== CREATE REQUEST MODAL ====================
const CreateRequestModal = ({ visible, employee, onClose, onSuccess, leaveBalance }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [requestType, setRequestType] = useState('dayoff');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [medicalCert, setMedicalCert] = useState(null);

  // ⭐ #4 — Shift swap full details: From/To time + From/To employee
  const [swapFromTime, setSwapFromTime] = useState('');
  const [swapToTime, setSwapToTime] = useState('');
  const [swapFromEmployeeName, setSwapFromEmployeeName] = useState('');
  const [swapToEmployeeName, setSwapToEmployeeName] = useState('');
  const [showFromTimePicker, setShowFromTimePicker] = useState(false);
  const [showToTimePicker, setShowToTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  // ⭐ #8 — Duplicate error message surfaced to the user
  const [duplicateError, setDuplicateError] = useState('');

  const requestTypes = [
    { id: 'dayoff', label: 'Day Off', icon: 'sunny-outline', color: '#10B981' },
    { id: 'swap', label: 'Shift Swap', icon: 'swap-horizontal-outline', color: '#F59E0B' },
    { id: 'sick', label: 'Sick Leave', icon: 'medkit-outline', color: '#EC4899' },
    { id: 'leave', label: 'Leave', icon: 'airplane-outline', color: '#2563EB' },
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Please allow access to your gallery' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setMedicalCert({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const mapRequestTypeForBackend = (type) => {
    const map = { dayoff: 'day_off', swap: 'leave', sick: 'sick_leave', leave: 'leave' };
    return map[type] || 'leave';
  };

  const handleSubmit = async () => {
    setDuplicateError('');

    if (!reason.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please provide a reason' });
      return;
    }
    if (requestType === 'leave' && leaveBalance.remaining <= 0) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'You have no leave remaining for this year' });
      return;
    }
    if (moment(endDate).isBefore(moment(startDate))) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'End date must be after start date' });
      return;
    }
    if (requestType === 'swap') {
      if (!swapFromTime || !swapToTime) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Please select both From and To shift times' });
        return;
      }
      if (!swapFromEmployeeName.trim() || !swapToEmployeeName.trim()) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter both From and To employee names' });
        return;
      }
    }

    setLoading(true);
    try {
      const data = {
        employee_id: String(employee.employee_id),
        request_type: mapRequestTypeForBackend(requestType),
        start_date: moment(startDate).format('YYYY-MM-DD'),
        end_date: moment(endDate).format('YYYY-MM-DD'),
        reason: reason.trim(),
      };
      if (requestType === 'swap') {
        data.swap_from_time = swapFromTime;
        data.swap_to_time = swapToTime;
        data.swap_shift_time = `${swapFromTime} → ${swapToTime}`;
        data.swap_shift_date = moment(startDate).format('YYYY-MM-DD');
        data.swap_from_employee_name = swapFromEmployeeName.trim();
        data.swap_to_employee_name = swapToEmployeeName.trim();
      }
      if (requestType === 'sick' && medicalCert) {
        data.medical_certificate = medicalCert.base64;
      }
      const response = await api.createRequest(data);
      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Request submitted successfully' });
        onSuccess && onSuccess();
        onClose();
        resetForm();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: response.message || 'Failed to submit request' });
      }
    } catch (error) {
      console.error('Submit error:', error);

      // ⭐ #8 — Duplicate / validation handling
      const errorData = error?.data || error?.response?.data;
      const validationErrors = errorData?.errors;
      const firstValidationError = validationErrors
        ? Object.values(validationErrors).flat().find(Boolean)
        : null;
      const message = firstValidationError || errorData?.message || error?.message || 'Failed to submit request';

      const isDuplicate =
        error?.status === 422 ||
        /already|duplicate|exists|pending or approved/i.test(String(message));

      if (isDuplicate) {
        setDuplicateError(String(message));
        Toast.show({
          type: 'error',
          text1: 'Duplicate Request',
          text2: String(message),
        });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: String(message) });
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRequestType('dayoff');
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
    setMedicalCert(null);
    setSwapFromTime('');
    setSwapToTime('');
    setSwapFromEmployeeName('');
    setSwapToEmployeeName('');
    setDuplicateError('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={[styles.modalHeader, { backgroundColor: theme.card, borderBottomColor: theme.borderColor }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={[styles.modalContent, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={true}>
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Request Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.typeScroll}>
                {requestTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeChip, requestType === type.id && styles.typeChipActive, { borderColor: type.color, backgroundColor: requestType === type.id ? type.color : theme.chipBg }]}
                    onPress={() => setRequestType(type.id)}>
                    <Ionicons name={type.icon} size={20} color={requestType === type.id ? '#fff' : type.color} />
                    <Text style={[styles.typeChipText, requestType === type.id && styles.typeChipTextActive, { color: requestType === type.id ? '#fff' : theme.textSecondary }]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ⭐ #8 — Duplicate error banner */}
            {duplicateError ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                borderRadius: 10,
                backgroundColor: '#FEE2E2',
                borderWidth: 1,
                borderColor: '#FCA5A5',
                marginBottom: 16,
              }}>
                <Ionicons name="alert-circle" size={18} color="#991B1B" />
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#991B1B' }}>
                  {duplicateError}
                </Text>
              </View>
            ) : null}

            {requestType === 'leave' && (
              <View style={[styles.leaveWarningContainer, { backgroundColor: theme.chipBg }]}>
                <Ionicons name="information-circle-outline" size={20} color={leaveBalance.remaining > 0 ? '#10B981' : '#EF4444'} />
                <Text style={[styles.leaveWarningText, { color: leaveBalance.remaining > 0 ? '#10B981' : '#EF4444' }]}>
                  {leaveBalance.remaining > 0
                    ? `${leaveBalance.remaining} leave days remaining this year`
                    : 'No leave remaining for this year'}
                </Text>
              </View>
            )}

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>{requestType === 'dayoff' ? 'Date' : 'Start Date'}</Text>
              <TouchableOpacity style={[styles.dateButton, { backgroundColor: theme.input, borderColor: theme.inputBorder }]} onPress={() => setShowStartPicker(true)}>
                <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                <Text style={[styles.dateButtonText, { color: theme.text }]}>{moment(startDate).format('MMMM D, YYYY')}</Text>
              </TouchableOpacity>
            </View>

            {requestType !== 'dayoff' && (
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>End Date</Text>
                <TouchableOpacity style={[styles.dateButton, { backgroundColor: theme.input, borderColor: theme.inputBorder }]} onPress={() => setShowEndPicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                  <Text style={[styles.dateButtonText, { color: theme.text }]}>{moment(endDate).format('MMMM D, YYYY')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ⭐ #4 — From/To Time + From/To Employee for Shift Swap */}
            {requestType === 'swap' && (
              <>
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>From Time</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}
                    onPress={() => setShowFromTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#2563EB" />
                    <Text style={[styles.dateButtonText, { color: theme.text }]}>
                      {swapFromTime || 'Select From Time'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>To Time</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}
                    onPress={() => setShowToTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#2563EB" />
                    <Text style={[styles.dateButtonText, { color: theme.text }]}>
                      {swapToTime || 'Select To Time'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>From Employee</Text>
                  <TextInput
                    style={[styles.reasonInput, {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                      minHeight: 48,
                      paddingVertical: 12,
                    }]}
                    placeholder="e.g., Jefferson"
                    placeholderTextColor={theme.textMuted}
                    value={swapFromEmployeeName}
                    onChangeText={setSwapFromEmployeeName}
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>To Employee</Text>
                  <TextInput
                    style={[styles.reasonInput, {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                      minHeight: 48,
                      paddingVertical: 12,
                    }]}
                    placeholder="e.g., Adriane"
                    placeholderTextColor={theme.textMuted}
                    value={swapToEmployeeName}
                    onChangeText={setSwapToEmployeeName}
                  />
                </View>
              </>
            )}

            {requestType === 'sick' && (
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Medical Certificate</Text>
                <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: theme.input, borderColor: theme.inputBorder }]} onPress={pickImage}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#2563EB" />
                  <Text style={[styles.uploadBtnText, { color: '#2563EB' }]}>{medicalCert ? 'Certificate Uploaded ✓' : 'Upload Medical Certificate'}</Text>
                </TouchableOpacity>
                {medicalCert && <Image source={{ uri: medicalCert.uri }} style={styles.medicalPreview} />}
              </View>
            )}

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Reason</Text>
              <TextInput
                style={[styles.reasonInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                multiline
                numberOfLines={4}
                placeholder="Please provide detailed reason for your request..."
                placeholderTextColor={theme.textMuted}
                value={reason}
                onChangeText={setReason}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={[styles.submitButton, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Request</Text>}
            </TouchableOpacity>
          </ScrollView>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowStartPicker(false);
                if (selectedDate) {
                  setStartDate(selectedDate);
                  if (moment(selectedDate).isAfter(endDate)) {
                    setEndDate(selectedDate);
                  }
                }
              }}
              minimumDate={new Date(2000, 0, 1)}
              maximumDate={new Date(2030, 11, 31)}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowEndPicker(false);
                if (selectedDate) setEndDate(selectedDate);
              }}
              minimumDate={new Date(2000, 0, 1)}
              maximumDate={new Date(2030, 11, 31)}
            />
          )}

          {showFromTimePicker && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedTime) => {
                setShowFromTimePicker(false);
                if (selectedTime) {
                  setSwapFromTime(moment(selectedTime).format('hh:mm A'));
                  setTempTime(selectedTime);
                }
              }}
            />
          )}

          {showToTimePicker && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedTime) => {
                setShowToTimePicker(false);
                if (selectedTime) {
                  setSwapToTime(moment(selectedTime).format('hh:mm A'));
                  setTempTime(selectedTime);
                }
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// ==================== SCHEDULE SCREEN ====================
const ScheduleScreen = ({ employee }) => {
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    loadSchedules();
  }, [currentMonth]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const startDate = currentMonth.clone().startOf('month').format('YYYY-MM-DD');
      const endDate = currentMonth.clone().endOf('month').format('YYYY-MM-DD');
      const response = await api.getAttendanceByDateRange(employee.employee_id, startDate, endDate);
      if (response.success) {
        setSchedules(response.data.data || response.data || []);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const days = [];
    const firstDay = currentMonth.clone().startOf('month').day();
    const daysInMonth = currentMonth.daysInMonth();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getScheduleForDay = (day) => {
    if (!day) return null;
    const dateStr = currentMonth.clone().date(day).format('YYYY-MM-DD');
    return schedules.find(s => moment(s.date).format('YYYY-MM-DD') === dateStr);
  };

  const changeMonth = (delta) => {
    setCurrentMonth(currentMonth.clone().add(delta, 'month'));
    setSelectedDate(null);
  };

  const formatScheduleTime = (time24) => {
    if (!time24) return '--:-- --';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <View style={[styles.scheduleContainer, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={true}>
        <View style={[styles.scheduleCalendar, { backgroundColor: theme.card }]}>
          <View style={styles.scheduleMonthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.scheduleNavBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.scheduleMonthText, { color: theme.text }]}>{currentMonth.format('MMMM YYYY')}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.scheduleNavBtn}>
              <Ionicons name="chevron-forward" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleWeekDays}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.scheduleWeekDayText, { color: theme.textSecondary }]}>{day}</Text>
            ))}
          </View>

          <View style={styles.scheduleDaysGrid}>
            {getDaysInMonth().map((day, index) => {
              const schedule = getScheduleForDay(day);
              const isToday = day === moment().date() && currentMonth.month() === moment().month() && currentMonth.year() === moment().year();
              const isSelected = day === selectedDate;
              return (
                <TouchableOpacity key={index} style={[styles.scheduleDayCell, isSelected && styles.scheduleDayCellSelected, { backgroundColor: isSelected ? '#EBF5FF' : 'transparent' }]} onPress={() => setSelectedDate(day)}>
                  {day ? (
                    <>
                      <Text style={[styles.scheduleDayText, isToday && styles.scheduleDayToday, { color: isToday ? '#fff' : theme.text }]}>{day}</Text>
                      {schedule && <View style={[styles.scheduleDayDot, { backgroundColor: schedule.status === 'present' ? '#10B981' : '#F59E0B' }]} />}
                    </>
                  ) : (
                    <Text style={[styles.scheduleDayEmpty, { color: theme.textMuted }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.scheduleDetails, { backgroundColor: theme.card }]}>
          <Text style={[styles.scheduleDetailsTitle, { color: theme.text }]}>Schedule Details</Text>
          {selectedDate ? (
            (() => {
              const schedule = getScheduleForDay(selectedDate);
              const dateObj = currentMonth.clone().date(selectedDate);
              return (
                <View style={[styles.scheduleDetailCard, { backgroundColor: theme.input }]}>
                  <Text style={[styles.scheduleDetailDate, { color: theme.text }]}>{dateObj.format('MMMM D, YYYY')}</Text>
                  {schedule ? (
                    <View style={styles.scheduleDetailContent}>
                      <View style={styles.scheduleDetailRow}>
                        <Ionicons name="time-outline" size={18} color="#2563EB" />
                        <Text style={[styles.scheduleDetailText, { color: theme.text }]}>
                          {formatScheduleTime(schedule.start_time)} - {formatScheduleTime(schedule.end_time)}
                        </Text>
                      </View>
                      <View style={styles.scheduleDetailRow}>
                        <Ionicons name="briefcase-outline" size={18} color="#2563EB" />
                        <Text style={[styles.scheduleDetailText, { color: theme.text }]}>
                          {schedule.shift_type === 'regular' ? 'Regular Shift' : 'On-Call'}
                        </Text>
                      </View>
                      {schedule.placement && (
                        <View style={styles.scheduleDetailRow}>
                          <Ionicons name="location-outline" size={18} color="#2563EB" />
                          <Text style={[styles.scheduleDetailText, { color: theme.text }]}>{schedule.placement}</Text>
                        </View>
                      )}
                      <View style={[styles.scheduleDetailStatus, { backgroundColor: schedule.status === 'present' ? '#10B98120' : '#F59E0B20' }]}>
                        <Text style={[styles.scheduleDetailStatusText, { color: schedule.status === 'present' ? '#10B981' : '#F59E0B' }]}>
                          {schedule.status === 'present' ? '✓ Present' : 'Absent'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.scheduleNoDetail}>
                      <MaterialIcons name="info-outline" size={32} color={theme.textMuted} />
                      <Text style={[styles.scheduleNoDetailText, { color: theme.textSecondary }]}>No schedule for this day</Text>
                    </View>
                  )}
                </View>
              );
            })()
          ) : (
            <View style={styles.scheduleNoDetail}>
              <MaterialIcons name="calendar-today" size={32} color={theme.textMuted} />
              <Text style={[styles.scheduleNoDetailText, { color: theme.textSecondary }]}>Select a day to view schedule</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ==================== PROFILE SCREEN ====================
const ProfileScreen = ({ employee, onLogout }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    phone: employee?.phone || employee?.mobile || '',
    position: employee?.department?.name || 'No Department',
    profile_photo_url: employee?.profile_photo_url || null,
  });
  const [editedData, setEditedData] = useState(profileData);

  // ⭐ #1 — Real profile photo upload (base64 → backend → refresh UI)
  const handlePhotoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Please allow access to your gallery' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();

    setPhotoUploading(true);
    try {
      const response = await api.updateProfilePhoto({
        profile_photo: asset.base64,
        profile_photo_ext: ext,
      });

      if (response.success) {
        const newUrl =
          response.data?.profile_photo_url ||
          response.data?.person?.profile_photo_url ||
          asset.uri;

        setProfileData((prev) => ({ ...prev, profile_photo_url: newUrl }));
        const updatedEmployee = { ...employee, profile_photo_url: newUrl };
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(updatedEmployee));
        Toast.show({ type: 'success', text1: 'Photo Updated', text2: 'Profile photo updated successfully' });
      } else {
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: response.message || 'Please try again.' });
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: error.message || 'Please try again.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  // ⭐ #2 — Real personal info save
  const handleSave = async () => {
    setLoading(true);
    try {
      const nameParts = (editedData.name || '').trim().split(/\s+/);
      const firstName = nameParts.shift() || '';
      const lastName = nameParts.join(' ');

         const response = await api.updateSelfProfile({
        first_name: firstName,
        last_name: lastName,
        email: editedData.email,
        phone: editedData.phone,
      });

      if (response.success) {
        setProfileData(editedData);
        setIsEditing(false);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });

        const updatedEmployee = { ...employee, ...editedData };
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(updatedEmployee));
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: response.message || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Update error:', error);
      const errorData = error?.data || error?.response?.data;
      const validationErrors = errorData?.errors;
      const firstValidationError = validationErrors ? Object.values(validationErrors).flat().find(Boolean) : null;
      Toast.show({ type: 'error', text1: 'Error', text2: firstValidationError || errorData?.message || error?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData(profileData);
    setIsEditing(false);
  };

  return (
    <View style={[styles.profileContainer, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.profileContent}>
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            style={styles.profileAvatarContainer}
            onPress={handlePhotoUpload}
            disabled={photoUploading}
          >
            {profileData.profile_photo_url ? (
              <Image source={{ uri: profileData.profile_photo_url }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatarPlaceholder, { backgroundColor: '#EBF5FF' }]}>
                <Text style={styles.profileAvatarInitial}>{employee.name?.charAt(0) || 'E'}</Text>
              </View>
            )}
            <View style={styles.profileCameraBadge}>
              {photoUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.profileFullName, { color: theme.text }]}>{profileData.name}</Text>
          <Text style={[styles.profileEmployeeId, { color: theme.textSecondary }]}>ID: {employee.employee_code || employee.employee_id}</Text>
          <Text style={[styles.profilePosition, { color: '#2563EB' }]}>{profileData.position}</Text>
        </View>

        <View style={[styles.profileInfoCard, { backgroundColor: theme.card }]}>
          <View style={styles.profileInfoHeader}>
            <Text style={[styles.profileInfoHeaderTitle, { color: theme.text }]}>Personal Information</Text>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text style={styles.profileInfoEditBtn}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.profileInfoEditActions}>
                <TouchableOpacity onPress={handleCancel} style={styles.profileInfoCancelBtn}>
                  <Text style={styles.profileInfoCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.profileInfoSaveBtn}>
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.profileInfoSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {isEditing ? (
            <>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="person-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Full Name</Text>
                  <TextInput
                    style={[styles.profileInfoInput, { color: theme.text, borderColor: theme.inputBorder }]}
                    value={editedData.name}
                    onChangeText={(text) => setEditedData({ ...editedData, name: text })}
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="mail-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Email</Text>
                  <TextInput
                    style={[styles.profileInfoInput, { color: theme.text, borderColor: theme.inputBorder }]}
                    value={editedData.email}
                    onChangeText={(text) => setEditedData({ ...editedData, email: text })}
                    keyboardType="email-address"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="call-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Phone</Text>
                  <TextInput
                    style={[styles.profileInfoInput, { color: theme.text, borderColor: theme.inputBorder }]}
                    value={editedData.phone}
                    onChangeText={(text) => setEditedData({ ...editedData, phone: text })}
                    keyboardType="phone-pad"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="person-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Full Name</Text>
                  <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profileData.name}</Text>
                </View>
              </View>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="mail-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Email</Text>
                  <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profileData.email || 'Not available'}</Text>
                </View>
              </View>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="call-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Phone</Text>
                  <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profileData.phone || 'Not available'}</Text>
                </View>
              </View>
              <View style={[styles.profileInfoItem, { borderBottomColor: theme.divider }]}>
                <Ionicons name="briefcase-outline" size={22} color="#6B7280" />
                <View style={styles.profileInfoText}>
                  <Text style={[styles.profileInfoLabel, { color: theme.textSecondary }]}>Position</Text>
                  <Text style={[styles.profileInfoValue, { color: theme.text }]}>{profileData.position}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ⭐ #3 — Spacer between Personal Info and Toggle card */}
        <View style={{ height: 20 }} />

        <View style={[styles.themeToggleCard, { backgroundColor: theme.card }]}>
          <View style={styles.themeToggleRow}>
            <View style={styles.themeToggleLeft}>
              <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={24} color="#F59E0B" />
              <Text style={[styles.themeToggleLabel, { color: theme.text }]}>
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#2563EB' }}
              thumbColor="#fff"
              ios_backgroundColor="#D1D5DB"
            />
          </View>
          <Text style={[styles.themeToggleSubtext, { color: theme.textSecondary }]}>
            {isDarkMode ? 'Switch to light mode for better visibility' : 'Switch to dark mode for comfortable viewing'}
          </Text>
        </View>

        <TouchableOpacity style={[styles.profileLogoutBtn, { backgroundColor: isDarkMode ? '#2D2D2D' : '#FEE2E2' }]} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text style={styles.profileLogoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ==================== CAMERA CAPTURE SCREEN ====================
const CameraCaptureScreen = ({ employee, attendanceType, onClose, onSuccess }) => {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    requestPermission();
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
        } catch (error) {
          // Location is optional — ignore failures.
        }
      }
    })();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current || processing) return;
    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      setCapturedImage(photo);
      setShowConfirmation(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to capture photo',
      });
    } finally {
      setProcessing(false);
    }
  };

  const confirmAttendance = async () => {
    setUploading(true);
    try {
      let base64Image = capturedImage.base64;
      if (!base64Image.includes('base64,')) {
        base64Image = `data:image/jpeg;base64,${base64Image}`;
      }

      const attendanceData = {
        employee_id: String(employee.employee_id),
        selfie: base64Image,
        face_verified: true,
        liveness_checked: true,
        device_info: `${Platform.OS} ${Platform.Version}`,
        captured_at: new Date().toISOString(),
      };

      if (location) {
        attendanceData.latitude = location.coords.latitude;
        attendanceData.longitude = location.coords.longitude;
      }

      const response =
        attendanceType === 'IN'
          ? await api.clockIn(attendanceData)
          : await api.clockOut(attendanceData);

      if (response.success) {
        if (attendanceType === 'IN') {
          await AsyncStorage.setItem(
            `lastClockIn_${employee.employee_id}`,
            Date.now().toString()
          );
        }

        const details = [];
        if (response.data) {
          if (response.data.scheduled_time)
            details.push({ label: 'Scheduled', value: response.data.scheduled_time });
          if (response.data.actual_time)
            details.push({ label: 'Actual', value: response.data.actual_time });
          if (response.data.status)
            details.push({ label: 'Status', value: response.data.status });
          if (response.data.overtime)
            details.push({ label: 'Overtime', value: response.data.overtime });
        }

        const result = {
          type: 'success',
          title: attendanceType === 'IN' ? 'Time In Successful' : 'Time Out Successful',
          details:
            details.length > 0
              ? details
              : [
                  { label: 'Action', value: attendanceType === 'IN' ? 'Time In' : 'Time Out' },
                  { label: 'Time', value: moment().format('hh:mm:ss A') },
                ],
        };

        await AsyncStorage.multiRemove(['authToken', 'currentEmployee']);
        onSuccess(result, { logoutAfter: true });

        onClose();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: response.message || 'Failed to record attendance',
        });
      }
    } catch (error) {
      console.error('Attendance error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Network error. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.cameraPermissionView}>
        <MaterialIcons name="no-photography" size={60} color="#EF4444" />
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={onClose}>
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showConfirmation && capturedImage) {
    return (
      <View style={styles.confirmationContainer}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.confirmationScroll}>
            <TouchableOpacity
              style={styles.confirmationClose}
              onPress={() => {
                setCapturedImage(null);
                setShowConfirmation(false);
                setProcessing(false);
              }}
            >
              <Ionicons name="close" size={28} color="#1F2937" />
            </TouchableOpacity>

            <Text style={styles.confirmationTitle}>
              Confirm {attendanceType === 'IN' ? 'Time In' : 'Time Out'}
            </Text>

            <View style={styles.confirmationImageContainer}>
              <Image source={{ uri: capturedImage.uri }} style={styles.confirmationImage} />
            </View>

            <View style={styles.confirmationDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={22} color="#6B7280" />
                <Text style={styles.detailText}>{employee.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={22} color="#6B7280" />
                <Text style={styles.detailText}>
                  {moment().format('MMMM Do YYYY, h:mm:ss a')}
                </Text>
              </View>
              {location && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={22} color="#6B7280" />
                  <Text style={styles.detailText}>Location captured</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={confirmAttendance}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Attendance</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mode="picture"
      />
      <View style={styles.cameraOverlay} pointerEvents="box-none">
        <View style={styles.cameraTopBar}>
          <TouchableOpacity style={styles.cameraCloseButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.cameraTypeBadge}>
            {attendanceType === 'IN' ? 'Time In' : 'Time Out'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.cameraInstructions}>
          <Text style={styles.cameraInstructionText}>
            Position yourself in the frame
          </Text>
        </View>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={takePicture}
          disabled={processing}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ==================== DASHBOARD SCREEN ====================
const DashboardScreen = ({ route, navigation, onAppLogout }) => {
  const { employee } = route.params;
  const { isDarkMode } = useTheme();
  const theme = getThemeStyles(isDarkMode);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [pendingRequests, setPendingRequests] = useState(0);
  const [adminMenuVisible, setAdminMenuVisible] = useState(false);
  const isAdmin = employee?.role === 'admin' || employee?.is_admin === true || employee?.role_id === 1;

  useEffect(() => {
    loadPendingRequests();
    verifySession(); // ⭐ #2 — Check if account is still active
  }, []);

  // ⭐ #2 — Verify session whenever the app resumes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        verifySession();
      }
    });
    return () => subscription?.remove?.();
  }, []);

  // ⭐ #2 — Check with the server if the account is still active.
  const verifySession = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await api.request('/auth/user', 'GET', null, true);

      // If server says user is inactive, log them out immediately.
      const user = response?.data?.user || response?.data;
      const isActive =
        user?.is_active === true ||
        user?.employee?.status === 'active' ||
        user?.employee?.status === 'on_leave';

      if (response?.success && user && !isActive) {
        Toast.show({
          type: 'error',
          text1: 'Account Disabled',
          text2: 'Your account has been deactivated by an admin.',
          visibilityTime: 6000,
        });
        await AsyncStorage.multiRemove(['authToken', 'currentEmployee']);
        navigation.replace('Login');
      }
    } catch (error) {
      // 401 / 403 → force logout
      if (error?.status === 401 || error?.status === 403) {
        await AsyncStorage.multiRemove(['authToken', 'currentEmployee']);
        Toast.show({
          type: 'error',
          text1: 'Session Ended',
          text2: error.message || 'Please log in again.',
          visibilityTime: 4000,
        });
        navigation.replace('Login');
      }
      // Network errors are ignored — user stays logged in offline.
    }
  };

  const loadPendingRequests = async () => {
    try {
      const statsResponse = await api.getRequestStats(employee.employee_id);
      if (statsResponse.success) {
        setPendingRequests(statsResponse.data.pending || 0);
      }
    } catch (error) {
      console.log('Error loading request stats:', error);
    }
  };

  const handleNavigate = (screen) => {
    setCurrentScreen(screen);
  };

  const handleLogout = async () => {
    setDrawerVisible(false);
    setAdminMenuVisible(false);

    Alert.alert(
      'Logout',
      'Are you sure you want to logout from Attendance Tracking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['authToken', 'currentEmployee']);
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home': return <HomeScreen employee={employee} navigation={navigation} onLogout={handleLogout} pendingRequests={pendingRequests} />;
      case 'Attendance': return <AttendanceScreen employee={employee} navigation={navigation} />;
      case 'Request': return <RequestScreen employee={employee} />;
      case 'Schedule': return <ScheduleScreen employee={employee} />;
      case 'Profile': return <ProfileScreen employee={employee} onLogout={handleLogout} />;
      default: return <HomeScreen employee={employee} navigation={navigation} onLogout={handleLogout} pendingRequests={pendingRequests} />;
    }
  };

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#1E1E1E' : '#F0F4FF'} />
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.borderColor }]}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Attendance Tracker</Text>
          <View style={styles.headerRight}>
            {pendingRequests > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{pendingRequests}</Text>
              </View>
            )}
            {isAdmin && (
              <TouchableOpacity style={styles.adminHeaderBtn} onPress={() => setAdminMenuVisible(true)}>
                <Ionicons name="settings-outline" size={24} color="#2563EB" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
          {renderScreen()}
        </View>
      </SafeAreaView>

      <NavigationDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        employee={employee}
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {isAdmin && (
        <AdminMenuDrawer
          visible={adminMenuVisible}
          onClose={() => setAdminMenuVisible(false)}
          employee={employee}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}

      <BottomNavigation currentScreen={currentScreen} onNavigate={handleNavigate} />
    </>
  );
};

// ==================== APP ENTRY ====================
export default function AttendanceTrackingApp({ onAppLogout, onBackToMainApp }) {
  return (
    <ThemeProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onBackToMainApp={onBackToMainApp}
              onAppLogout={onAppLogout}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Dashboard">
          {(props) => <DashboardScreen {...props} onAppLogout={onAppLogout} />}
        </Stack.Screen>
      </Stack.Navigator>
    </ThemeProvider>
  );
}


// ==================== STYLES ====================
const styles = StyleSheet.create({
  // ===== Login Styles =====
  loginContainer: { flex: 1, backgroundColor: '#F0F4FF', justifyContent: 'center', padding: 20 },
  loginCard: { backgroundColor: '#fff', borderRadius: 24, padding: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EBF5FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  appTitle: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginTop: 12 },
  appSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: '#1F2937' },
  loginButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  backToMobileButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 10 },
  backToMobileText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  recentScroll: { flexDirection: 'row', marginBottom: 16 },
  recentChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  recentChipText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  clearChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginLeft: 10 },
  clearChipText: { fontSize: 12, color: '#EF4444', marginLeft: 4 },
  hintContainer: { marginTop: 20, alignItems: 'center' },
  hintText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  serverStatus: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, zIndex: 10 },
  serverStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  serverOnline: { backgroundColor: '#10B981' },
  serverOffline: { backgroundColor: '#EF4444' },
  serverStatusText: { color: '#fff', fontSize: 10 },

  // ===== Main Container =====
  container: { flex: 1 },
  screenContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  menuButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 80, justifyContent: 'flex-end' },
  adminHeaderBtn: { padding: 4 },
  headerBadge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center', position: 'absolute', top: -5, right: 40 },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // ===== Home Styles =====
  homeContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  welcomeSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 16, elevation: 2 },
  welcomeContent: { flex: 1 },
  welcomeGreeting: { fontSize: 16 },
  welcomeName: { fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  welcomeId: { fontSize: 12, marginTop: 2 },
  welcomeAvatar: { width: 56, height: 56, borderRadius: 28, marginLeft: 12 },
  welcomeAvatarImage: { width: 56, height: 56, borderRadius: 28 },
  welcomeAvatarPlaceholder: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  welcomeAvatarInitial: { fontSize: 24, fontWeight: 'bold', color: '#2563EB' },

  dateTimeCard: { backgroundColor: '#2563EB', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 16, elevation: 2 },
  dayText: { fontSize: 18, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  dateText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  timeText: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', elevation: 2 },
  statIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },

  scheduleCard: { padding: 16, borderRadius: 16, marginBottom: 16, elevation: 2, borderLeftWidth: 4 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  scheduleHeaderText: { fontSize: 14, fontWeight: '600' },
  scheduleContent: { gap: 12 },
  scheduleTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scheduleTimeItem: { flex: 1 },
  scheduleTimeLabel: { fontSize: 11, marginBottom: 4 },
  scheduleTimeValue: { fontSize: 16, fontWeight: '600' },
  scheduleMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1 },
  scheduleShiftType: { fontSize: 12, fontWeight: '500' },
  schedulePlacement: { fontSize: 12 },
  scheduleNoSchedule: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  scheduleNoScheduleText: { fontSize: 14, fontWeight: '500' },
  scheduleNoScheduleSubtext: { fontSize: 12 },

  statusCard: { padding: 16, borderRadius: 16, marginBottom: 16, elevation: 2 },
  statusCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusCardLabel: { fontSize: 14 },
  statusCardBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statusCardDot: { width: 8, height: 8, borderRadius: 4 },
  statusCardText: { fontSize: 14, fontWeight: '600' },

  // ===== Admin Menu Styles =====
  adminDrawerOverlay: { flex: 1 },
  adminDrawerBackdrop: { flex: 1 },
  adminDrawerContainer: { position: 'absolute', right: 0, top: 0, height: '100%', width: width * 0.85 },
  adminDrawerSafeArea: { flex: 1 },
  adminDrawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  adminDrawerClose: { padding: 4 },
  adminDrawerTitle: { fontSize: 18, fontWeight: 'bold' },
  adminDrawerBody: { flex: 1, flexDirection: 'row' },
  adminDrawerMenu: { width: width * 0.35, paddingVertical: 12, borderRightWidth: 1 },
  adminDrawerMenuSection: { fontSize: 11, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  adminDrawerMenuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  adminDrawerMenuItemActive: { backgroundColor: '#EBF5FF', borderRightWidth: 3, borderRightColor: '#2563EB' },
  adminDrawerMenuItemText: { fontSize: 13 },
  adminDrawerMenuItemTextActive: { color: '#2563EB', fontWeight: '500' },
  adminDrawerContent: { flex: 1, padding: 16 },

  adminProfileContainer: { flex: 1 },
  adminProfileHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2 },
  adminProfileAvatar: { width: 56, height: 56, borderRadius: 28 },
  adminProfileAvatarPlaceholder: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  adminProfileAvatarInitial: { fontSize: 24, fontWeight: 'bold', color: '#2563EB' },
  adminProfileInfo: { marginLeft: 12, flex: 1 },
  adminProfileName: { fontSize: 16, fontWeight: 'bold' },
  adminProfileUsername: { fontSize: 12 },
  adminProfileRole: { fontSize: 12, fontWeight: '500' },
  adminProfileDetails: { borderRadius: 12, padding: 16, elevation: 2 },
  adminProfileDetail: { paddingVertical: 10, borderBottomWidth: 1 },
  adminProfileDetailLabel: { fontSize: 12 },
  adminProfileDetailValue: { fontSize: 14, fontWeight: '500' },
  adminProfileDivider: { height: 1 },
  adminProfileStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adminProfileStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  adminProfileStatusText: { fontSize: 14, fontWeight: '500' },

  adminHistoryContainer: { flex: 1 },
  adminHistoryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  adminHistoryFilters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  adminHistoryFilter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  adminHistoryFilterActive: { backgroundColor: '#2563EB' },
  adminHistoryFilterText: { fontSize: 12 },
  adminHistoryFilterTextActive: { color: '#fff' },
  adminHistoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, elevation: 1 },
  adminHistoryItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminHistoryAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  adminHistoryAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#2563EB' },
  adminHistoryName: { fontSize: 14, fontWeight: '500' },
  adminHistoryRole: { fontSize: 11 },
  adminHistoryItemRight: { alignItems: 'flex-end' },
  adminHistoryDate: { fontSize: 12 },
  adminHistoryTime: { fontSize: 11 },
  adminHistoryStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  adminHistoryStatusText: { fontSize: 10, fontWeight: '500' },

  adminSettingItem: { borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  adminSettingLabel: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  adminSettingOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  adminSettingOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  adminSettingOptionActive: { backgroundColor: '#EBF5FF', borderColor: '#2563EB' },
  adminSettingOptionText: { fontSize: 14 },
  adminSettingOptionTextActive: { color: '#2563EB', fontWeight: '500' },

  // ===== Attendance Styles =====
  attendanceContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  attendanceCenter: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, elevation: 3 },
  attendanceCenterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  attendanceCenterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attendanceCenterTitle: { fontSize: 18, fontWeight: 'bold' },
  attendanceCenterBadge: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  attendanceCenterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  attendanceStatusCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  attendanceStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  attendanceStatusLabel: { fontSize: 13, fontWeight: '500' },
  attendanceStatusValueContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, gap: 6 },
  attendanceStatusDot: { width: 8, height: 8, borderRadius: 4 },
  attendanceStatusValue: { fontSize: 14, fontWeight: '600' },
  attendanceScheduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1 },
  attendanceScheduleLabel: { fontSize: 12 },
  attendanceScheduleValue: { fontSize: 13, fontWeight: '500' },

  actionButtons: { flexDirection: 'row', gap: 16 },
  timeInButton: { flex: 1, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  timeOutButton: { flex: 1, backgroundColor: '#EF4444', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  buttonIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  buttonSubtext: { color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 2 },

  historyStatsBar: { flexDirection: 'row', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, marginBottom: 16, elevation: 2 },
  historyStatItem: { flex: 1, alignItems: 'center' },
  historyStatValue: { fontSize: 18, fontWeight: 'bold' },
  historyStatLabel: { fontSize: 10, marginTop: 4 },
  historyStatDivider: { width: 1 },
  monthSelectorContainer: { marginBottom: 16 },
  monthSelectorLabel: { fontSize: 12, marginBottom: 8, fontWeight: '500' },
  monthScroll: { flexDirection: 'row' },
  monthChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  monthChipActive: { backgroundColor: '#2563EB' },
  monthChipText: { fontSize: 14, fontWeight: '500' },
  monthChipTextActive: { color: '#fff' },
  historyList: { marginBottom: 16 },
  recordCard: { borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  recordSelfie: { width: 60, height: 60, borderRadius: 12, marginRight: 15 },
  recordSelfiePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  recordInfo: { flex: 1 },
  recordDate: { fontSize: 14, fontWeight: '600' },
  recordTime: { fontSize: 12, marginTop: 2 },
  recordTypeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6, gap: 4 },
  recordTypeText: { fontSize: 11, fontWeight: '600' },
  recordIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  // ===== Request Styles =====
  requestContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  requestStatsBar: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  requestStatItem: { flex: 1, alignItems: 'center' },
  requestStatValue: { fontSize: 22, fontWeight: 'bold' },
  requestStatLabel: { fontSize: 11, marginTop: 4 },
  requestStatDivider: { width: 1 },
  leaveBalanceCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  leaveBalanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  leaveBalanceTitle: { fontSize: 14, fontWeight: '600' },
  leaveBalanceRow: { flexDirection: 'row', justifyContent: 'space-around' },
  leaveBalanceItem: { alignItems: 'center' },
  leaveBalanceValue: { fontSize: 24, fontWeight: 'bold' },
  leaveBalanceLabel: { fontSize: 11, marginTop: 2 },
  leaveBalanceDivider: { width: 1 },
  leaveWarningContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, marginBottom: 16 },
  leaveWarningText: { fontSize: 13, fontWeight: '500' },
  createRequestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', borderRadius: 12, padding: 14, marginBottom: 16, gap: 8 },
  createRequestBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  requestFilterTabs: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  requestFilterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  requestFilterTabActive: { backgroundColor: '#2563EB' },
  requestFilterTabText: { fontSize: 14, fontWeight: '500' },
  requestFilterTabTextActive: { color: '#fff' },
  requestCard: { borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  requestCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  requestTypeText: { fontSize: 12, fontWeight: '600' },
  requestStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  requestStatusDot: { width: 6, height: 6, borderRadius: 3 },
  requestStatusText: { fontSize: 10, fontWeight: '600' },
  requestCardDates: { marginBottom: 6 },
  requestDateText: { fontSize: 13 },
  requestTimeText: { fontSize: 12, marginTop: 2 },
  requestReason: { fontSize: 14 },
  medicalCertBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 8, backgroundColor: '#EBF5FF', borderRadius: 8 },
  medicalCertText: { fontSize: 12, color: '#2563EB' },
  requestCancelBtn: { marginTop: 8, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },
  requestCancelText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },

  // ===== Schedule Styles =====
  scheduleContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  scheduleCalendar: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  scheduleMonthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  scheduleNavBtn: { padding: 8 },
  scheduleMonthText: { fontSize: 18, fontWeight: 'bold' },
  scheduleWeekDays: { flexDirection: 'row', marginBottom: 8 },
  scheduleWeekDayText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '500' },
  scheduleDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  scheduleDayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  scheduleDayCellSelected: { backgroundColor: '#EBF5FF' },
  scheduleDayText: { fontSize: 14 },
  scheduleDayToday: { backgroundColor: '#2563EB', color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  scheduleDayEmpty: { fontSize: 14 },
  scheduleDayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  scheduleDetails: { borderRadius: 16, padding: 16, elevation: 2, marginBottom: 16 },
  scheduleDetailsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  scheduleDetailCard: { borderRadius: 12, padding: 16 },
  scheduleDetailDate: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  scheduleDetailContent: { gap: 8 },
  scheduleDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleDetailText: { fontSize: 14 },
  scheduleDetailStatus: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
  scheduleDetailStatusText: { fontSize: 13, fontWeight: '600' },
  scheduleNoDetail: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  scheduleNoDetailText: { fontSize: 14 },

  // ===== Profile Styles =====
  profileContainer: { flex: 1 },
  profileContent: { padding: 16 },
  profileCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 2 },
  profileAvatarContainer: { marginBottom: 16, position: 'relative' },
  profileAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#2563EB' },
  profileAvatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#2563EB' },
  profileAvatarInitial: { fontSize: 40, fontWeight: 'bold', color: '#2563EB' },
  profileCameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563EB', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  profileFullName: { fontSize: 22, fontWeight: 'bold' },
  profileEmployeeId: { fontSize: 14, marginTop: 4 },
  profilePosition: { fontSize: 14, marginTop: 4 },
  profileInfoCard: { borderRadius: 16, padding: 16, elevation: 2 },
  profileInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  profileInfoHeaderTitle: { fontSize: 16, fontWeight: 'bold' },
  profileInfoEditBtn: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  profileInfoEditActions: { flexDirection: 'row', gap: 8 },
  profileInfoCancelBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F3F4F6' },
  profileInfoCancelText: { fontSize: 12, color: '#6B7280' },
  profileInfoSaveBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#2563EB' },
  profileInfoSaveText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  profileInfoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  profileInfoText: { marginLeft: 12, flex: 1 },
  profileInfoLabel: { fontSize: 12 },
  profileInfoValue: { fontSize: 14, fontWeight: '500' },
  profileInfoInput: { fontSize: 14, fontWeight: '500', paddingVertical: 4, paddingHorizontal: 0, borderBottomWidth: 1 },
  profileDivider: { height: 1 },
  profileLogoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, padding: 16, marginTop: 16, gap: 8 },
  profileLogoutText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },

  // ===== Theme Toggle =====
  themeToggleCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  themeToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeToggleLabel: { fontSize: 16, fontWeight: '500' },
  themeToggleSubtext: { fontSize: 12, marginTop: 8 },

  // ===== Bottom Navigation =====
  bottomNav: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 8, paddingHorizontal: 4, elevation: 4 },
  bottomNavItem: { flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative' },
  bottomNavIconWrapper: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  bottomNavIconWrapperActive: { backgroundColor: '#2563EB' },
  bottomNavLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  bottomNavLabelActive: { color: '#2563EB', fontWeight: '600' },
  bottomNavActiveIndicator: { position: 'absolute', top: -1, width: 20, height: 3, backgroundColor: '#2563EB', borderRadius: 2 },

  // ===== Drawer Styles =====
  drawerOverlay: { flex: 1 },
  drawerOverlayTouch: { flex: 1 },
  drawerContainer: { height: '100%', position: 'absolute', left: 0, top: 0, width: width * 0.75 },
  drawerSafeArea: { flex: 1 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 40 : 20 },
  drawerProfile: { flexDirection: 'row', alignItems: 'center' },
  drawerAvatar: { width: 48, height: 48, borderRadius: 24 },
  drawerAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  drawerAvatarInitial: { fontSize: 20, fontWeight: 'bold', color: '#2563EB' },
  drawerProfileInfo: { marginLeft: 12 },
  drawerName: { fontSize: 16, fontWeight: 'bold' },
  drawerId: { fontSize: 12 },
  drawerCloseBtn: { padding: 4 },
  drawerDivider: { height: 1, marginHorizontal: 20 },
  drawerMenu: { padding: 12 },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 4 },
  drawerMenuItemActive: { backgroundColor: '#EBF5FF' },
  drawerMenuItemText: { fontSize: 16, marginLeft: 14 },
  drawerMenuItemTextActive: { color: '#2563EB', fontWeight: '500' },
  drawerMenuItemActiveIndicator: { width: 4, height: 24, backgroundColor: '#2563EB', borderRadius: 2, marginLeft: 'auto' },
  drawerFooter: { padding: 20, borderTopWidth: 1 },
  drawerLogoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  drawerLogoutText: { fontSize: 16, color: '#EF4444', marginLeft: 14 },

  // ===== Camera Styles =====
  cameraOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  cameraTopBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  cameraCloseButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  cameraTypeBadge: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cameraInstructions: { position: 'absolute', top: Platform.OS === 'ios' ? 120 : 100, left: 0, right: 0, alignItems: 'center' },
  cameraInstructionText: { backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, fontSize: 14 },
  captureButton: { alignSelf: 'center', marginBottom: 30, width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  processingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#fff', marginTop: 12, fontSize: 16 },
  cameraPermissionView: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  permissionText: { color: '#fff', marginTop: 12, fontSize: 14 },
  permissionButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 10 },
  permissionButtonText: { color: '#fff', fontWeight: '600' },

  // ===== Confirmation Styles =====
  confirmationContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  confirmationScroll: { paddingBottom: 30 },
  confirmationClose: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 20, zIndex: 10 },
  confirmationTitle: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginTop: 80, marginBottom: 30 },
  confirmationImageContainer: { alignItems: 'center', marginBottom: 20 },
  confirmationImage: { width: width - 80, height: width - 80, borderRadius: 20, borderWidth: 3, borderColor: '#2563EB' },
  verifiedBadge: { position: 'absolute', bottom: -10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8, elevation: 3 },
  verifiedText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  confirmationDetails: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 16, elevation: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  detailText: { marginLeft: 12, fontSize: 14, color: '#1F2937', flex: 1 },
  confirmButton: { backgroundColor: '#2563EB', marginHorizontal: 20, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmButtonText: { fontSize: 18, fontWeight: '600', color: '#fff' },

  // ===== Result Modal =====
  resultOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  resultModal: { borderRadius: 24, padding: 24, width: width - 40, maxWidth: 400 },
  resultHeader: { alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 12 },
  resultBody: { marginBottom: 20 },
  resultDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  resultDetailLabel: { fontSize: 14 },
  resultDetailValue: { fontSize: 14, fontWeight: '500' },
  resultButton: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  resultButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ===== Modal Styles =====
  modalContainer: { flex: 1 },
  modalSafeArea: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalCloseBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  formSection: { marginBottom: 24 },
  formLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  typeScroll: { flexDirection: 'row' },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, marginRight: 12, gap: 8 },
  typeChipActive: { backgroundColor: '#2563EB' },
  typeChipText: { fontSize: 14, fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  dateButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  dateButtonText: { fontSize: 16, flex: 1 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, padding: 16, gap: 8, borderStyle: 'dashed' },
  uploadBtnText: { fontSize: 14, fontWeight: '500' },
  medicalPreview: { width: 80, height: 80, borderRadius: 8, marginTop: 8 },
  reasonInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 30 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  // ===== Loading & Empty States =====
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyStateText: { fontSize: 16, marginTop: 12 },
  emptyStateSubtext: { fontSize: 12, marginTop: 8 },
});



// LATEST UPDATE 09/22/25 — v13 (added AWOL & EA counters to history stats bar)