import { getFullImageUrl } from '../utils/imageHelper';
import api, { apiHelpers } from './api';

export const promotionService = {
    getPublicPromotions: async (params = {}) => {
        try {
            console.log('📦 Fetching public promotions...');
            const response = await api.get('/v1/public/promotions', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const items = Array.isArray(result.data) ? result.data : 
                             (result.data.data ? result.data.data : []);
                
                console.log(`📦 Found ${items.length} promotions`);
                
                result.data = items.map(item => ({
                    ...item,
                    image: getFullImageUrl(item.image_url || item.image, item.name || 'Promotion'),
                    image_url: getFullImageUrl(item.image_url || item.image, item.name || 'Promotion'),
                    discount_value: parseFloat(item.discount_value) || 0,
                    is_active: item.is_active !== false,
                    start_date: item.start_date || null,
                    end_date: item.end_date || null,
                }));
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching public promotions:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getPromotions: async (params = {}) => {
        try {
            console.log('📦 Fetching promotions...');
            const response = await api.get('/v1/promotions', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const items = Array.isArray(result.data) ? result.data : 
                             (result.data.data ? result.data.data : []);
                
                result.data = items.map(item => ({
                    ...item,
                    image: getFullImageUrl(item.image_url || item.image, item.name || 'Promotion'),
                    image_url: getFullImageUrl(item.image_url || item.image, item.name || 'Promotion'),
                    discount_value: parseFloat(item.discount_value) || 0,
                    is_active: item.is_active !== false,
                    start_date: item.start_date || null,
                    end_date: item.end_date || null,
                }));
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching promotions:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getPromotion: async (id) => {
        try {
            console.log(`📦 Fetching promotion ${id}...`);
            const response = await api.get(`/v1/promotions/${id}`);
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const item = result.data;
                result.data = {
                    ...item,
                    image: getFullImageUrl(item.image_url || item.image, item.name || 'Promotion'),
                    image_url: getFullImageUrl(item.image_url || item.image, item.name || 'Promotion'),
                    discount_value: parseFloat(item.discount_value) || 0,
                    is_active: item.is_active !== false,
                };
            }
            
            return result;
        } catch (error) {
            console.error(`❌ Error fetching promotion ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    createPromotion: async (data) => {
        try {
            console.log('📦 Creating promotion...');
            const response = await api.post('/v1/promotions', data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error creating promotion:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    updatePromotion: async (id, data) => {
        try {
            console.log(`📦 Updating promotion ${id}...`);
            const response = await api.put(`/v1/promotions/${id}`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error updating promotion ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    deletePromotion: async (id) => {
        try {
            const response = await api.delete(`/v1/promotions/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
};

export default promotionService;