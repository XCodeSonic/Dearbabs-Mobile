// src/contexts/AuthContext.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

const ATTENDANCE_ROLE = 'attendance_manager';

const normalizeRole = (role = '') => String(role || '').trim().toLowerCase();
const roleCanAccessAttendance = (role = '') =>
  ['admin', 'super-admin', 'administrator'].includes(normalizeRole(role));

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [attendanceRole, setAttendanceRole] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const generateFourDigitId = (id) => {
    if (id && !isNaN(parseInt(id))) {
      return parseInt(id).toString().padStart(4, '0');
    }
    return Math.floor(1 + Math.random() * 9999).toString().padStart(4, '0');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await loadStoredUser();
        await checkGuestMode();
      } catch (error) {
        console.log('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    initializeAuth();
  }, []);

  const loadStoredUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      const token = await AsyncStorage.getItem('@auth_token');
      const role = await AsyncStorage.getItem('@user_role');
      const storedAttendanceRole = await AsyncStorage.getItem('@attendance_role');

      if (userData && token) {
        const parsedUser = JSON.parse(userData);
        const restoredAttendanceRole = storedAttendanceRole || parsedUser.attendance_role || null;
        setUser({
          ...parsedUser,
          attendance_role: restoredAttendanceRole,
          canAccessAttendance: !!restoredAttendanceRole,
        });
        setUserRole(role || parsedUser.role || 'customer');
        setAttendanceRole(restoredAttendanceRole);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsGuest(false);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Error loading user:', error);
      return false;
    }
  };

  const checkGuestMode = async () => {
    try {
      const guestMode = await AsyncStorage.getItem('@is_guest');
      if (guestMode === 'true' && !user) {
        setIsGuest(true);
      }
    } catch (error) {
      console.log('Error checking guest mode:', error);
    }
  };

  const setGuestMode = async () => {
    try {
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      await AsyncStorage.removeItem('@user_role');
      await AsyncStorage.removeItem('@attendance_role');
      await AsyncStorage.setItem('@is_guest', 'true');
      await AsyncStorage.removeItem('@guest_cart_items');

      delete api.defaults.headers.common['Authorization'];

      setIsGuest(true);
      setUser(null);
      setUserRole(null);
      setAttendanceRole(null);

      return { success: true };
    } catch (error) {
      console.log('Error setting guest mode:', error);
      return { success: false };
    }
  };

  // ═══════════════════════════════════════════════════════════
  // LOGIN — with SPECIFIC error codes for the UI to map
  // ═══════════════════════════════════════════════════════════
  const login = async (emailOrUsername, password, role = 'customer') => {
    try {
      console.log('🔐 Attempting login with:', { emailOrUsername, role });

      const response = await api.post('/v1/auth/login', {
        userId: emailOrUsername,
        password: password,
        role: role,
      });

      console.log('📥 Login response:', response.data);

      if (response.data && response.data.success === true) {
        const { token, user: userData, role: userRole } = response.data.data;

        if (!token) {
          return {
            success: false,
            error_code: 'NO_TOKEN',
            field: 'general',
            message: 'No token received from server. Please try again.',
          };
        }

        const serverRole = userData.role || userRole || role;
        const hasAttendanceAccess =
          roleCanAccessAttendance(serverRole) ||
          !!userData.canAccessAttendance ||
          !!userData.attendance_role;

        const formattedUser = {
          id: userData.id,
          user_id: userData.user_id || userData.id,
          username: userData.username || emailOrUsername,
          full_name: userData.full_name || emailOrUsername,
          name: userData.full_name || emailOrUsername,
          email: userData.email || emailOrUsername,
          phone_number: userData.phone_number || null,
          phone: userData.phone || null,
          role: serverRole === 'super-admin' ? 'admin' : serverRole,
          attendance_role: hasAttendanceAccess ? ATTENDANCE_ROLE : null,
          canAccessAttendance: hasAttendanceAccess,
          profile_photo: userData.profile_photo || null,
          profile_photo_url: userData.profile_photo_url || userData.profile_photo || null,
          avatar: userData.profile_photo_url || userData.profile_photo || null,
          customer_id: userData.customer_id ? generateFourDigitId(userData.customer_id) : null,
          is_active: userData.is_active !== undefined ? userData.is_active : true,
          is_verified: userData.is_verified || false,
          created_at: userData.created_at,
          updated_at: userData.updated_at,
        };

        await AsyncStorage.setItem('@auth_token', token);
        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        await AsyncStorage.setItem('@user_role', formattedUser.role);
        if (hasAttendanceAccess) {
          await AsyncStorage.setItem('@attendance_role', ATTENDANCE_ROLE);
        } else {
          await AsyncStorage.removeItem('@attendance_role');
        }
        await AsyncStorage.removeItem('@is_guest');
        await AsyncStorage.removeItem('@guest_cart_items');

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setUser(formattedUser);
        setUserRole(formattedUser.role);
        setAttendanceRole(formattedUser.attendance_role);
        setIsGuest(false);

        return {
          success: true,
          user: formattedUser,
          role: formattedUser.role,
          token: token,
        };
      }

      return {
        success: false,
        error_code: response.data?.error_code || 'UNKNOWN',
        field: response.data?.field || 'general',
        message: response.data?.message || 'Login failed',
      };
    } catch (error) {
      console.log('❌ Login error:', error);

      // ── The API interceptor may return a formatted object ──
      if (error?.networkError || error?.message?.toLowerCase?.().includes('network')) {
        return {
          success: false,
          error_code: 'NETWORK_ERROR',
          field: 'general',
          message: 'Network error. Please check your internet connection.',
        };
      }

      if (error?.code === 'ECONNABORTED') {
        return {
          success: false,
          error_code: 'TIMEOUT',
          field: 'general',
          message: 'Connection timeout. Please check your internet connection.',
        };
      }

      if (error?.response) {
        const data = error.response.data || {};
        return {
          success: false,
          error_code: data.error_code || 'UNKNOWN',
          field: data.field || 'general',
          message: data.message || 'Login failed',
          attempts_left: data.attempts_left,
          max_attempts: data.max_attempts,
          locked_until: data.locked_until,
          seconds_left: data.seconds_left,
          lockout_minutes: data.lockout_minutes,
        };
      }

      return {
        success: false,
        error_code: 'UNKNOWN',
        field: 'general',
        message: 'Something went wrong. Please try again.',
      };
    }
  };

  // ═══════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════
  const register = async (userData) => {
    try {
      console.log('📝 Attempting registration with:', userData);

      const response = await api.post('/v1/register', {
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        username: userData.username || userData.email,
        email: userData.email,
        password: userData.password,
        password_confirmation: userData.password_confirmation || userData.password,
        phone: userData.phone_number || null,
        address: userData.address || null,
      });

      console.log('📥 Registration response:', response.data);

      if (response.data && response.data.success === true) {
        const { token, user, customer } = response.data.data;

        const formattedUser = {
          id: user.id,
          user_id: user.user_id || user.id,
          username: user.username || userData.username || userData.email,
          full_name: user.full_name || `${userData.first_name} ${userData.last_name}`,
          name: user.full_name || `${userData.first_name} ${userData.last_name}`,
          email: user.email || userData.email,
          phone_number: user.phone_number || userData.phone_number || null,
          phone: user.phone || userData.phone_number || null,
          role: 'customer',
          attendance_role: null,
          canAccessAttendance: false,
          profile_photo: user.profile_photo || null,
          profile_photo_url: user.profile_photo_url || user.profile_photo || null,
          avatar: user.profile_photo_url || user.profile_photo || null,
          customer_id: customer?.customer_id ? generateFourDigitId(customer.customer_id) : null,
          is_active: true,
          is_verified: false,
          created_at: user.created_at,
        };

        if (token) {
          await AsyncStorage.setItem('@auth_token', token);
          await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
          await AsyncStorage.setItem('@user_role', 'customer');
          await AsyncStorage.removeItem('@attendance_role');
          await AsyncStorage.removeItem('@is_guest');
          await AsyncStorage.removeItem('@guest_cart_items');

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(formattedUser);
          setUserRole('customer');
          setAttendanceRole(null);
          setIsGuest(false);
        }

        return { success: true, user: formattedUser };
      }

      return {
        success: false,
        message: response.data?.message || 'Registration failed',
        errors: response.data?.errors || null,
      };
    } catch (error) {
      console.log('❌ Registration error:', error);

      let errorMessage = 'Registration failed. Please try again.';
      let fieldErrors = null;

      if (error?.response) {
        if (error.response.data?.errors) {
          fieldErrors = error.response.data.errors;
          const firstError = Object.values(fieldErrors)[0]?.[0];
          if (firstError) errorMessage = firstError;
        } else {
          errorMessage = error.response.data?.message || 'Registration validation failed';
        }
      } else if (error?.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      } else if (error?.message === 'Network Error' || error?.networkError) {
        errorMessage = 'Cannot connect to server. Please ensure backend is running.';
      }

      return { success: false, message: errorMessage, errors: fieldErrors };
    }
  };

  // ═══════════════════════════════════════════════════════════
  // SOCIAL LOGIN
  // ═══════════════════════════════════════════════════════════
  const socialLogin = async (provider, tokenData = {}) => {
    try {
      const endpoint =
        provider === 'google' ? '/v1/auth/google' : '/v1/auth/facebook';

      const payload =
        provider === 'google'
          ? {
              id_token: tokenData.idToken || tokenData.accessToken || '',
              email: tokenData.email || null,
              name: tokenData.name || null,
              google_id: tokenData.googleId || null,
              avatar: tokenData.avatar || null,
            }
          : {
              access_token: tokenData.accessToken || '',
              email: tokenData.email || null,
              name: tokenData.name || null,
              facebook_id: tokenData.facebookId || null,
              avatar: tokenData.avatar || null,
            };

      console.log(`🔐 ${provider} social login`);

      const response = await api.post(endpoint, payload);
      const data = response.data;

      if (data && data.success === true && data.data?.token) {
        const { token, user: userData, role: userRole, is_new_user } = data.data;

        const serverRole = userData.role || userRole || 'customer';
        const hasAttendanceAccess =
          roleCanAccessAttendance(serverRole) ||
          !!userData.canAccessAttendance ||
          !!userData.attendance_role;

        const formattedUser = {
          id: userData.id,
          user_id: userData.user_id || userData.id,
          username: userData.username || userData.email,
          full_name: userData.full_name || userData.email,
          name: userData.full_name || userData.email,
          email: userData.email,
          phone_number: userData.phone_number || null,
          phone: userData.phone || null,
          role: serverRole === 'super-admin' ? 'admin' : serverRole,
          attendance_role: hasAttendanceAccess ? ATTENDANCE_ROLE : null,
          canAccessAttendance: hasAttendanceAccess,
          profile_photo: userData.profile_photo || null,
          profile_photo_url: userData.profile_photo_url || userData.profile_photo || null,
          avatar: userData.profile_photo_url || userData.profile_photo || null,
          customer_id: userData.customer_id ? generateFourDigitId(userData.customer_id) : null,
          is_active: userData.is_active !== undefined ? userData.is_active : true,
          is_verified: userData.is_verified || false,
          created_at: userData.created_at,
          updated_at: userData.updated_at,
        };

        await AsyncStorage.setItem('@auth_token', token);
        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        await AsyncStorage.setItem('@user_role', formattedUser.role);
        if (hasAttendanceAccess) {
          await AsyncStorage.setItem('@attendance_role', ATTENDANCE_ROLE);
        } else {
          await AsyncStorage.removeItem('@attendance_role');
        }
        await AsyncStorage.removeItem('@is_guest');
        await AsyncStorage.removeItem('@guest_cart_items');

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setUser(formattedUser);
        setUserRole(formattedUser.role);
        setAttendanceRole(formattedUser.attendance_role);
        setIsGuest(false);

        return {
          success: true,
          user: formattedUser,
          role: formattedUser.role,
          token: token,
          isNewUser: !!is_new_user,
        };
      }

      return {
        success: false,
        message: data?.message || `${provider} login failed`,
      };
    } catch (error) {
      console.log(`❌ ${provider} login error:`, error);

      let errorMessage = `${provider} login failed. Please try again.`;

      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please ensure backend is running.';
      }

      return { success: false, message: errorMessage };
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FORGOT PASSWORD FLOW
  // ═══════════════════════════════════════════════════════════
  const forgotPassword = async (userId, email) => {
    try {
      console.log('📧 Forgot password for:', userId, email);

      const response = await api.post('/v1/auth/forgot-password', {
        user_id: userId,
        email: email,
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          message: response.data.message || 'OTP sent to your email',
          data: response.data.data,
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Failed to send OTP',
        errors: response.data?.errors,
      };
    } catch (error) {
      console.log('❌ Forgot password error:', error);

      let errorMessage = 'Failed to send OTP. Please try again.';
      let fieldErrors = null;

      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        fieldErrors = error.response.data?.errors;
        if (fieldErrors) {
          const firstError = Object.values(fieldErrors)[0]?.[0];
          if (firstError) errorMessage = firstError;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      }

      return { success: false, message: errorMessage, errors: fieldErrors };
    }
  };

  const verifyResetOtp = async (userId, otpCode) => {
    try {
      const response = await api.post('/v1/auth/verify-otp', {
        user_id: userId,
        otp_code: otpCode,
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          message: response.data.message || 'OTP verified',
          data: response.data.data,
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Invalid OTP',
      };
    } catch (error) {
      console.log('❌ Verify OTP error:', error);

      let errorMessage = 'Invalid or expired OTP.';
      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        const fieldErrors = error.response.data?.errors;
        if (fieldErrors) {
          const firstError = Object.values(fieldErrors)[0]?.[0];
          if (firstError) errorMessage = firstError;
        }
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      }

      return { success: false, message: errorMessage };
    }
  };

  const resetPassword = async (userId, resetToken, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/v1/auth/reset-password', {
        user_id: userId,
        reset_token: resetToken,
        new_password: newPassword,
        password_confirmation: confirmPassword,
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          message: response.data.message || 'Password reset successfully',
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Password reset failed',
      };
    } catch (error) {
      console.log('❌ Reset password error:', error);

      let errorMessage = 'Password reset failed.';
      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        const fieldErrors = error.response.data?.errors;
        if (fieldErrors) {
          const firstError = Object.values(fieldErrors)[0]?.[0];
          if (firstError) errorMessage = firstError;
        }
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      }

      return { success: false, message: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await api.post('/v1/auth/logout').catch(() => {});
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      await AsyncStorage.removeItem('@user_role');
      await AsyncStorage.removeItem('@attendance_role');
      await AsyncStorage.removeItem('@is_guest');
      await AsyncStorage.removeItem('@guest_cart_items');
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('currentEmployee');
      await AsyncStorage.removeItem('recentEmployeeIds');

      delete api.defaults.headers.common['Authorization'];

      setUser(null);
      setUserRole(null);
      setAttendanceRole(null);
      setIsGuest(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/v1/auth/profile', profileData);

      if (response.data && response.data.success) {
        const updatedUser = response.data.data.user || response.data.data;
        const formattedUser = {
          ...user,
          ...updatedUser,
          full_name: updatedUser.full_name || updatedUser.name || user?.full_name,
          name: updatedUser.full_name || updatedUser.name || user?.name,
          email: updatedUser.email || user?.email,
          phone_number: updatedUser.phone_number || updatedUser.phone || user?.phone_number,
          profile_photo: updatedUser.profile_photo || user?.profile_photo,
          profile_photo_url:
            updatedUser.profile_photo_url || updatedUser.profile_photo || user?.profile_photo_url,
          avatar:
            updatedUser.profile_photo_url || updatedUser.profile_photo || user?.avatar,
        };

        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        setUser(formattedUser);

        return { success: true, user: formattedUser };
      }

      return { success: false, message: response.data?.message || 'Update failed' };
    } catch (error) {
      console.log('Update profile error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Update failed',
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await api.put('/v1/auth/change-password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPassword,
      });

      return {
        success: response.data?.success || false,
        message: response.data?.message || 'Password changed',
      };
    } catch (error) {
      console.log('Change password error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Password change failed',
      };
    }
  };

  const updateProfilePhoto = async (imageUri) => {
    try {
      const formData = new FormData();
      formData.append('profile_photo', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile_photo.jpg',
      });

      const response = await api.post('/v1/auth/profile-photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.success) {
        const updatedUser = response.data.data.user || response.data.data;
        const formattedUser = {
          ...user,
          profile_photo: updatedUser.profile_photo,
          profile_photo_url: updatedUser.profile_photo_url || updatedUser.profile_photo,
          avatar: updatedUser.profile_photo_url || updatedUser.profile_photo,
        };

        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        setUser(formattedUser);

        return { success: true };
      }

      return { success: false, message: response.data?.message || 'Photo update failed' };
    } catch (error) {
      console.log('Update photo error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Photo update failed',
      };
    }
  };

  const refreshUserData = async () => {
    try {
      const response = await api.get('/v1/auth/user');
      if (response.data && response.data.success) {
        const userData = response.data.data.user || response.data.data;
        const formattedUser = {
          ...user,
          ...userData,
          full_name: userData.full_name || userData.name || user?.full_name,
          name: userData.full_name || userData.name || user?.name,
          profile_photo: userData.profile_photo || user?.profile_photo,
          profile_photo_url:
            userData.profile_photo_url || userData.profile_photo || user?.profile_photo_url,
          avatar:
            userData.profile_photo_url || userData.profile_photo || user?.avatar,
        };
        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        setUser(formattedUser);
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.log('Refresh error:', error);
      return { success: false };
    }
  };

  const checkGuestForAction = (actionName) => {
    if (isGuest) {
      console.log(`⚠️ Guest mode: Cannot ${actionName}`);
      return false;
    }
    return true;
  };

  const isGuestMode = () => isGuest;
  const getUserId = () => user?.id || null;
  const hasAttendanceAccess =
    !!attendanceRole ||
    !!user?.canAccessAttendance ||
    user?.attendance_role === ATTENDANCE_ROLE ||
    roleCanAccessAttendance(userRole || user?.role);

  const value = {
    user,
    userRole,
    attendanceRole,
    hasAttendanceAccess,
    isLoading,
    isGuest,
    isInitialized,
    setGuestMode,
    login,
    register,
    socialLogin,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    logout,
    updateProfile,
    changePassword,
    updateProfilePhoto,
    refreshUserData,
    checkGuestForAction,
    isGuestMode,
    getUserId,
    isAuthenticated: !!user && !isGuest,
    isAdmin: roleCanAccessAttendance(userRole),
    isCustomer: userRole === 'customer' || userRole === 'CUSTOMER',
    isEmployee: userRole === 'employee' || userRole === 'EMPLOYEE',
    isAttendanceManager: hasAttendanceAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};