// src/screens/ProfileScreen.jsx - COMPLETE WITH 4-DIGIT CUSTOMER ID
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useAllergies } from '../contexts/AllergyContext';
import { humanizeAllergen } from '../utils/allergyHelper';
import { allergyAPI } from '../services/api';
const ProfileScreen = ({ navigation }) => {
  const { user, updateProfile, changePassword, logout, isGuest, updateProfilePhoto } = useAuth();
  const { masterList, myAllergies, saveAllergies } = useAllergies();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ⭐ Food allergies
  const [allergiesModalVisible, setAllergiesModalVisible] = useState(false);
  const [draftAllergies, setDraftAllergies] = useState([]);
  const [isSavingAllergies, setIsSavingAllergies] = useState(false);
  // Edit Profile State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.full_name || user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.phone_number || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Change Password State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Helper function to format customer ID to 4 digits
  const formatCustomerId = (id) => {
    if (id) {
      if (typeof id === 'string' && id.length === 4) return id;
      const numId = parseInt(id);
      if (!isNaN(numId)) {
        return numId.toString().padStart(4, '0');
      }
    }
    return '0001';
  };

  // Redirect to login if guest mode
  useEffect(() => {
    if (isGuest) {
      
      Alert.alert(
        'Guest Mode',
        'Please login to access your profile and manage your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => navigation.replace('Login')
          }
        ]
      );
    }
  }, [isGuest]);

  useEffect(() => {
    if (user) {
      setEditFullName(user.full_name || user.name || '');
      setEditEmail(user.email || '');
      setEditPhone(user.phone_number || user.phone || '');
      setEditAddress(user.address || user.address_line_1 || '');
    }
  }, [user, editModalVisible]);

  // Default avatar based on user name
  const getDefaultAvatar = () => {
    const name = user?.full_name || user?.name || user?.username || 'Guest';
    const firstLetter = name.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${firstLetter}&background=FF6B9D&color=fff&size=100&bold=true`;
  };

  const displayName = user?.full_name || user?.name || user?.username || 'Guest User';
  const displayEmail = user?.email || 'guest@dearbabs.com';
  const displayAvatar = user?.profile_photo_url || user?.profile_photo || user?.avatar || getDefaultAvatar();
  const customerId = formatCustomerId(user?.customer_id || user?.id);

  const pickImage = async () => {
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to update your profile photo');
      return;
    }
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please grant camera roll permissions to change profile photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setUploadingPhoto(true);
        const uploadResult = await updateProfilePhoto(result.assets[0].uri);
        if (uploadResult.success) {
          Alert.alert('Success', 'Profile photo updated successfully!');
        } else {
          Alert.alert('Error', uploadResult.message || 'Failed to update photo');
        }
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const copyToClipboard = (text, label) => {
    Clipboard.setString(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  const handleUpdateProfile = async () => {
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to update your profile');
      return;
    }
    
    if (!editFullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    
    if (!editEmail.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    setIsUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const updateData = {
        full_name: editFullName,
        email: editEmail,
        phone_number: editPhone,
        address: editAddress,
      };
      
      const result = await updateProfile(updateData);
      
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully!');
        setEditModalVisible(false);
      } else {
        Alert.alert('Error', result.message || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while updating profile');
    } finally {
      setIsUpdating(false);
    }
  };

  // ⭐ Food allergy handlers
  const openAllergiesModal = () => {
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to manage your food allergies.');
      return;
    }
    setDraftAllergies([...myAllergies]);
    setAllergiesModalVisible(true);
  };

  const toggleDraftAllergy = (slug) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftAllergies((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSaveAllergies = async () => {
    setIsSavingAllergies(true);
    try {
      const result = await saveAllergies(draftAllergies);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', 'Your food allergies have been updated.');
        setAllergiesModalVisible(false);
      } else {
        Alert.alert('Error', result.message || 'Failed to save allergies.');
      }
    } finally {
      setIsSavingAllergies(false);
    }
  };

  const handleChangePassword = async () => {
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to change your password');
      return;
    }
    
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    setIsChangingPassword(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const result = await changePassword(currentPassword, newPassword);
      
      if (result.success) {
        Alert.alert('Success', 'Password changed successfully!');
        setPasswordModalVisible(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', result.message || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const menuItems = [
    { 
      icon: 'edit-2', 
      label: 'Edit Profile', 
      description: 'Update your personal information',
      color: '#FF6B9D',
      onPress: () => setEditModalVisible(true)
    },
    { 
      icon: 'lock', 
      label: 'Change Password', 
      description: 'Update your password',
      color: '#FF8FB1',
      onPress: () => setPasswordModalVisible(true)
    },
    { 
      icon: 'message-circle', 
      label: 'Chat Support', 
      description: 'Get help from our team',
      color: '#FFA0C0',
      onPress: () => navigation.navigate('Chat')
    },
  ];

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => { 
            await logout(); 
            navigation.replace('Login'); 
          } 
        }
      ]
    );
  };

  const MenuItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={() => { 
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
        item.onPress(); 
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.color + '10' }]}>
        <Feather name={item.icon} size={22} color={item.color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        <Text style={styles.menuDescription}>{item.description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#C6C6C8" />
    </TouchableOpacity>
  );

  // Show login prompt for guest users
  if (isGuest) {
    return (
      <View style={styles.guestContainer}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#ffffff', '#fff8fa', '#fff0f5', '#ffe8f0']} style={styles.gradient}>
          <View style={styles.guestContent}>
            <View style={styles.guestIconContainer}>
              <Feather name="user" size={80} color="#FF6B9D" />
            </View>
            <Text style={styles.guestTitle}>Guest Mode</Text>
            <Text style={styles.guestMessage}>
              You are browsing as a guest. Create an account or login to access your profile, save your orders, and manage your account.
            </Text>
            <TouchableOpacity 
              style={styles.guestLoginButton}
              onPress={() => navigation.replace('Login')}
            >
              <LinearGradient colors={['#ff6b9d', '#ff8fb1']} style={styles.guestLoginGradient}>
                <Text style={styles.guestLoginText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.guestBackButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.guestBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.profileImageWrapper} 
            onPress={pickImage}
            disabled={uploadingPhoto}
          >
            <Image 
              source={{ uri: displayAvatar }} 
              style={styles.profileImage} 
            />
            <View style={styles.editIcon}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{displayEmail}</Text>
          
          {/* 4-Digit Customer ID */}
          <TouchableOpacity 
            style={styles.customerIdContainer} 
            onPress={() => copyToClipboard(customerId, 'Customer ID')}
            activeOpacity={0.7}
          >
            <Feather name="credit-card" size={14} color="#FF6B9D" />
            <Text style={styles.customerIdLabel}>Customer ID:</Text>
            <Text style={styles.customerIdValue}>{customerId}</Text>
            <Feather name="copy" size={12} color="#FF6B9D" style={styles.copyIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          {menuItems.slice(0, 2).map((item, index) => (
            <MenuItem key={index} item={item} />
          ))}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          {menuItems.slice(2, 3).map((item, index) => (
            <MenuItem key={index} item={item} />
          ))}
        </View>

          <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          {/* ⭐ Food Allergies */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={openAllergiesModal}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FF444410' }]}>
              <Feather name="alert-triangle" size={22} color="#FF4444" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Food Allergies</Text>
              <Text style={styles.menuDescription}>
                {myAllergies?.length > 0
                  ? `${myAllergies.length} ${myAllergies.length === 1 ? 'allergy' : 'allergies'} saved`
                  : 'Select allergies to get warnings'}
              </Text>
            </View>
            {myAllergies?.length > 0 ? (
              <View style={styles.allergyCountBadge}>
                <Text style={styles.allergyCountText}>{myAllergies.length}</Text>
              </View>
            ) : (
              <Feather name="chevron-right" size={18} color="#C6C6C8" />
            )}
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#FF8FB110' }]}>
              <Feather name="bell" size={22} color="#FF8FB1" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Notifications</Text>
              <Text style={styles.menuDescription}>Receive order updates and offers</Text>
            </View>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E5E5EA', true: '#FF6B9D' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E5EA"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Feather name="log-out" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 3.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 Dear Bab's Catering</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={['#FF6B9D', '#FF8FB1']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalClose}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <Feather name="user" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editFullName}
                    onChangeText={setEditFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#B0B0B0"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Feather name="mail" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Enter your email"
                    placeholderTextColor="#B0B0B0"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputContainer}>
                  <Feather name="phone" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#B0B0B0"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <View style={styles.inputContainer}>
                  <Feather name="map-pin" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editAddress}
                    onChangeText={setEditAddress}
                    placeholder="Enter your address"
                    placeholderTextColor="#B0B0B0"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleUpdateProfile}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

       {/* ⭐ Food Allergies Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={allergiesModalVisible}
        onRequestClose={() => setAllergiesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={['#FF6B9D', '#FF8FB1']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Food Allergies</Text>
              <TouchableOpacity
                onPress={() => setAllergiesModalVisible(false)}
                style={styles.modalClose}
              >
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.allergyIntro}>
                Select all food allergies that apply to you. Menu items containing
                your selected allergies will be clearly marked with a warning.
              </Text>

                          {(masterList || []).length === 0 ? (
                <View style={styles.allergyEmpty}>
                  <ActivityIndicator color="#FF6B9D" />
                  <Text style={styles.allergyEmptyText}>
                    Loading allergens… (if this takes too long, tap Save to retry)
                  </Text>
                  <TouchableOpacity
                    style={styles.allergyRetryButton}
                    onPress={async () => {
                      try {
                        const res = await allergyAPI.getMasterList();
                        const payload = res?.data?.data ?? res?.data ?? [];
                        if (Array.isArray(payload) && payload.length > 0) {
                          // Force context refresh
                          window?.dispatchEvent?.(new Event('focus'));
                        }
                      } catch (e) { /* ignore */ }
                    }}
                  >
                    <Feather name="refresh-cw" size={14} color="#FF6B9D" />
                    <Text style={styles.allergyRetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                (masterList || []).map((allergen) => {
                  const slug = String(allergen.id || '').toLowerCase();
                  const selected = draftAllergies.includes(slug);
                  return (
                    <TouchableOpacity
                      key={slug}
                      style={[styles.allergyRow, selected && styles.allergyRowSelected]}
                      onPress={() => toggleDraftAllergy(slug)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.allergyCheckbox,
                          selected && styles.allergyCheckboxSelected,
                        ]}
                      >
                        {selected && (
                          <Feather name="check" size={14} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.allergyName,
                            selected && styles.allergyNameSelected,
                          ]}
                        >
                          {allergen.name || humanizeAllergen(slug)}
                        </Text>
                        {!!allergen.description && (
                          <Text style={styles.allergyDescription}>
                            {allergen.description}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <View style={styles.allergyHint}>
                <Feather name="info" size={14} color="#FF6B9D" />
                <Text style={styles.allergyHintText}>
                  Your allergies are stored on your account and used whenever you
                  browse the menu.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAllergiesModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveAllergies}
                disabled={isSavingAllergies}
              >
                {isSavingAllergies ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save ({draftAllergies.length})</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={['#FF6B9D', '#FF8FB1']} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)} style={styles.modalClose}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#B0B0B0"
                    secureTextEntry={!showCurrentPassword}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Feather name={showCurrentPassword ? 'eye-off' : 'eye'} size={18} color="#FF6B9D" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password (min. 8 characters)"
                    placeholderTextColor="#B0B0B0"
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Feather name={showNewPassword ? 'eye-off' : 'eye'} size={18} color="#FF6B9D" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#FF6B9D" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#B0B0B0"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#FF6B9D" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.passwordHint}>
                <Feather name="info" size={14} color="#FF6B9D" />
                <Text style={styles.passwordHintText}>
                  Password must be at least 8 characters long
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 30,
  },
  // Guest mode styles
  guestContainer: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  guestContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  guestIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B9D',
    marginBottom: 12,
  },
  guestMessage: {
    fontSize: 14,
    color: '#6B6B6E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  guestLoginButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 12,
  },
  guestLoginGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  guestBackButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  // Profile Section
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  customerIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
    gap: 6,
  },
  customerIdLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  customerIdValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  copyIcon: {
    marginLeft: 4,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 12,
    color: '#C6C6C8',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 11,
    color: '#C6C6C8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A5A5E',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#2D2D2D',
    paddingVertical: 12,
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#FF6B9D',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF0F5',
    borderRadius: 8,
  },
  passwordHintText: {
    flex: 1,
    fontSize: 12,
    color: '#FF6B9D',
  },

  // ⭐ Food allergy styles
  allergyCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  allergyCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  allergyIntro: {
    fontSize: 13,
    color: '#5A5A5E',
    lineHeight: 19,
    marginBottom: 16,
  },
  allergyEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  allergyEmptyText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  allergyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    gap: 12,
  },
  allergyRowSelected: {
    borderColor: '#FF6B9D',
    backgroundColor: '#FFF0F5',
  },
  allergyCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C6C6C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  allergyCheckboxSelected: {
    borderColor: '#FF6B9D',
    backgroundColor: '#FF6B9D',
  },
  allergyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  allergyNameSelected: {
    color: '#C2185B',
  },
  allergyDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  allergyHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF0F5',
    borderRadius: 8,
  },
  allergyHintText: {
    flex: 1,
    fontSize: 12,
    color: '#FF6B9D',
    lineHeight: 17,
  },
    allergyRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFF0F5',
  },
  allergyRetryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
});

export default ProfileScreen;