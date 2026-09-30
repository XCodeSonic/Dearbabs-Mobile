// src/services/bookingService.js
import api, { apiHelpers } from './api';

export const bookingService = {
  // ============================================================
  // BOOKINGS — CRUD
  // ============================================================

  getBookings: async (params = {}) => {
    try {
      const response = await api.get('/v1/bookings', { params });
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  getBooking: async (id) => {
    try {
      const response = await api.get(`/v1/bookings/${id}`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  createBooking: async (data) => {
    try {
      const response = await api.post('/v1/bookings', data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  updateBooking: async (id, data) => {
    try {
      const response = await api.put(`/v1/bookings/${id}`, data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // CUSTOMER EDIT
  // ============================================================

  customerUpdate: async (bookingId, data) => {
    try {
      const response = await api.post(`/v1/bookings/${bookingId}/customer-update`, data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // SLOT VALIDATION
  // ============================================================

  validateSlot: async (data) => {
    try {
      const response = await api.post('/v1/bookings/validate-slot', data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // RESCHEDULE — CUSTOMER INITIATES
  // ============================================================

  customerRequestReschedule: async (bookingId, data) => {
    try {
      const response = await api.post(
        `/v1/bookings/${bookingId}/customer-request-reschedule`,
        data
      );
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // RESCHEDULE — CUSTOMER RESPONDS TO ADMIN
  // payload: { action: 'accept' | 'counter' | 'cancel', new_date?, new_time?, reason? }
  // ============================================================

  customerRescheduleResponse: async (bookingId, data) => {
    try {
      const response = await api.post(
        `/v1/bookings/${bookingId}/customer-respond-reschedule`,
        data
      );
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // Alias — some components may use this name
  customerRespondToReschedule: async (bookingId, data) => {
    try {
      const response = await api.post(
        `/v1/bookings/${bookingId}/customer-respond-reschedule`,
        data
      );
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // RESCHEDULE — POST-REJECTION DECISION
  // payload: { action: 'continue' | 'cancel', reason? }
  // ============================================================

  customerPostRejectionDecision: async (bookingId, data) => {
    try {
      const response = await api.post(
        `/v1/bookings/${bookingId}/customer-post-rejection`,
        data
      );
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // CANCELLATION — CUSTOMER
  // ============================================================

  customerCancelBooking: async (bookingId, data) => {
    try {
      const response = await api.post(`/v1/bookings/${bookingId}/customer-cancel`, data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // LEGACY ENDPOINTS
  // ============================================================

  requestReschedule: async (id, data) => {
    try {
      const response = await api.post(`/v1/bookings/${id}/request-reschedule`, data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  cancelBookingWithReason: async (id, reason) => {
    try {
      const response = await api.post(`/v1/bookings/${id}/cancel-with-reason`, { reason });
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  // ============================================================
  // PAYMENTS
  // ============================================================

  recordPayment: async (id, data) => {
    try {
      const response = await api.post(`/v1/bookings/${id}/record-payment`, data);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },

  getPaymentSummary: async (id) => {
    try {
      const response = await api.get(`/v1/bookings/${id}/payment-summary`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
};

export default bookingService;