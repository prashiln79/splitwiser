const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Deterministic notification ID generator to guarantee idempotency.
 */
function getDeterministicNotifId(type, eventId, recipientId) {
  const clean = `${type}_${eventId}_${recipientId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `notif_${clean}`.substring(0, 120);
}

/**
 * Creates an in-app notification in the recipient's personal inbox.
 */
async function createInAppNotification(recipientId, payload) {
  if (!recipientId || recipientId === payload.actorId) {
    return; // Do not notify actor of their own actions
  }

  const notifId = getDeterministicNotifId(payload.type, payload.dedupeKey, recipientId);
  const notifRef = db.doc(`splitwiser/data/users/${recipientId}/notifications/${notifId}`);
  const summaryRef = db.doc(`splitwiser/data/users/${recipientId}/notificationMeta/summary`);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(notifRef);
    if (existing.exists) {
      // Idempotency: already created, skip duplicate
      return;
    }

    tx.set(notifRef, {
      ...payload,
      id: notifId,
      schemaVersion: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      readAt: null,
      archivedAt: null,
    });

    const sumSnap = await tx.get(summaryRef);
    if (sumSnap.exists) {
      const current = sumSnap.data().unreadCount || 0;
      tx.update(summaryRef, {
        unreadCount: current + 1,
        lastNotificationAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(summaryRef, {
        unreadCount: 1,
        lastNotificationAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
}

/**
 * Trigger: On Expense Created
 */
exports.onExpenseCreated = functions.firestore.onDocumentCreated(
  'splitwiser/data/groups/{groupId}/expenses/{expenseId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const expense = snap.data();
    const { groupId, expenseId } = event.params;

    // Get group info and members
    const groupSnap = await db.doc(`splitwiser/data/groups/${groupId}`).get();
    const groupName = groupSnap.exists ? groupSnap.data().name : 'Group';

    const membersSnap = await db.collection(`splitwiser/data/groups/${groupId}/members`).get();
    const memberIds = membersSnap.docs.map((d) => d.id).filter((id) => id !== expense.createdBy);

    const promises = memberIds.map((recipientId) =>
      createInAppNotification(recipientId, {
        type: 'expense_created',
        actorId: expense.createdBy,
        actorName: expense.paidBy || 'A member',
        groupId,
        groupName,
        expenseId,
        titleKey: 'notifications:expenseCreatedTitle',
        bodyKey: 'notifications:expenseCreatedBody',
        params: {
          actorName: expense.paidBy || 'A member',
          expenseDescription: expense.description || 'Expense',
          amountFormatted: `₹${Number(expense.amount || 0).toFixed(2)}`,
          amountMinor: Math.round((expense.amount || 0) * 100),
          groupName,
        },
        dedupeKey: `exp_created_${expenseId}`,
      })
    );

    await Promise.allSettled(promises);
  }
);

/**
 * Trigger: On Settlement Created
 */
exports.onSettlementCreated = functions.firestore.onDocumentCreated(
  'splitwiser/data/groups/{groupId}/settlements/{settlementId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const settlement = snap.data();
    const { groupId, settlementId } = event.params;

    // Notify payee
    const recipientId = settlement.toUserId;
    if (!recipientId || recipientId === settlement.fromUserId) return;

    await createInAppNotification(recipientId, {
      type: 'settlement_created',
      actorId: settlement.fromUserId,
      actorName: settlement.fromUserName || 'A member',
      groupId,
      settlementId,
      titleKey: 'notifications:settlementCreatedTitle',
      bodyKey: 'notifications:settlementCreatedBody',
      params: {
        actorName: settlement.fromUserName || 'A member',
        amountFormatted: `₹${Number(settlement.amount || 0).toFixed(2)}`,
        amountMinor: Math.round((settlement.amount || 0) * 100),
      },
      dedupeKey: `set_created_${settlementId}`,
    });
  }
);

