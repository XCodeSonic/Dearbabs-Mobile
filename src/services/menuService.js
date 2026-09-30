import { getFullImageUrl } from '../utils/imageHelper';
import api, { apiHelpers } from './api';

export const menuService = {
    getPublicMenuItems: async (params = {}) => {
        try {
            console.log('📦 Fetching public menu items...');
            const response = await api.get('/v1/public/menu-items', { params });
            const result = apiHelpers.formatResponse(response);
            
            console.log('📦 Raw menu data:', result.data);
            
            if (result.success && result.data) {
                const items = Array.isArray(result.data) ? result.data : 
                             (result.data.data ? result.data.data : []);
                
                console.log(`📦 Found ${items.length} menu items`);
                
                result.data = items.map(item => {
                    const imageUrl = getFullImageUrl(item.image_url || item.image, item.name || 'Menu Item');
                    return {
                        ...item,
                        image: imageUrl,
                        image_url: imageUrl,
                        price: parseFloat(item.price) || 0,
                        cost_to_make: parseFloat(item.cost_to_make) || 0,
                        prep_time_minutes: parseInt(item.prep_time_minutes) || 0,
                        serving_size: parseInt(item.serving_size) || 1,
                    };
                });
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching public menu items:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getMenuItems: async (params = {}) => {
        try {
            console.log('📦 Fetching menu items...');
            const response = await api.get('/v1/menu-items', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const items = Array.isArray(result.data) ? result.data : 
                             (result.data.data ? result.data.data : []);
                
                result.data = items.map(item => {
                    const imageUrl = getFullImageUrl(item.image_url || item.image, item.name || 'Menu Item');
                    return {
                        ...item,
                        image: imageUrl,
                        image_url: imageUrl,
                        price: parseFloat(item.price) || 0,
                        cost_to_make: parseFloat(item.cost_to_make) || 0,
                        prep_time_minutes: parseInt(item.prep_time_minutes) || 0,
                        serving_size: parseInt(item.serving_size) || 1,
                        is_available: item.is_available !== false,
                        is_popular: item.is_popular === true,
                    };
                });
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching menu items:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getMenuItem: async (id) => {
        try {
            console.log(`📦 Fetching menu item ${id}...`);
            const response = await api.get(`/v1/menu-items/${id}`);
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const item = result.data;
                const imageUrl = getFullImageUrl(item.image_url || item.image, item.name || 'Menu Item');
                result.data = {
                    ...item,
                    image: imageUrl,
                    image_url: imageUrl,
                    price: parseFloat(item.price) || 0,
                    cost_to_make: parseFloat(item.cost_to_make) || 0,
                    prep_time_minutes: parseInt(item.prep_time_minutes) || 0,
                    serving_size: parseInt(item.serving_size) || 1,
                };
            }
            
            return result;
        } catch (error) {
            console.error(`❌ Error fetching menu item ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    toggleAvailability: async (id) => {
        try {
            const response = await api.post(`/v1/menu-items/${id}/toggle-availability`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
    
    toggleFeatured: async (id) => {
        try {
            const response = await api.post(`/v1/menu-items/${id}/toggle-featured`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
    
    createMenuItem: async (data) => {
        try {
            console.log('📦 Creating menu item...');
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (key === 'ingredients' && typeof data[key] === 'object') {
                    formData.append(key, JSON.stringify(data[key]));
                } else if (key === 'image' && data[key]) {
                    formData.append('image', {
                        uri: data[key].uri,
                        type: data[key].type || 'image/jpeg',
                        name: data[key].name || 'image.jpg',
                    });
                } else if (data[key] !== null && data[key] !== undefined) {
                    formData.append(key, String(data[key]));
                }
            });
            
            const response = await api.post('/v1/menu-items', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error creating menu item:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    updateMenuItem: async (id, data) => {
        try {
            console.log(`📦 Updating menu item ${id}...`);
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (key === 'ingredients' && typeof data[key] === 'object') {
                    formData.append(key, JSON.stringify(data[key]));
                } else if (key === 'image' && data[key]) {
                    formData.append('image', {
                        uri: data[key].uri,
                        type: data[key].type || 'image/jpeg',
                        name: data[key].name || 'image.jpg',
                    });
                } else if (data[key] !== null && data[key] !== undefined) {
                    formData.append(key, String(data[key]));
                }
            });
            formData.append('_method', 'PUT');
            
            const response = await api.post(`/v1/menu-items/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error updating menu item ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    deleteMenuItem: async (id) => {
        try {
            const response = await api.delete(`/v1/menu-items/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
    
    getMenuItemsByCategory: async (categoryId, params = {}) => {
        try {
            const response = await api.get('/v1/menu-items', { 
                params: { ...params, category_id: categoryId } 
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
    
    searchMenuItems: async (query, params = {}) => {
        try {
            const response = await api.get('/v1/menu-items', { 
                params: { ...params, search: query } 
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
};

export default menuService;