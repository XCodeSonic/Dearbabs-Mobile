import { Alert, Platform, ToastAndroid } from 'react-native';

const toast = {
  show({ type = 'info', text1 = 'Notice', text2 = '' } = {}) {
    const message = [text1, text2].filter(Boolean).join(' - ');

    if (Platform.OS === 'android' && ToastAndroid?.showWithGravity) {
      ToastAndroid.showWithGravity(message, ToastAndroid.SHORT, ToastAndroid.BOTTOM);
      return;
    }

    Alert.alert(text1 || type, text2 || '');
  },
};

export default toast;
