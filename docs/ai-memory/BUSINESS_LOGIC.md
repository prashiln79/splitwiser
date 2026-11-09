# Core Business Logic & Invariants: Splitwiser

This document establishes the fundamental business logic, mathematical invariants, and domain rules governing Splitwiser.

---

## 1. Zero-Sum Group Balance Invariant

In any closed group, money is never created or destroyed; it is merely redistributed. Therefore:

$$\sum_{m \in \text{Members}} \text{NetBalance}(m) = 0.00$$

### Proof & Verification
- For every expense of amount $A$:
  $$\text{Contribution}_{\text{payers}} = A \quad \text{and} \quad \sum \text{Share}_{\text{participants}} = A$$
- Every settlement transfer $S$ between debtor $D$ and creditor $C$ adds $+S$ to $D$ and $-S$ to $C$, netting to zero change in total group value.
- If at any point the sum of all members' balances does not equal zero (within a 1-cent tolerance for rounding display), an error or missing transaction exists.

---

## 2. Group Membership & Role Hierarchy

### Roles: `admin` vs. `member`
| Action | Admin | Member |
|---|:---:|:---:|
| View expenses, settlements, balances | ✅ | ✅ |
| Add or edit expenses | ✅ | ✅ |
| Record settlements | ✅ | ✅ |
| Invite members via code or share link | ✅ | ✅ |
| Export data (CSV, summary) | ✅ | ✅ |
| Edit group name, type, and currency | ✅ | ❌ (unless permissions set to `anyone`) |
| Change debt simplification toggle | ✅ | ❌ |
| Remove another member | ✅ | ❌ |
| Delete or archive entire group | ✅ | ❌ |

### Member Removal Constraint
A group member cannot be removed if their individual net balance in the group is non-zero ($\text{NetBalance} \neq 0$). They must be completely settled up before removal to prevent orphaned debts.

---

## 3. Expense Lifecycle & Soft Deletion

1. **Creation**:
   - The user inputs total amount, description, payer(s), and participant shares.
   - Validation ensures: $\sum \text{PayerContributions} = \text{TotalAmount} = \sum \text{ParticipantShares}$.
   - The expense receives a unique UUID, `createdAt` timestamp, and `isDeleted: false`.
2. **Editing**:
   - Any group member can update an expense's description, amount, or split allocation.
   - The `updatedAt` timestamp is updated, and an activity log entry is recorded: `[User] updated expense "[Description]"`.
   - Balances are recalculated automatically.
3. **Soft Deletion (`isDeleted: true`)**:
   - Expenses are never hard-deleted from SQLite or Firestore.
   - Instead, `isDeleted` is set to `true`.
   - The balance calculation engine strictly excludes all expenses where `isDeleted === true`.
   - This preserves full historical audit trails and allows one-tap "Undo Delete" restoration.

---

## 4. Multi-Payer Architecture

When multiple individuals pay towards a single bill (e.g. at a team dinner):
1. The primary payer in `Expense.paidBy` is recorded as the first payer (for backwards compatibility).
2. All payer contributions are serialized into `Expense.tags` using the format:
   ```
   payer:{userId}:{amountInMajorUnits}
   ```
   *Example*: `["payer:user_alice:600", "payer:user_bob:400", "category:Food"]`
3. When `computeNetBalances` evaluates the expense:
   - It parses all `payer:` tags.
   - For each payer, it credits their net balance by their contributed amount.
   - It debits each participant's net balance by their assigned split share.

---

## 5. Debt Minimization (Simplification) vs. Direct Debts

Splitwiser supports two distinct settlement models configured by `Group.settings.simplifyDebts`:

### Model A: Simplified Debts (`simplifyDebts: true`)
- **Objective**: Minimize the total number of payments needed to settle all debts in the group.
- **Algorithm**:
  1. Calculate net balance for every member.
  2. Partition into `Creditors` (balance $> +0.01$) and `Debtors` (balance $< -0.01$).
  3. Sort debtors by largest debt and creditors by largest credit.
  4. Greedily match the largest debtor with the largest creditor. Transfer $\min(\text{debt}, \text{credit})$.
  5. Repeat until all balances are zero.
- **Result**: Reduces a complex group of $N$ members from potentially $O(N^2)$ pairwise transactions to at most $N - 1$ transactions.

### Model B: Direct Pairwise Debts (`simplifyDebts: false`)
- **Objective**: Preserve exact bilateral debtor-creditor relationships.
- **Algorithm**:
  - Maintains a pairwise key `min(u1, u2)::max(u1, u2)`.
  - For each expense, debits the participant and credits the specific payer directly.
  - Settlements reduce the specific debt between the two parties.
- **Result**: Alice only owes Bob if Bob paid for Alice's expense. No intermediate routing occurs.

---

## 6. Friend Balances (Aggregated Cross-Group)

When viewing a specific friend on `FriendDetailsScreen`:
1. The app queries all groups shared between `CurrentUserId` and `FriendId`.
2. For each shared group, it calculates the direct bilateral balance between the two users.
3. It loads direct (non-group) expenses between the two users.
4. It computes:
   $$\text{TotalFriendBalance} = \text{DirectBalance} + \sum_{g \in \text{SharedGroups}} \text{GroupPairwiseBalance}(g)$$
5. The UI displays the consolidated total along with an expandable breakdown:
   - *"Total: Rahul owes you ₹1,450"*
   - *"Goa Trip: owes you ₹1,200"*
   - *"Flat 402: owes you ₹250"*

