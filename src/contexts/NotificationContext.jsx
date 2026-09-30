// src/contexts/NotificationContext.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    } else {
      loadLocalNotifications();
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const loadNotifications = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await notificationAPI.getNotifications({ per_page: 50 });
      if (response.data.success) {
        const payload = response.data.data;
        const items = payload.data || payload || [];
        setNotifications(items);
        setUnreadCount(
          payload.unread_count ?? items.filter((n) => !n.read_at && !n.read).length
        );
        setLastRefresh(Date.now());
      }
    } catch (error) {
      console.log('Error loading notifications:', error);
      if (!silent) loadLocalNotifications();
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const loadLocalNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem('@notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifications(parsed);
        setUnreadCount(parsed.filter((n) => !n.read).length);
      }
    } catch (error) {
      console.error('Failed to load local notifications:', error);
    }
  };

  const saveLocalNotifications = async (notifs) => {
    try {
      await AsyncStorage.setItem('@notifications', JSON.stringify(notifs));
    } catch (error) {
      console.error('Failed to save local notifications:', error);
    }
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now().toString(),
      read: false,
      created_at: new Date().toISOString(),
      ...notification,
    };
    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    setUnreadCount((prev) => prev + 1);
    saveLocalNotifications(updated);
  };

  const markAsRead = async (notificationId) => {
    try {
      if (isAuthenticated) {
        await notificationAPI.markAsRead(notificationId);
      }
      const updated = notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
      );
      setNotifications(updated);
      setUnreadCount(updated.filter((n) => !n.read && !n.read_at).length);
      saveLocalNotifications(updated);
    } catch (error) {
      console.log('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (isAuthenticated) {
        await notificationAPI.markAllAsRead();
      }
      const updated = notifications.map((n) => ({
        ...n,
        read: true,
        read_at: new Date().toISOString(),
      }));
      setNotifications(updated);
      setUnreadCount(0);
      saveLocalNotifications(updated);
    } catch (error) {
      console.log('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      if (isAuthenticated) {
        await notificationAPI.deleteNotification(notificationId);
      }
      const updated = notifications.filter((n) => n.id !== notificationId);
      setNotifications(updated);
      setUnreadCount(updated.filter((n) => !n.read && !n.read_at).length);
      saveLocalNotifications(updated);
    } catch (error) {
      console.log('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    try {
      if (isAuthenticated) {
        await notificationAPI.clearAll();
      }
      setNotifications([]);
      setUnreadCount(0);
      saveLocalNotifications([]);
    } catch (error) {
      console.log('Error clearing notifications:', error);
    }
  };

  const refreshNotifications = () => {
    if (isAuthenticated) {
      loadNotifications();
    }
  };

  const priorityNotifications = notifications.filter(
    (n) => n.priority === 'high' || n.priority === 'critical'
  );
  const priorityUnreadCount = priorityNotifications.filter(
    (n) => !n.read && !n.read_at
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        priorityNotifications,
        priorityUnreadCount,
        isLoading,
        lastRefresh,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};