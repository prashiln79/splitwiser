import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Platform } from 'react-native';

export interface SupportTicketInput {
  userId: string;
  userName: string;
  userEmail?: string;
  message: string;
}

export async function submitSupportTicket(input: SupportTicketInput): Promise<string> {
  const ticketsCol = collection(db, 'splitwiser', 'data', 'support_tickets');
  const docRef = await addDoc(ticketsCol, {
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail || null,
    message: input.message.trim(),
    platform: Platform.OS,
    appVersion: '2.0.1',
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

