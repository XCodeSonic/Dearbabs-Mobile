// src/services/orderService.js
import api, { apiHelpers } from './api';

export const orderService = {
  // Get all orders
  getOrders: async (params = {}) => {
    try {
      const response = await api.get('/v1/orders', { params });
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Get single order
  getOrder: async (id) => {
    try {
      const response = await api.get(`/v1/orders/${id}`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Update order status
  updateStatus: async (id, status) => {
    try {
      const response = await api.post(`/v1/orders/${id}/status`, { status });
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Add to kitchen
  addToKitchen: async (id) => {
    try {
      const response = await api.post(`/v1/orders/${id}/add-to-kitchen`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Add to delivery
  addToDelivery: async (id) => {
    try {
      const response = await api.post(`/v1/orders/${id}/add-to-delivery`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Get ingredients for order
  getIngredients: async (id) => {
    try {
      const response = await api.get(`/v1/orders/${id}/ingredients`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Compute ingredients
  computeIngredients: async (id) => {
    try {
      const response = await api.post(`/v1/orders/${id}/compute-ingredients`);
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Get kitchen orders
  getKitchenOrders: async () => {
    try {
      const response = await api.get('/v1/orders/kitchen-orders');
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Get delivery orders
  getDeliveryOrders: async () => {
    try {
      const response = await api.get('/v1/orders/delivery-orders');
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
  
  // Get order statistics
  getStatistics: async () => {
    try {
      const response = await api.get('/v1/orders/stats');
      return apiHelpers.formatResponse(response);
    } catch (error) {
      return apiHelpers.handleError(error);
    }
  },
};