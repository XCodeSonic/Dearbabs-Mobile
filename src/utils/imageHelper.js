import { getBaseUrl } from '../services/api';

const getBackendOrigin = () => getBaseUrl().replace(/\/api\/?$/, '');
const BASE_URL = getBackendOrigin();
const BACKEND_HOST = BASE_URL.replace(/^https?:\/\//, '');

export const getFullImageUrl = (imagePath, fallbackText = 'No Image') => {
    console.log('📷 Original image path:', imagePath);

    if (!imagePath) {
        return `https://via.placeholder.com/400x400/FF6B9D/FFFFFF?text=${encodeURIComponent(fallbackText)}`;
    }

    let url = String(imagePath).trim();

    // Backend seeders sometimes return inline SVG placeholders as data URIs.
    // These are already valid React Native image URIs; do not prepend /storage/.
    if (url.startsWith('data:image/')) {
        return url;
    }

    if (url.includes('localhost')) {
        url = url.replace(/localhost:8000/g, BACKEND_HOST).replace(/127.0.0.1:8000/g, BACKEND_HOST);
        console.log('📷 Replaced local image host with backend host:', url);
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
        if (url.includes('localhost')) {
            url = url.replace(/localhost:8000/g, BACKEND_HOST).replace(/127.0.0.1:8000/g, BACKEND_HOST);
        }
        return url;
    }

    let fullUrl;
    
    if (url.startsWith('/storage/')) {
        fullUrl = BASE_URL + url;
    } else if (url.startsWith('storage/')) {
        fullUrl = BASE_URL + '/' + url;
    } else if (url.startsWith('menu-items/')) {
        fullUrl = BASE_URL + '/storage/' + url;
    } else if (url.startsWith('profile-photos/')) {
        fullUrl = BASE_URL + '/storage/' + url;
    } else if (url.startsWith('packages/')) {
        fullUrl = BASE_URL + '/storage/' + url;
    } else if (url.startsWith('uploads/')) {
        fullUrl = BASE_URL + '/storage/' + url;
    } else if (url.startsWith('receipts/')) {
        fullUrl = BASE_URL + '/storage/' + url;
    } else {
        fullUrl = BASE_URL + '/storage/' + url;
    }

    console.log('📷 Final image URL:', fullUrl);
    return fullUrl;
};

export const getImageSource = (imagePath, fallbackText = 'No Image') => {
    const url = getFullImageUrl(imagePath, fallbackText);
    return { uri: url };
};

export const getThemedBannerImage = (name) => {
    const nameLower = name?.toLowerCase() || '';
    
    if (nameLower.includes('wedding')) {
        return 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('birthday')) {
        return 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('corporate') || nameLower.includes('company')) {
        return 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('debut')) {
        return 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('seminar') || nameLower.includes('conference')) {
        return 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('fiesta') || nameLower.includes('party')) {
        return 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('anniversary')) {
        return 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=400&fit=crop';
    }
    if (nameLower.includes('funeral') || nameLower.includes('memorial')) {
        return 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c0?w=800&h=400&fit=crop';
    }
    
    return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop';
};

export const getRandomBannerImage = () => {
    const images = [
        'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1574482620811-2aa7ffe44c4c?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1550317138-10000687a72b?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&h=400&fit=crop',
        'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=400&fit=crop',
    ];
    return images[Math.floor(Math.random() * images.length)];
};

export const getPlaceholderImage = (text = 'Food', bgColor = 'FF6B9D', textColor = 'FFFFFF') => {
    return `https://via.placeholder.com/400x400/${bgColor}/${textColor}?text=${encodeURIComponent(text)}`;
};

export default {
    getFullImageUrl,
    getImageSource,
    getThemedBannerImage,
    getRandomBannerImage,
    getPlaceholderImage,
};