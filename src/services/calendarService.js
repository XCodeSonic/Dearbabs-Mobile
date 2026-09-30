// src/services/calendarService.js
import api, { apiHelpers } from './api';

export const calendarService = {
    /**
     * Get all availability settings
     */
    getAvailability: async (params = {}) => {
        try {
            const response = await api.get('/v1/booking-calendar/availability', { params });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error fetching availability:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get availability for a specific month
     */
    getMonthAvailability: async (year, month) => {
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
            
            const response = await api.get('/v1/booking-calendar/availability', {
                params: { 
                    start: startDate, 
                    end: endDate 
                }
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error fetching month availability:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get available dates for booking (excludes fully booked/unavailable)
     */
    getAvailableDates: async (startDate, endDate) => {
        try {
            const response = await api.get('/v1/booking-calendar/availability', {
                params: { 
                    start: startDate, 
                    end: endDate,
                    status: 'available' 
                }
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error fetching available dates:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Get available time slots for a date
     */
    getAvailableTimeSlots: async (date) => {
        try {
            const response = await api.get('/v1/booking-calendar/availability', {
                params: { date: date }
            });
            
            if (response.data?.success) {
                const data = response.data.data;
                if (Array.isArray(data) && data.length > 0) {
                    const avail = data.find(a => a.availability_date === date);
                    if (avail && avail.time_slots) {
                        return {
                            success: true,
                            data: avail.time_slots,
                            message: 'Time slots retrieved'
                        };
                    }
                }
            }
            
            // Default time slots if none configured
            const defaultSlots = [
                '08:00', '09:00', '10:00', '11:00', '12:00',
                '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
            ];
            
            return {
                success: true,
                data: defaultSlots,
                message: 'Default time slots'
            };
        } catch (error) {
            console.error('Error fetching time slots:', error);
            return {
                success: true,
                data: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
                message: 'Default time slots'
            };
        }
    },

    /**
     * Save availability setting for a date
     */
    saveAvailability: async (date, data) => {
        try {
            const response = await api.put(`/v1/booking-calendar/availability/${date}`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error saving availability:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Delete availability setting for a date (reset to default)
     */
    deleteAvailability: async (date) => {
        try {
            const response = await api.delete(`/v1/booking-calendar/availability/${date}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('Error deleting availability:', error);
            return apiHelpers.handleError(error);
        }
    },

    /**
     * Check if a date is available for booking
     */
    isDateAvailable: async (date) => {
        try {
            const response = await api.get('/v1/booking-calendar/availability', {
                params: { date: date }
            });
            
            if (response.data?.success) {
                const data = response.data.data;
                if (Array.isArray(data) && data.length > 0) {
                    const avail = data.find(a => a.availability_date === date);
                    if (avail) {
                        return avail.status === 'available' || avail.status === 'limited';
                    }
                }
                return true;
            }
            return true;
        } catch (error) {
            console.error('Error checking date availability:', error);
            return true;
        }
    },

    /**
     * Get all dates for a month with their availability status
     */
    getMonthStatus: async (year, month) => {
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
            
            const response = await api.get('/v1/booking-calendar/availability', {
                params: { start: startDate, end: endDate }
            });
            
            if (response.data?.success) {
                const data = response.data.data || [];
                const statusMap = {};
                data.forEach(item => {
                    statusMap[item.availability_date] = {
                        status: item.status || 'available',
                        max_bookings: item.max_bookings,
                        notes: item.notes,
                        time_slots: item.time_slots || []
                    };
                });
                return statusMap;
            }
            return {};
        } catch (error) {
            console.error('Error fetching month status:', error);
            return {};
        }
    }
};

export default calendarService;