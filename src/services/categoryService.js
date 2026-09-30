import api, { apiHelpers } from './api';

export const categoryService = {
    getPublicCategories: async (params = {}) => {
        try {
            console.log('📦 Fetching public categories...');
            const response = await api.get('/v1/public/meal-categories', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const items = Array.isArray(result.data) ? result.data : 
                             (result.data.data ? result.data.data : []);
                
                console.log(`📦 Found ${items.length} categories`);
                
                result.data = items.map(item => ({
                    ...item,
                    category_id: item.category_id || item.id,
                    display_order: parseInt(item.display_order) || 0,
                    is_active: item.is_active !== false,
                    menu_items_count: parseInt(item.menu_items_count) || 0,
                }));
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching public categories:', error);
            try {
                const fallbackResponse = await api.get('/v1/meal-categories', { 
                    params: { is_active: true, manage: false } 
                });
                return apiHelpers.formatResponse(fallbackResponse);
            } catch (fallbackError) {
                return apiHelpers.handleError(fallbackError);
            }
        }
    },
    
    getCategories: async (params = {}) => {
        try {
            console.log('📦 Fetching categories...');
            const response = await api.get('/v1/meal-categories', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const items = Array.isArray(result.data) ? result.data : 
                             (result.data.data ? result.data.data : []);
                
                result.data = items.map(item => ({
                    ...item,
                    category_id: item.category_id || item.id,
                    display_order: parseInt(item.display_order) || 0,
                    is_active: item.is_active !== false,
                    menu_items_count: parseInt(item.menu_items_count) || 0,
                }));
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching categories:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getCategory: async (id) => {
        try {
            console.log(`📦 Fetching category ${id}...`);
            const response = await api.get(`/v1/meal-categories/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error fetching category ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    createCategory: async (data) => {
        try {
            console.log('📦 Creating category...');
            const response = await api.post('/v1/meal-categories', data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error creating category:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    updateCategory: async ({ id, data }) => {
        try {
            console.log(`📦 Updating category ${id}...`);
            const response = await api.put(`/v1/meal-categories/${id}`, data);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error updating category ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    deleteCategory: async (id) => {
        try {
            const response = await api.delete(`/v1/meal-categories/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
};

export default categoryService;