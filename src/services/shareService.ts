import { Linking, Share, Platform, Alert } from 'react-native';
import {
  APP_NAME,
  PLAY_STORE_URL,
  APP_SCHEME,
  getGroupJoinDeepLink,
  formatShareDate,
  getGroupTypeEmoji,
  buildGroupInviteMessage,
  buildFriendInviteMessage,
  buildAppShareMessage,
  buildExpenseShareMessage,
  buildSettlementShareMessage,
  buildReminderMessage,
  buildGroupReminderMessage,
  GroupInviteParams,
  FriendInviteParams,
  ExpenseShareParams,
  SettlementShareParams,
  ReminderParams,
} from './shareMessageBuilder';

export * from './shareMessageBuilder';

export interface ShareOptions {
  message: string;
  title?: string;
  preferWhatsApp?: boolean;
}

// ── Native & WhatsApp Dispatchers ──────────────────────────────────────────

/**
 * Checks whether WhatsApp is available on the device.
 */
export async function isWhatsAppAvailable(): Promise<boolean> {
  try {
    const url = 'whatsapp://send';
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

/**
 * Sends a message directly to WhatsApp.
 * Returns true if WhatsApp was launched, false otherwise.
 */
export async function shareToWhatsApp(message: string): Promise<boolean> {
  try {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    // Attempt open directly as fallback in case package visibility hides it from canOpenURL
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(url);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Opens the system native share sheet.
 */
export async function shareNative(message: string, title?: string): Promise<boolean> {
  try {
    const result = await Share.share(
      {
        message,
        title: title || APP_NAME,
      },
      {
        dialogTitle: title || APP_NAME,
      }
    );
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/**
 * Shares content: If preferWhatsApp is requested, tries WhatsApp first;
 * if WhatsApp is unavailable or fails, falls back seamlessly to the native share sheet.
 */
export async function shareContent({
  message,
  title,
  preferWhatsApp,
}: ShareOptions): Promise<void> {
  if (preferWhatsApp) {
    const launched = await shareToWhatsApp(message);
    if (launched) {
      return;
    }
  }
  await shareNative(message, title);
}

/**
 * Shows an options prompt letting the user choose between WhatsApp and the system share sheet.
 * If WhatsApp is not available, immediately opens the system share sheet without an extra prompt.
 */
export async function shareWithOptions({
  message,
  title,
  dialogTitle,
}: {
  message: string;
  title?: string;
  dialogTitle?: string;
}): Promise<void> {
  const hasWhatsApp = await isWhatsAppAvailable();

  if (!hasWhatsApp) {
    await shareNative(message, title);
    return;
  }

  Alert.alert(
    dialogTitle || 'Share via',
    'Choose how you would like to share:',
    [
      {
        text: 'WhatsApp',
        onPress: async () => {
          const sent = await shareToWhatsApp(message);
          if (!sent) {
            await shareNative(message, title);
          }
        },
      },
      {
        text: 'Other Apps...',
        onPress: () => shareNative(message, title),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
}

// Default export object for convenient namespaced usage
export const shareService = {
  APP_NAME,
  PLAY_STORE_URL,
  APP_SCHEME,
  getGroupJoinDeepLink,
  formatShareDate,
  getGroupTypeEmoji,
  buildGroupInviteMessage,
  buildFriendInviteMessage,
  buildAppShareMessage,
  buildExpenseShareMessage,
  buildSettlementShareMessage,
  buildReminderMessage,
  buildGroupReminderMessage,
  isWhatsAppAvailable,
  shareToWhatsApp,
  shareNative,
  shareContent,
  shareWithOptions,
};

export default shareService;
