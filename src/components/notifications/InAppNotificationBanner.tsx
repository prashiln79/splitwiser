import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Receipt,
  CircleDollarSign,
  UserPlus,
  Users,
  BellRing,
  MessageSquare,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../theme';
import { useNotifications } from '../../context/NotificationContext';
import { InAppNotification, InAppNotificationType } from '../../types/notifications';
import { resolveNotificationRoute } from '../../services/notificationRouter';
import { resolveNotificationDisplay } from '../../services/localNotificationService';
import { MemberAvatar } from '../common/MemberAvatar';

interface InAppNotificationBannerProps {
  navigationRef?: any;
}

const getEventIcon = (type: InAppNotificationType, color: string) => {
  switch (type) {
    case 'expense_created':
    case 'expense_updated':
    case 'expense_restored':
      return <Receipt size={18} color={color} strokeWidth={2.2} />;
    case 'settlement_created':
    case 'settlement_updated':
      return <CircleDollarSign size={18} color={color} strokeWidth={2.2} />;
    case 'group_invitation':
    case 'member_joined':
      return <UserPlus size={18} color={color} strokeWidth={2.2} />;
    case 'payment_reminder':
    case 'scheduled_reminder':
      return <BellRing size={18} color={color} strokeWidth={2.2} />;
    case 'expense_comment':
    case 'member_mention':
      return <MessageSquare size={18} color={color} strokeWidth={2.2} />;
    case 'expense_deleted':
    case 'settlement_deleted':
    case 'member_removed':
      return <AlertCircle size={18} color={color} strokeWidth={2.2} />;
    default:
      return <Receipt size={18} color={color} strokeWidth={2.2} />;
  }
};

const getEventColor = (type: InAppNotificationType, isDark: boolean) => {
  switch (type) {
    case 'settlement_created':
    case 'settlement_updated':
      return { fg: isDark ? '#34D399' : '#059669', bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5' };
    case 'expense_deleted':
    case 'settlement_deleted':
    case 'member_removed':
      return { fg: isDark ? '#F87171' : '#DC2626', bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2' };
    case 'payment_reminder':
    case 'scheduled_reminder':
      return { fg: isDark ? '#FBBF24' : '#D97706', bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FFFBEB' };
    default:
      return { fg: isDark ? '#38BDF8' : '#0284C7', bg: isDark ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE' };
  }
};

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = () => {
  // Suppressed: notifications are delivered via native Android OS notifications
  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 9999,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
