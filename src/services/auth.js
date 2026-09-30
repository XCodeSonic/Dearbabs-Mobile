// src/contexts/AuthContext.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadStoredUser();
    checkGuestMode();
  }, []);

  const loadStoredUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      const token = await AsyncStorage.getItem('@auth_token');
      const role = await AsyncStorage.getItem('@user_role');
      
      if (userData && token) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setUserRole(role);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setIsGuest(false);
      }
    } catch (error) {
      console.log('Error loading user:', error);
    } finally {
      setIsLoading(false);
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
      await AsyncStorage.setItem('@is_guest', 'true');
      setIsGuest(true);
      setUser(null);
      setUserRole(null);
      return { success: true };
    } catch (error) {
      console.log('Error setting guest mode:', error);
      return { success: false };
    }
  };

  const login = async (emailOrUsername, password, role = 'customer') => {
    try {
      // Use the login endpoint from your Laravel API
      const response = await api.post('/v1/auth/login', {
        userId: emailOrUsername,
        password: password,
      });

      if (response.data.success) {
        const { token, user: userData } = response.data.data;
        
        const formattedUser = {
          id: userData.id,
          user_id: userData.user_id || userData.id,
          username: userData.user_id || emailOrUsername,
          full_name: userData.full_name || userData.name || emailOrUsername,
          name: userData.full_name || userData.name || emailOrUsername,
          email: userData.email || emailOrUsername,
          phone_number: userData.phone_number || null,
          role: userData.role || role,
          profile_photo: userData.profile_photo || null,
          avatar: userData.profile_photo || null,
          created_at: userData.created_at,
        };
        
        await AsyncStorage.setItem('@auth_token', token);
        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        await AsyncStorage.setItem('@user_role', formattedUser.role);
        await AsyncStorage.removeItem('@is_guest');
        
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        setUser(formattedUser);
        setUserRole(formattedUser.role);
        setIsGuest(false);
        
        return { success: true, user: formattedUser, role: formattedUser.role };
      }
      
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      console.log('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.message || 'Invalid credentials';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please ensure backend is running.';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      // Use the customer registration endpoint from your Laravel API
      const response = await api.post('/v1/customers/register', {
        first_name: userData.first_name || userData.full_name?.split(' ')[0] || '',
        last_name: userData.last_name || userData.full_name?.split(' ').slice(1).join(' ') || '',
        email: userData.email,
        password: userData.password,
        password_confirmation: userData.password_confirmation,
        phone: userData.phone_number || null,
      });

      console.log('Registration response:', response.data);

      if (response.data.success) {
        const { token, user, customer } = response.data.data;
        
        const formattedUser = {
          id: user.id,
          user_id: user.user_id || user.id,
          username: user.user_id || userData.email,
          full_name: user.full_name || userData.full_name,
          name: user.full_name || userData.full_name,
          email: user.email || userData.email,
          phone_number: user.phone_number || userData.phone_number || null,
          role: 'customer',
          profile_photo: user.profile_photo || null,
          avatar: user.profile_photo || null,
          customer_id: customer?.customer_code || null,
        };
        
        // Store the token for auto-login
        if (token) {
          await AsyncStorage.setItem('@auth_token', token);
          await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
          await AsyncStorage.setItem('@user_role', 'customer');
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(formattedUser);
          setUserRole('customer');
          setIsGuest(false);
        }
        
        return { success: true, user: formattedUser };
      }
      
      return { success: false, message: response.data.message || 'Registration failed' };
    } catch (error) {
      console.log('Registration error:', error);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.message || 'Registration validation failed';
        // Handle validation errors
        if (error.response.data?.errors) {
          const errors = error.response.data.errors;
          const firstError = Object.values(errors)[0]?.[0];
          if (firstError) {
            errorMessage = firstError;
          }
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please ensure backend is running.';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      await AsyncStorage.removeItem('@user_role');
      await AsyncStorage.removeItem('@is_guest');
      
      delete api.defaults.headers.common['Authorization'];
      
      setUser(null);
      setUserRole(null);
      setIsGuest(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/v1/auth/profile', profileData);
      
      if (response.data.success) {
        const updatedUser = response.data.data.user;
        const formattedUser = {
          ...user,
          ...updatedUser,
          full_name: updatedUser.full_name || updatedUser.name,
          name: updatedUser.full_name || updatedUser.name,
          email: updatedUser.email,
          phone_number: updatedUser.phone_number || updatedUser.phone,
          profile_photo: updatedUser.profile_photo,
          avatar: updatedUser.profile_photo,
        };
        
        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        setUser(formattedUser);
        
        return { success: true, user: formattedUser };
      }
      
      return { success: false, message: response.data.message };
    } catch (error) {
      console.log('Update profile error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Update failed' 
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await api.put('/v1/auth/change-password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPassword
      });
      
      return { 
        success: response.data.success, 
        message: response.data.message 
      };
    } catch (error) {
      console.log('Change password error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Password change failed' 
      };
    }
  };

  const refreshUserData = async () => {
    try {
      const response = await api.get('/v1/auth/user');
      if (response.data.success) {
        const userData = response.data.data.user;
        const formattedUser = {
          ...user,
          ...userData,
          full_name: userData.full_name || userData.name,
          name: userData.full_name || userData.name,
        };
        await AsyncStorage.setItem('@user_data', JSON.stringify(formattedUser));
        setUser(formattedUser);
        return { success: true };
      }
    } catch (error) {
      console.log('Refresh error:', error);
      return { success: false };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      isLoading,
      isGuest,
      setGuestMode,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshUserData,
      isAuthenticated: !!user,
      isAdmin: userRole === 'admin' || userRole === 'ADMIN' || userRole === 'administrator',
      isCustomer: userRole === 'customer' || userRole === 'CUSTOMER'
    }}>
      {children}
    </AuthContext.Provider>
  );
};