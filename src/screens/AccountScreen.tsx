import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  User,
  Edit3,
  Shield,
  MessageSquare,
  Info,
  ChevronRight,
  Lock,
  LogOut,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/common/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { GoogleIcon } from '../components/common/GoogleIcon';
import { ConnectGoogleModal } from '../components/common/ConnectGoogleModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

const AccountScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [confirmSignOutVisible, setConfirmSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isGoogleLinked = !user?.isAnonymous && user?.authProvider === 'google';

  const handleComingSoon = (feature: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Alert.alert(feature, 'This feature will be available in the upcoming release.');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setConfirmSignOutVisible(false);
    } catch (err: any) {
      Alert.alert('Sign Out Failed', err.message || 'Could not sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Account" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 80, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileSection}>
          <MemberAvatar
            name={user?.name || 'User'}
            imageUrl={user?.imageUrl}
            size={56}
          />

          <View style={styles.profileInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name || 'Anonymous User'}
            </Text>

            {isGoogleLinked ? (
              <View style={styles.badgeRow}>
                <CheckCircle2 size={13} color="#1CC88A" strokeWidth={2.4} />
                <Text style={styles.badgeTextLinked} numberOfLines={1}>
                  {user?.email || 'Google Account Connected'}
                </Text>
              </View>
            ) : (
              <View style={styles.badgeRow}>
                <Lock size={12} color="#6B6B6B" strokeWidth={2} />
                <Text style={styles.badgeTextGuest} numberOfLines={1}>
                  Guest Account • UID: {user?.uid.slice(0, 8)}...
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
          >
            <Edit3 size={18} color="#059669" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Upgrade to Google Banner (when anonymous) */}
        {!isGoogleLinked && (
          <View style={styles.upgradeCard}>
            <View style={styles.upgradeHeader}>
              <View style={styles.googleIconCircle}>
                <GoogleIcon size={20} />
              </View>
              <View style={styles.upgradeHeaderText}>
                <Text style={styles.upgradeTitle}>Connect Google Account</Text>
                <Text style={styles.upgradeSubtitle}>
                  Backup and sync your expenses across devices
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.connectGoogleBtn}
              onPress={() => setConnectModalVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Connect Google Account"
            >
              <GoogleIcon size={16} />
              <Text style={styles.connectGoogleBtnText}>Connect with Google</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section: Account */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          <View style={styles.rowsContainer}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.6}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <User size={20} color="#1A1A1A" strokeWidth={1.8} style={styles.settingIcon} />
                <Text style={styles.settingTitle}>Personal Information</Text>
              </View>
              <ChevronRight size={18} color="#9E9E9E" />
            </TouchableOpacity>

            {!isGoogleLinked && (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setConnectModalVisible(true)}
                activeOpacity={0.6}
                accessibilityRole="button"
              >
                <View style={styles.settingLeft}>
                  <View style={styles.settingIcon}>
                    <GoogleIcon size={18} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Connect Google Account</Text>
                    <Text style={styles.settingSubtitle}>Upgrade guest account</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#9E9E9E" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.settingRow, styles.lastRow]}
              onPress={() => handleComingSoon('Privacy & Data')}
              activeOpacity={0.6}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <Shield size={20} color="#1A1A1A" strokeWidth={1.8} style={styles.settingIcon} />
                <Text style={styles.settingTitle}>Privacy & Data</Text>
              </View>
              <ChevronRight size={18} color="#9E9E9E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Support */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SUPPORT & ABOUT</Text>
          <View style={styles.rowsContainer}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => handleComingSoon('Feedback')}
              activeOpacity={0.6}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <MessageSquare size={20} color="#1A1A1A" strokeWidth={1.8} style={styles.settingIcon} />
                <Text style={styles.settingTitle}>Send Feedback</Text>
              </View>
              <ChevronRight size={18} color="#9E9E9E" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, styles.lastRow]}
              onPress={() =>
                Alert.alert(
                  'About Splitwiser',
                  'Splitwiser is a simple, intuitive expense sharing app for stress-free finances with friends, roommates, and groups.\n\nVersion 2.0.1'
                )
              }
              activeOpacity={0.6}
              accessibilityRole="button"
            >
              <View style={styles.settingLeft}>
                <Info size={20} color="#1A1A1A" strokeWidth={1.8} style={styles.settingIcon} />
                <Text style={styles.settingTitle}>About Splitwiser</Text>
              </View>
              <ChevronRight size={18} color="#9E9E9E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        {isGoogleLinked && (
          <View style={styles.section}>
            <View style={styles.rowsContainer}>
              <TouchableOpacity
                style={[styles.settingRow, styles.lastRow]}
                onPress={() => setConfirmSignOutVisible(true)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Sign Out"
              >
                <View style={styles.settingLeft}>
                  <LogOut size={20} color="#E74C3C" strokeWidth={1.8} style={styles.settingIcon} />
                  <Text style={[styles.settingTitle, { color: '#E74C3C', fontWeight: '600' }]}>
                    Log Out
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Version Footer */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Splitwiser v2.0.1 • Made for friends</Text>
        </View>
      </ScrollView>

      {/* Connect Google Modal */}
      <ConnectGoogleModal
        visible={connectModalVisible}
        onDismiss={() => setConnectModalVisible(false)}
      />

      {/* Sign Out Confirmation */}
      <ConfirmationDialog
        visible={confirmSignOutVisible}
        onDismiss={() => setConfirmSignOutVisible(false)}
        onConfirm={handleSignOut}
        title="Log Out?"
        message="Your account is safely linked to Google. You can log back in anytime on this or another device."
        confirmLabel="Log Out"
        isDestructive
        isLoading={isSigningOut}
        icon="logout"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  badgeTextLinked: {
    fontSize: 13,
    color: '#1CC88A',
    fontWeight: '500',
  },
  badgeTextGuest: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  editBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F0FAF6',
  },
  upgradeCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  googleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upgradeHeaderText: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  upgradeSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 1,
  },
  connectGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 8,
  },
  connectGoogleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  rowsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 14,
    width: 22,
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 1,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '500',
  },
});

export default AccountScreen;
