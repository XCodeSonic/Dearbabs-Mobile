// App.js
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AllergyProvider } from './src/contexts/AllergyContext';
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
           <AllergyProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
            </NavigationContainer>
          </NotificationProvider>
           </AllergyProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}