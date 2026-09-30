// src/services/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { apiHelpers } from './api';

export const authService = {
  // Login - supports multiple field names
  login: async (credentials) => {
    try {
      // Build payload with multiple field support
      const payload = {
        password: credentials.password,
        role: credentials.role || 'customer',
      };

      // Support multiple field names for email/username
      if (credentials.emailOrUsername) {
        payload.emailOrUsername = credentials.emailOrUsername;
      } else if (credentials.email) {
        payload.email = credentials.email;
      } else if (credentials.username) {
        payload.username = credentials.username;
      } else if (credentials.userId) {
        payload.userId = credentials.userId;
      } else if (credentials.user_id) {
        payload.user_id = credentials.user_id;
      }

      console.log('Login payload:', payload);

      const response = await api.post('/v1/auth/login', payload);
      const data = response.data;
      
      if (data.success && data.data?.token) {
        await AsyncStorage.setItem('@auth_token', data.data.token);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.data.user));
        await AsyncStorage.setItem('@user_role', data.data.role || 'customer');
      }
      
      return {
        success: true,
        data: data.data,
        message: data.message || 'Login successful',
      };
    } catch (error) {
      console.error('Login service error:', error);
      return apiHelpers.handleError(error);
    }
  },
  
  // Register customer
  register: async (data) => {
    try {
      const response = await api.post('/v1/register', data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Logout
  logout: async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch (error) {
      console.log('Logout API error:', error);
    } finally {
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      await AsyncStorage.removeItem('@user_role');
    }
    return { success: true };
  },
  
  // Get current user
  getUser: async () => {
    try {
      const response = await api.get('/v1/auth/user');
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Update profile
  updateProfile: async (data) => {
    try {
      const response = await api.put('/v1/auth/profile', data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Change password
  changePassword: async (data) => {
    try {
      const response = await api.put('/v1/auth/change-password', data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Forgot password
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/v1/auth/forgot-password', { user_id: email });
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Reset password
  resetPassword: async (data) => {
    try {
      const response = await api.post('/v1/auth/reset-password', data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
};