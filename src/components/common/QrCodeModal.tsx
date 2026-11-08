import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  QrCode,
  Camera,
  Share2,
  X,
  CheckCircle,
  RefreshCw,
  Hash,
  UserCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { addFriendRemote } from '../../services/friendService';
import { joinGroup } from '../../services/groups';
import { MemberAvatar } from './MemberAvatar';

interface QrCodeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (type: 'friend' | 'group', name: string) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'my_code' | 'scanner' | 'manual'>('my_code');
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Prepare QR Payload
  const qrPayload = JSON.stringify({
    app: 'splitwiser',
    type: 'friend',
    uid: user?.uid || '',
    name: user?.name || 'Friend',
    email: user?.email || '',
  });

  const handleShareInvite = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      await Share.share({
        message: `Connect with me on Splitwiser! My Friend ID is: ${user?.uid}\nOr scan my QR code in the app.`,
      });
    } catch {
      // Ignored
    }
  };

  const handleOpenScanner = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setScanned(false);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is needed to scan QR codes. You can also enter a friend code manually.',
          [
            { text: 'Enter Manually', onPress: () => setMode('manual') },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }
    }
    setMode('scanner');
  };

  const processScannedData = async (data: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    try {
      let parsed: any = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = null;
      }

      // 1. Splitwiser Friend QR Payload
      if (parsed && (parsed.type === 'friend' || parsed.app === 'splitwiser')) {
        const friendUid = parsed.uid;
        const friendName = parsed.name || 'Friend';
        const friendEmail = parsed.email || undefined;

        if (!friendUid) {
          throw new Error('Invalid friend QR code.');
        }
        if (friendUid === user?.uid) {
          Alert.alert('That’s You!', 'This is your own QR code.');
          setIsProcessing(false);
          setScanned(false);
          return;
        }

        await addFriendRemote(
          user!.uid,
          user!.name || 'User',
          friendUid,
          friendName,
          friendEmail
        );

        Alert.alert('Friend Connected!', `You and ${friendName} are now connected on Splitwiser.`);
        onSuccess?.('friend', friendName);
        handleClose();
        return;
      }

      // 2. Group Join Code (e.g. 6-character code)
      const cleanCode = data.trim().toUpperCase();
      if (/^[A-Z0-9]{6}$/.test(cleanCode) || (parsed && parsed.type === 'group')) {
        const joinCode = parsed?.code || cleanCode;
        const joinedGroup = await joinGroup(joinCode, user!.uid, user!.name || 'User');
        Alert.alert('Joined Group!', `You have successfully joined "${joinedGroup.name}".`);
        onSuccess?.('group', joinedGroup.name);
        handleClose();
        return;
      }

      // 3. Fallback: Check if data is raw UID
      if (data.length > 20 && !data.includes(' ')) {
        if (data === user?.uid) {
          Alert.alert('That’s You!', 'This is your own ID.');
          setIsProcessing(false);
          setScanned(false);
          return;
        }
        await addFriendRemote(
          user!.uid,
          user!.name || 'User',
          data.trim(),
          'Friend'
        );
        Alert.alert('Friend Connected!', 'Friend added successfully.');
        onSuccess?.('friend', 'Friend');
        handleClose();
        return;
      }

      throw new Error('Unrecognized Splitwiser QR Code. Please make sure you are scanning a valid friend or group code.');
    } catch (err: any) {
      Alert.alert('Unable to Connect', err.message || 'Failed to process QR code.', [
        {
          text: 'Try Again',
          onPress: () => {
            setScanned(false);
            setIsProcessing(false);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setIsProcessing(false);
            setMode('my_code');
          },
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;
    setScanned(true);
    processScannedData(data);
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      Alert.alert('Required', 'Please enter a friend ID or 6-digit group code.');
      return;
    }
    await processScannedData(manualCode.trim());
  };

  const handleClose = () => {
    setMode('my_code');
    setScanned(false);
    setIsProcessing(false);
    setManualCode('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {mode === 'my_code'
                ? 'Your QR Code'
                : mode === 'scanner'
                ? 'Scan QR Code'
                : 'Enter Code'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Mode 1: My Code */}
          {mode === 'my_code' && (
            <View style={styles.myCodeContent}>
              <Text style={styles.dialogSub}>
                Friends can scan this code to connect with you instantly on Splitwiser.
              </Text>

              {/* QR Code Container */}
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={qrPayload}
                  size={190}
                  color="#111827"
                  backgroundColor="#FFFFFF"
                />
              </View>

              {/* User snippet */}
              <View style={styles.userSnippetRow}>
                <MemberAvatar name={user?.name || 'User'} size={32} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.userSnippetName}>{user?.name || 'User'}</Text>
                  <Text style={styles.userSnippetSub}>
                    ID: {user?.uid ? `${user.uid.slice(0, 10)}...` : 'Unknown'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleOpenScanner}
                activeOpacity={0.85}
              >
                <Camera size={18} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionBtnText}>Scan a Friend's Code</Text>
              </TouchableOpacity>

              <View style={styles.secondaryBtnRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleShareInvite}
                  activeOpacity={0.7}
                >
                  <Share2 size={16} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryBtnText}>Share Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setMode('manual')}
                  activeOpacity={0.7}
                >
                  <Hash size={16} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryBtnText}>Enter Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mode 2: Camera Scanner */}
          {mode === 'scanner' && (
            <View style={styles.scannerContent}>
              <Text style={styles.scannerSub}>
                Center your friend's Splitwiser QR code in the frame below.
              </Text>

              <View style={styles.cameraBox}>
                {Platform.OS !== 'web' ? (
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  >
                    <View style={styles.targetFrameOverlay}>
                      <View style={styles.targetBox}>
                        <View style={[styles.cornerBracket, styles.topLeft]} />
                        <View style={[styles.cornerBracket, styles.topRight]} />
                        <View style={[styles.cornerBracket, styles.bottomLeft]} />
                        <View style={[styles.cornerBracket, styles.bottomRight]} />
                      </View>
                    </View>
                  </CameraView>
                ) : (
                  <View style={styles.webFallbackBox}>
                    <Text style={styles.webFallbackText}>
                      Camera scanning is supported on mobile devices.
                    </Text>
                    <TouchableOpacity
                      style={styles.webFallbackBtn}
                      onPress={() => setMode('manual')}
                    >
                      <Text style={styles.webFallbackBtnText}>Enter Code Manually</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isProcessing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="#059669" />
                    <Text style={styles.processingText}>Connecting...</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.switchModeBtn}
                onPress={() => setMode('my_code')}
                activeOpacity={0.7}
              >
                <QrCode size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.switchModeBtnText}>Show My QR Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mode 3: Manual Input */}
          {mode === 'manual' && (
            <View style={styles.manualContent}>
              <Text style={styles.dialogSub}>
                Enter a friend's User ID or a 6-digit Group Join Code to connect instantly.
              </Text>

              <TextInput
                style={styles.manualInput}
                placeholder="e.g. 6-digit code or User ID"
                placeholderTextColor="#9CA3AF"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleManualSubmit}
                disabled={isProcessing}
                activeOpacity={0.85}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <UserCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryActionBtnText}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModeBtn}
                onPress={() => setMode('my_code')}
                activeOpacity={0.7}
              >
                <QrCode size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.switchModeBtnText}>Back to My QR Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  dialogSub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  myCodeContent: {
    alignItems: 'center',
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  userSnippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  userSnippetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  userSnippetSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  // Scanner
  scannerContent: {
    alignItems: 'center',
  },
  scannerSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
    textAlign: 'center',
  },
  cameraBox: {
    width: 280,
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    marginBottom: 16,
  },
  targetFrameOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBox: {
    width: 190,
    height: 190,
    position: 'relative',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  webFallbackBox: {
    flex: 1,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  webFallbackText: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  webFallbackBtn: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  webFallbackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  switchModeBtnText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  // Manual
  manualContent: {
    alignItems: 'center',
  },
  manualInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
  },
});
