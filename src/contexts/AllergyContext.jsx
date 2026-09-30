// src/contexts/AllergyContext.jsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { allergyAPI } from '../services/api';
import { useAuth } from './AuthContext';

const AllergyContext = createContext(null);

const STORAGE_KEY = '@customer_allergies';

export const AllergyProvider = ({ children }) => {
  const { user, isAuthenticated, isGuest } = useAuth();

  const [masterList, setMasterList] = useState([]);
  const [myAllergies, setMyAllergies] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- Load master list once (with one retry) ----
  useEffect(() => {
    let cancelled = false;

    const fetchMaster = async (attempt = 1) => {
      try {
        const res = await allergyAPI.getMasterList();
        const payload = res?.data?.data ?? res?.data ?? [];
        if (!cancelled && Array.isArray(payload) && payload.length > 0) {
          setMasterList(payload);
          return;
        }
        // Empty array response — retry once.
        if (attempt < 2) {
          setTimeout(() => !cancelled && fetchMaster(attempt + 1), 800);
        }
      } catch (e) {
        console.log(`⚠️ Master allergen fetch failed (attempt ${attempt}):`, e?.message);
        if (attempt < 2) {
          setTimeout(() => !cancelled && fetchMaster(attempt + 1), 800);
        }
      }
    };

    fetchMaster();

    return () => { cancelled = true; };
  }, []);

  // ---- Load customer's allergies when authenticated ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isAuthenticated && !isGuest) {
          const res = await allergyAPI.getMyAllergies();
          const payload = res?.data?.data ?? res?.data ?? [];
          const list = Array.isArray(payload) ? payload : [];
          if (!cancelled) setMyAllergies(list);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } else {
          // Guest — clear from memory but keep cached copy in storage.
          if (!cancelled) setMyAllergies([]);
        }
      } catch (e) {
        console.log('⚠️ Failed to load customer allergies:', e?.message);
        // Fall back to the last known value.
        try {
          const cached = await AsyncStorage.getItem(STORAGE_KEY);
          if (!cancelled && cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setMyAllergies(parsed);
          }
        } catch { /* ignore */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isGuest, user?.id]);

  // ---- Save selection ----
  const saveAllergies = useCallback(async (next) => {
    if (!isAuthenticated || isGuest) {
      return { success: false, message: 'Please login to save allergies.' };
    }
    try {
      const normalized = Array.from(new Set(
        (next || []).map((a) => String(a).toLowerCase().trim()).filter(Boolean)
      ));

      const res = await allergyAPI.updateMyAllergies(normalized);
      const payload = res?.data?.data ?? res?.data ?? normalized;

      setMyAllergies(Array.isArray(payload) ? payload : normalized);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.isArray(payload) ? payload : normalized)
      );

      return { success: true, data: payload };
    } catch (e) {
      return {
        success: false,
        message: e?.response?.data?.message || e?.message || 'Failed to save allergies.',
      };
    }
  }, [isAuthenticated, isGuest]);

  const value = useMemo(() => ({
    masterList,
    myAllergies,
    loading,
    saveAllergies,
    refresh: async () => {
      try {
        const res = await allergyAPI.getMyAllergies();
        const payload = res?.data?.data ?? res?.data ?? [];
        setMyAllergies(Array.isArray(payload) ? payload : []);
      } catch { /* silent */ }
    },
  }), [masterList, myAllergies, loading, saveAllergies]);

  return (
    <AllergyContext.Provider value={value}>
      {children}
    </AllergyContext.Provider>
  );
};

export const useAllergies = () => {
  const ctx = useContext(AllergyContext);
  if (!ctx) throw new Error('useAllergies must be used inside AllergyProvider');
  return ctx;
};