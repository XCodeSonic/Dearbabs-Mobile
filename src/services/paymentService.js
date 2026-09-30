// src/services/paymentService.js
import api, { apiHelpers } from './api';

export const paymentService = {
    /**
     * Get all payments with optional filters
     */
    getPayments: async (params = {}) => {
        try {
            const response = await api.get('/v1/payments', { params });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching payments:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get a single payment by ID
     */
    getPayment: async (id) => {
        try {
            const response = await api.get(`/v1/payments/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error fetching payment ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Create a new payment
     */
    createPayment: async (data) => {
        try {
            console.log('💰 Creating payment...');
            
            if (data instanceof FormData) {
                const response = await api.post('/v1/payments', data, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                return apiHelpers.formatResponse(response);
            }
            
            const response = await api.post('/v1/payments', data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error creating payment:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Update an existing payment
     */
    updatePayment: async (id, data) => {
        try {
            const response = await api.put(`/v1/payments/${id}`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error updating payment ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Verify a payment
     */
    verifyPayment: async (id, notes = '') => {
        try {
            const response = await api.post(`/v1/payments/${id}/verify`, { notes });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error verifying payment ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Reject a payment
     */
    rejectPayment: async (id, reason = '') => {
        try {
            const response = await api.post(`/v1/payments/${id}/reject`, { reason });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error rejecting payment ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Delete a payment
     */
    deletePayment: async (id) => {
        try {
            const response = await api.delete(`/v1/payments/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error deleting payment ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Refund a payment
     */
    refundPayment: async (id, data) => {
        try {
            const response = await api.post(`/v1/payments/${id}/refund`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error refunding payment ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get payment summary
     */
    getPaymentSummary: async (params = {}) => {
        try {
            const response = await api.get('/v1/payments/summary', { params });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error fetching payment summary:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Download payment receipt
     */
    downloadReceipt: async (id) => {
        try {
            const response = await api.get(`/v1/payments/${id}/download-receipt`, {
                responseType: 'blob',
            });
            return response;
        } catch (error) {
            console.error(`❌ Error downloading receipt ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Upload proof of payment for a booking
     */
    uploadProofOfPayment: async (bookingId, formData) => {
        try {
            const response = await api.post(`/v1/bookings/${bookingId}/record-payment`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error uploading proof for booking ${bookingId}:`, error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get payments for a specific booking
     */
    getBookingPayments: async (bookingId) => {
        try {
            const response = await api.get(`/v1/bookings/${bookingId}/payment-summary`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error fetching booking payments ${bookingId}:`, error);
            return apiHelpers.handleError(error);
        }
    },
};

export default paymentService;