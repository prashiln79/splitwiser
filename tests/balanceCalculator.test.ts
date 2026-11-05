import {
  computeDetailedFriendBalance,
  computeFriendBalances,
  computeNetBalances,
  optimizeSettlements,
} from '../src/utils/balanceCalculator';
import { Expense, GroupMember, Settlement } from '../src/types';

function runTests() {
  console.log('--- STARTING BALANCE CALCULATOR UNIT TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  const userMe: GroupMember = { userId: 'user_me', userName: 'Me', role: 'admin', joinedAt: new Date() };
  const userRahul: GroupMember = { userId: 'user_rahul', userName: 'Rahul', role: 'member', joinedAt: new Date() };
  const userCharlie: GroupMember = { userId: 'user_charlie', userName: 'Charlie', role: 'member', joinedAt: new Date() };

  // Scenario 1: Current user pays, friend owes their share
  {
    const exp: Expense = {
      id: 'e1',
      groupId: 'direct_me_rahul',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Dinner',
      amount: 1000,
      splits: [
        { userId: 'user_me', amount: 500, type: 'equal' },
        { userId: 'user_rahul', amount: 500, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', [], [exp], []);
    assert(res.netBalance === 500, 'Scenario 1: Current user pays ₹1000, Rahul owes ₹500');
    assert(res.directBalance === 500, 'Scenario 1: Direct balance is ₹500');
  }

  // Scenario 2: Friend pays, current user owes their share
  {
    const exp: Expense = {
      id: 'e2',
      groupId: 'direct_me_rahul',
      createdBy: 'user_rahul',
      paidBy: 'user_rahul',
      description: 'Groceries',
      amount: 1000,
      splits: [
        { userId: 'user_me', amount: 500, type: 'equal' },
        { userId: 'user_rahul', amount: 500, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', [], [exp], []);
    assert(res.netBalance === -500, 'Scenario 2: Rahul pays ₹1000, current user owes ₹500 (-500)');
  }

  // Scenario 3: Multiple expenses with the same friend (netting)
  {
    const exp1: Expense = {
      id: 'e3_1',
      groupId: 'direct_me_rahul',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Dinner',
      amount: 1000,
      splits: [
        { userId: 'user_me', amount: 0, type: 'exact' },
        { userId: 'user_rahul', amount: 1000, type: 'exact' },
      ],
      splitType: 'exact',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const exp2: Expense = {
      id: 'e3_2',
      groupId: 'direct_me_rahul',
      createdBy: 'user_rahul',
      paidBy: 'user_rahul',
      description: 'Coffee',
      amount: 400,
      splits: [
        { userId: 'user_me', amount: 400, type: 'exact' },
        { userId: 'user_rahul', amount: 0, type: 'exact' },
      ],
      splitType: 'exact',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', [], [exp1, exp2], []);
    assert(res.netBalance === 600, 'Scenario 3: Me +₹1000, Rahul +₹400 -> Net +₹600');
  }

  // Scenario 4: Multiple shared groups
  {
    const goaExp: Expense = {
      id: 'e_goa',
      groupId: 'g_goa',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Goa Resort',
      amount: 2400,
      splits: [
        { userId: 'user_me', amount: 1200, type: 'equal' },
        { userId: 'user_rahul', amount: 1200, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const aptExp: Expense = {
      id: 'e_apt',
      groupId: 'g_apt',
      createdBy: 'user_rahul',
      paidBy: 'user_rahul',
      description: 'WiFi Bill',
      amount: 600,
      splits: [
        { userId: 'user_me', amount: 300, type: 'equal' },
        { userId: 'user_rahul', amount: 300, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const groups = [
      {
        groupId: 'g_goa',
        groupName: 'Goa Trip',
        expenses: [goaExp],
        members: [userMe, userRahul],
      },
      {
        groupId: 'g_apt',
        groupName: 'Apartment',
        expenses: [aptExp],
        members: [userMe, userRahul],
      },
    ];

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', groups, [], []);
    assert(res.netBalance === 900, 'Scenario 4: Goa (+₹1200) - Apt (-₹300) = ₹900');
    assert(res.groups.length === 2, 'Scenario 4: Two groups represented in breakdown');
  }

  // Scenario 5: Direct expenses combined with group expenses (₹1,200 - ₹300 + ₹250 = ₹1,150)
  {
    const goaExp: Expense = {
      id: 'e_goa',
      groupId: 'g_goa',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Goa Resort',
      amount: 2400,
      splits: [
        { userId: 'user_me', amount: 1200, type: 'equal' },
        { userId: 'user_rahul', amount: 1200, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const aptExp: Expense = {
      id: 'e_apt',
      groupId: 'g_apt',
      createdBy: 'user_rahul',
      paidBy: 'user_rahul',
      description: 'Electricity',
      amount: 600,
      splits: [
        { userId: 'user_me', amount: 300, type: 'equal' },
        { userId: 'user_rahul', amount: 300, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const directExp: Expense = {
      id: 'e_dir',
      groupId: 'direct_me_rahul',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Movie ticket',
      amount: 500,
      splits: [
        { userId: 'user_me', amount: 250, type: 'equal' },
        { userId: 'user_rahul', amount: 250, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const groups = [
      { groupId: 'g_goa', groupName: 'Goa Trip', expenses: [goaExp], members: [userMe, userRahul] },
      { groupId: 'g_apt', groupName: 'Apartment', expenses: [aptExp], members: [userMe, userRahul] },
    ];

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', groups, [directExp], []);
    assert(res.netBalance === 1150, 'Scenario 5: ₹1200 (Goa) - ₹300 (Apt) + ₹250 (Direct) = ₹1150');
  }

  // Scenario 6: Partial settlement (Rahul owes ₹1000, pays ₹400 -> owes ₹600)
  {
    const exp: Expense = {
      id: 'e6',
      groupId: 'direct_me_rahul',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Concert',
      amount: 2000,
      splits: [
        { userId: 'user_me', amount: 1000, type: 'equal' },
        { userId: 'user_rahul', amount: 1000, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const settlement: Settlement = {
      id: 's6',
      groupId: 'direct_me_rahul',
      fromUserId: 'user_rahul',
      toUserId: 'user_me',
      fromUserName: 'Rahul',
      toUserName: 'Me',
      amount: 400,
      status: 'completed',
      createdAt: new Date(),
    };

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', [], [exp], [settlement]);
    assert(res.netBalance === 600, 'Scenario 6: Owes ₹1000, paid ₹400 -> New balance ₹600');
  }

  // Scenario 7: Full settlement
  {
    const exp: Expense = {
      id: 'e7',
      groupId: 'direct_me_rahul',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Concert',
      amount: 2000,
      splits: [
        { userId: 'user_me', amount: 1000, type: 'equal' },
        { userId: 'user_rahul', amount: 1000, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const settlement: Settlement = {
      id: 's7',
      groupId: 'direct_me_rahul',
      fromUserId: 'user_rahul',
      toUserId: 'user_me',
      fromUserName: 'Rahul',
      toUserName: 'Me',
      amount: 1000,
      status: 'completed',
      createdAt: new Date(),
    };

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', [], [exp], [settlement]);
    assert(res.netBalance === 0, 'Scenario 7: Full settlement gives net balance ₹0');
  }

  // Scenario 8: Deleted expense is excluded
  {
    const deletedExp: Expense = {
      id: 'e8_del',
      groupId: 'direct_me_rahul',
      createdBy: 'user_me',
      paidBy: 'user_me',
      description: 'Cancelled Lunch',
      amount: 1000,
      splits: [
        { userId: 'user_me', amount: 500, type: 'equal' },
        { userId: 'user_rahul', amount: 500, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: true,
    };

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', [], [deletedExp], []);
    assert(res.netBalance === 0, 'Scenario 8: Soft-deleted expense ignored in balance calculation');
  }

  // Scenario 9: 3-person group bilateral isolation
  // (Charlie paid for Me and Rahul; neither I nor Rahul owe each other directly for Charlie's expense)
  {
    const exp3Way: Expense = {
      id: 'e9_3way',
      groupId: 'g_3way',
      createdBy: 'user_charlie',
      paidBy: 'user_charlie',
      description: 'Charlie bought Pizza',
      amount: 900,
      splits: [
        { userId: 'user_charlie', amount: 300, type: 'equal' },
        { userId: 'user_me', amount: 300, type: 'equal' },
        { userId: 'user_rahul', amount: 300, type: 'equal' },
      ],
      splitType: 'equal',
      currency: 'INR',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const groups = [
      { groupId: 'g_3way', groupName: 'Trio Group', expenses: [exp3Way], members: [userMe, userRahul, userCharlie] },
    ];

    const res = computeDetailedFriendBalance('user_me', 'user_rahul', 'Rahul', groups, [], []);
    assert(res.netBalance === 0, 'Scenario 9: 3rd party payer does not create bilateral debt between other 2 members');
  }

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
