import { getFullImageUrl, getThemedBannerImage } from '../utils/imageHelper';
import api, { apiHelpers } from './api';

export const packageService = {
    getPublicPackages: async (params = {}) => {
        try {
            console.log('📦 Fetching public packages...');
            const response = await api.get('/v1/public/packages', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const packages = Array.isArray(result.data) ? result.data : 
                                (result.data.data ? result.data.data : []);
                
                console.log(`📦 Found ${packages.length} packages`);
                
                result.data = packages.map(pkg => {
                    const imageUrl = pkg.image_url || pkg.image 
                        ? getFullImageUrl(pkg.image_url || pkg.image, pkg.name)
                        : getThemedBannerImage(pkg.name);
                    
                    return {
                        ...pkg,
                        image: imageUrl,
                        image_url: imageUrl,
                        base_price_per_pax: parseFloat(pkg.base_price_per_pax) || 0,
                        price_per_additional_pax: parseFloat(pkg.price_per_additional_pax) || 0,
                        min_pax: parseInt(pkg.min_pax) || 1,
                        max_pax: parseInt(pkg.max_pax) || 100,
                        default_duration_hours: parseInt(pkg.default_duration_hours) || 4,
                        sort_order: parseInt(pkg.sort_order) || 0,
                        is_active: pkg.is_active !== false,
                        is_featured: pkg.is_featured === true,
                        inclusions: pkg.inclusions || [],
                        exclusions: pkg.exclusions || [],
                        menu_items: (pkg.menu_items || []).map(item => {
                            const itemImage = getFullImageUrl(item.image_url || item.image, item.name || 'Menu Item');
                            return {
                                ...item,
                                image: itemImage,
                                image_url: itemImage,
                                price: parseFloat(item.price) || 0,
                            };
                        }),
                    };
                });
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching public packages:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getPackages: async (params = {}) => {
        try {
            console.log('📦 Fetching packages...');
            const response = await api.get('/v1/packages', { params });
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const packages = Array.isArray(result.data) ? result.data : 
                                (result.data.data ? result.data.data : []);
                
                result.data = packages.map(pkg => {
                    const imageUrl = pkg.image_url || pkg.image 
                        ? getFullImageUrl(pkg.image_url || pkg.image, pkg.name)
                        : getThemedBannerImage(pkg.name);
                    
                    return {
                        ...pkg,
                        image: imageUrl,
                        image_url: imageUrl,
                        base_price_per_pax: parseFloat(pkg.base_price_per_pax) || 0,
                        price_per_additional_pax: parseFloat(pkg.price_per_additional_pax) || 0,
                        min_pax: parseInt(pkg.min_pax) || 1,
                        max_pax: parseInt(pkg.max_pax) || 100,
                        default_duration_hours: parseInt(pkg.default_duration_hours) || 4,
                        sort_order: parseInt(pkg.sort_order) || 0,
                        is_active: pkg.is_active !== false,
                        is_featured: pkg.is_featured === true,
                        menu_items: (pkg.menu_items || []).map(item => {
                            const itemImage = getFullImageUrl(item.image_url || item.image, item.name || 'Menu Item');
                            return {
                                ...item,
                                image: itemImage,
                                image_url: itemImage,
                                price: parseFloat(item.price) || 0,
                            };
                        }),
                    };
                });
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error fetching packages:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    getPackage: async (id) => {
        try {
            console.log(`📦 Fetching package ${id}...`);
            const response = await api.get(`/v1/packages/${id}`);
            const result = apiHelpers.formatResponse(response);
            
            if (result.success && result.data) {
                const pkg = result.data;
                const imageUrl = pkg.image_url || pkg.image 
                    ? getFullImageUrl(pkg.image_url || pkg.image, pkg.name)
                    : getThemedBannerImage(pkg.name);
                
                result.data = {
                    ...pkg,
                    image: imageUrl,
                    image_url: imageUrl,
                    base_price_per_pax: parseFloat(pkg.base_price_per_pax) || 0,
                    price_per_additional_pax: parseFloat(pkg.price_per_additional_pax) || 0,
                    min_pax: parseInt(pkg.min_pax) || 1,
                    max_pax: parseInt(pkg.max_pax) || 100,
                    default_duration_hours: parseInt(pkg.default_duration_hours) || 4,
                    sort_order: parseInt(pkg.sort_order) || 0,
                    is_active: pkg.is_active !== false,
                    is_featured: pkg.is_featured === true,
                    menu_items: (pkg.menu_items || []).map(item => {
                        const itemImage = getFullImageUrl(item.image_url || item.image, item.name || 'Menu Item');
                        return {
                            ...item,
                            image: itemImage,
                            image_url: itemImage,
                            price: parseFloat(item.price) || 0,
                        };
                    }),
                };
            }
            
            return result;
        } catch (error) {
            console.error(`❌ Error fetching package ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    createPackage: async (data) => {
        try {
            console.log('📦 Creating package...');
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (key === 'inclusions' || key === 'exclusions' || key === 'menu_items') {
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
            
            const response = await api.post('/v1/packages', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error('❌ Error creating package:', error);
            return apiHelpers.handleError(error);
        }
    },
    
    updatePackage: async (id, data) => {
        try {
            console.log(`📦 Updating package ${id}...`);
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (key === 'inclusions' || key === 'exclusions' || key === 'menu_items') {
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
            
            const response = await api.post(`/v1/packages/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return apiHelpers.formatResponse(response);
        } catch (error) {
            console.error(`❌ Error updating package ${id}:`, error);
            return apiHelpers.handleError(error);
        }
    },
    
    deletePackage: async (id) => {
        try {
            const response = await api.delete(`/v1/packages/${id}`);
            return apiHelpers.formatResponse(response);
        } catch (error) {
            return apiHelpers.handleError(error);
        }
    },
};

export default packageService;