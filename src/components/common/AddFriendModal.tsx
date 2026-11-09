import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Search, UserPlus, Share2, Mail, Check, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { MemberAvatar } from './MemberAvatar';
import { searchUsers, addFriendRemote } from '../../services/friendService';
import { createLocalFriendship } from '../../repositories/friendRepository';
import { networkMonitor } from '../../sync/networkMonitor';
import { AppUser, Friendship } from '../../types';
import { useAppTheme, ThemeColors } from '../../theme';

interface AddFriendModalProps {
  visible: boolean;
  currentUserId: string;
  currentUserName: string;
  onDismiss: () => void;
  onFriendAdded?: (friend: Friendship) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  visible,
  currentUserId,
  currentUserName,
  onDismiss,
  onFriendAdded,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [activeTab, setActiveTab] = useState<'search' | 'manual'>('manual');

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [addedUserIds, setAddedUserIds] = useState<Record<string, boolean>>({});

  // Manual tab state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(text, currentUserId);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFoundUser = async (targetUser: AppUser) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setAddedUserIds((prev) => ({ ...prev, [targetUser.uid]: true }));

    try {
      // 1. Instant local persistence
      const friendship = await createLocalFriendship(
        currentUserId,
        targetUser.uid,
        targetUser.name,
        targetUser.email,
        targetUser.photoURL
      );

      // 2. Remote Firestore sync if online
      if (networkMonitor.isCurrentlyOnline()) {
        addFriendRemote(
          currentUserId,
          currentUserName,
          targetUser.uid,
          targetUser.name,
          targetUser.email,
          targetUser.photoURL
        ).catch(() => {});
      }

      onFriendAdded?.(friendship);
      setTimeout(() => {
        onDismiss();
      }, 300);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add friend.');
    }
  };

  const handleCreateManualFriend = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your friend\'s name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const friendId = `manual_${Crypto.randomUUID().slice(0, 10)}`;
      const friendship = await createLocalFriendship(
        currentUserId,
        friendId,
        trimmedName,
        email.trim() || undefined
      );

      if (networkMonitor.isCurrentlyOnline()) {
        addFriendRemote(
          currentUserId,
          currentUserName,
          friendId,
          trimmedName,
          email.trim() || undefined
        ).catch(() => {});
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      setName('');
      setEmail('');
      onFriendAdded?.(friendship);
      onDismiss();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add friend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareInvite = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      await Share.share({
        message: `Hey! Let's track our shared expenses on Splitwiser. Add me using my name: "${currentUserName}"!`,
        title: 'Join me on Splitwiser',
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalDialog}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Add a Friend</Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.closeBtn}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'manual' && styles.tabBtnActive]}
              onPress={() => setActiveTab('manual')}
            >
              <User size={15} color={activeTab === 'manual' ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
                By Name
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
              onPress={() => setActiveTab('search')}
            >
              <Search size={15} color={activeTab === 'search' ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
                Search App Users
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
            {activeTab === 'manual' ? (
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>Friend's Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                  Email or Phone (optional)
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. rahul@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: name.trim() ? colors.primary : colors.border },
                  ]}
                  onPress={handleCreateManualFriend}
                  disabled={!name.trim() || isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <UserPlus size={18} color={name.trim() ? '#FFFFFF' : colors.textMuted} style={{ marginRight: 8 }} />
                      <Text style={[styles.primaryBtnText, { color: name.trim() ? '#FFFFFF' : colors.textMuted }]}>
                        Add Friend
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <View style={styles.searchBarBox}>
                  <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search by name or email..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => handleSearch('')}>
                      <X size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {isSearching ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#059669" />
                  </View>
                ) : searchResults.length > 0 ? (
                  <View style={styles.resultsList}>
                    {searchResults.map((item) => {
                      const isAdded = !!addedUserIds[item.uid];
                      return (
                        <View key={item.uid} style={styles.userRow}>
                          <MemberAvatar name={item.name} size={38} />
                          <View style={styles.userInfo}>
                            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                            {item.email ? (
                              <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
                            ) : null}
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.addSmallBtn,
                              isAdded && styles.addSmallBtnDone,
                            ]}
                            onPress={() => !isAdded && handleAddFoundUser(item)}
                            disabled={isAdded}
                          >
                            {isAdded ? (
                              <Check size={14} color="#059669" strokeWidth={2.5} />
                            ) : (
                              <Text style={styles.addSmallBtnText}>Add</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : searchQuery.trim().length >= 2 ? (
                  <Text style={styles.emptyResultsText}>
                    No registered user found matching "{searchQuery}".
                  </Text>
                ) : (
                  <Text style={styles.searchHintText}>
                    Type at least 2 characters to search by user name or email.
                  </Text>
                )}
              </View>
            )}

            {/* Native Share Invitation Banner */}
            <TouchableOpacity
              style={styles.shareBanner}
              onPress={handleShareInvite}
              activeOpacity={0.7}
            >
              <View style={styles.shareIconBox}>
                <Share2 size={16} color="#059669" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.shareTitle}>Invite via WhatsApp / SMS</Text>
                <Text style={styles.shareSub}>Share a message with your friends</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalDialog: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: 4,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderRadius: 10,
      padding: 3,
      marginBottom: 16,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
    },
    tabBtnActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
    },
    bodyScroll: {
      maxHeight: 380,
    },
    formContainer: {
      paddingVertical: 4,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.textPrimary,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 12,
      marginTop: 20,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
    },
    searchBarBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 42,
      marginBottom: 12,
    },
    searchBarInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    resultsList: {
      marginTop: 4,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    userInfo: {
      flex: 1,
      marginLeft: 10,
    },
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    userEmail: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    addSmallBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.4)' : '#A7F3D0',
    },
    addSmallBtnDone: {
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderColor: colors.border,
    },
    addSmallBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    emptyResultsText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 16,
    },
    searchHintText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 16,
    },
    shareBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F8FAF9',
      borderRadius: 12,
      padding: 12,
      marginTop: 20,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E6F4EA',
    },
    shareIconBox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    shareSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
  });

export default AddFriendModal;

