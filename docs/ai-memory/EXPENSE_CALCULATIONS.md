# Expense & Split Calculations: Mathematical Specification

This document provides the exact mathematical formulas, algorithms, and numerical examples for all financial calculations in Splitwiser.

---

## 1. Minor Currency Unit Foundation (`src/utils/splitMath.ts`)

To completely eliminate floating-point drift (e.g. `0.1 + 0.2 === 0.30000000000000004`), all calculations are performed internally in **integer minor units** (cents or paise).

### Unit Conversions
$$\text{toCents}(v) = \text{round}(v \times 100)$$
$$\text{fromCents}(c) = \frac{\text{round}(c)}{100}$$

```typescript
export const toCents = (val: number | string | undefined | null): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
};
```

---

## 2. The 6 Split Calculation Algorithms

### 2.1 Equal Split (`distributeCentsEqually`)
When dividing $T$ total cents across $N$ participants:

$$\text{BaseShare} = \lfloor \frac{T}{N} \rfloor$$
$$\text{Remainder} = T - (\text{BaseShare} \times N)$$

- The first $\text{Remainder}$ participants receive $\text{BaseShare} + 1$ cent.
- The remaining participants receive $\text{BaseShare}$ cents.

#### Numerical Example: ₹100.00 split among 3 people
- $T = 10000$ cents, $N = 3$
- $\text{BaseShare} = \lfloor 10000 / 3 \rfloor = 3333$ cents
- $\text{Remainder} = 10000 - (3333 \times 3) = 1$ cent
- **Participant 1**: 3334 cents (₹33.34)
- **Participant 2**: 3333 cents (₹33.33)
- **Participant 3**: 3333 cents (₹33.33)
- **Total Sum**: $3334 + 3333 + 3333 = 10000$ cents (Exact ₹100.00).

---

### 2.2 Unequal / Exact Split (`validateExactSplit`)
Participants are assigned custom monetary amounts $A_i$.

$$\text{Validation Invariant}: \quad \sum_{i=1}^N \text{toCents}(A_i) == \text{TotalCents}$$

If the sum of shares differs from total cents by even 1 cent, the form blocks submission and displays:
`"Shares total (₹X.XX) does not match bill total (₹Y.YY). Difference: ₹Z.ZZ"`.

---

### 2.3 Percentage Split (`distributeCentsByPercentages`)
Each participant $i$ is assigned a percentage $P_i \ge 0$, such that:

$$\sum_{i=1}^N P_i = 100\%$$

Each participant's preliminary share is:
$$\text{Share}_i = \lfloor \frac{\text{TotalCents} \times P_i}{100} \rfloor$$

The remaining cents ($\text{TotalCents} - \sum \text{Share}_i$) are distributed 1-by-1 to participants with $P_i > 0$.

#### Numerical Example: ₹100.00 split 50%, 30%, 20%
- $T = 10000$ cents
- **Participant 1 (50%)**: $\lfloor 10000 \times 0.50 \rfloor = 5000$ cents (₹50.00)
- **Participant 2 (30%)**: $\lfloor 10000 \times 0.30 \rfloor = 3000$ cents (₹30.00)
- **Participant 3 (20%)**: $\lfloor 10000 \times 0.20 \rfloor = 2000$ cents (₹20.00)
- **Sum**: $5000 + 3000 + 2000 = 10000$ cents.

---

### 2.4 Shares / Weighted Split (`distributeCentsByShares`)
Each participant is assigned integer shares $S_i \ge 0$.

$$\text{TotalShares} = \sum_{i=1}^N S_i$$
$$\text{Share}_i = \lfloor \frac{\text{TotalCents} \times S_i}{\text{TotalShares}} \rfloor$$

Remainder cents are distributed 1-by-1 to active participants with $S_i > 0$.

#### Numerical Example: ₹100.00 split 2 shares vs 1 share
- $T = 10000$ cents, $\text{TotalShares} = 2 + 1 = 3$
- **Participant 1 (2 shares)**: $\lfloor 10000 \times 2 / 3 \rfloor + 1 = 6667$ cents (₹66.67)
- **Participant 2 (1 share)**: $\lfloor 10000 \times 1 / 3 \rfloor = 3333$ cents (₹33.33)
- **Sum**: $6667 + 3333 = 10000$ cents.

---

### 2.5 Adjustment Split (`validateAdjustments`)
Participants agree to divide the bill equally except for individual offsets $\Delta_i$ (e.g. Alice ordered extra dessert for ₹200).

$$\text{Validation Invariant}: \quad \sum_{i=1}^N \Delta_i = 0$$

$$\text{Share}_i = \text{EqualShare}_i + \text{toCents}(\Delta_i)$$

Additionally, for every participant: $\text{Share}_i \ge 0$.

---

### 2.6 Itemized Split (`calculateItemizedSplit`)
A bill consists of distinct line items $k \in \{1, \dots, M\}$ with cost $C_k$, each consumed by a subset of participants $U_k \subseteq \text{Participants}$. Additionally, a total tax $T_{\text{tax}}$ and tip $T_{\text{tip}}$ are added.

1. **Item Share**:
   For item $k$ with $|U_k|$ consumers, each consumer receives:
   $$\text{ItemShare}_{i,k} = \frac{C_k}{|U_k|}$$
2. **Subtotal per Participant**:
   $$\text{Subtotal}_i = \sum_{k: i \in U_k} \text{ItemShare}_{i,k}$$
3. **Proportional Tax & Tip Allocation**:
   $$\text{TaxAndTipRatio} = \frac{T_{\text{tax}} + T_{\text{tip}}}{\sum_{j} \text{Subtotal}_j}$$
   $$\text{TaxTipShare}_i = \text{round}(\text{Subtotal}_i \times \text{TaxAndTipRatio})$$
4. **Final Share**:
   $$\text{FinalShare}_i = \text{Subtotal}_i + \text{TaxTipShare}_i$$

---

## 3. Debt Minimization Algorithm (`optimizeSettlements`)

```typescript
function optimizeSettlements(
  balances: Map<string, number>,
  members: GroupMember[]
): OptimizedSettlement[] {
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  balances.forEach((balance, userId) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) creditors.push({ userId, amount: rounded });
    else if (rounded < -0.01) debtors.push({ userId, amount: Math.abs(rounded) });
  });

  const settlements: OptimizedSettlement[] = [];
  let i = 0; // debtor index
  let j = 0; // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      fromUserName: getMemberName(debtor.userId),
      toUserName: getMemberName(creditor.userId),
      amount: Math.round(amount * 100) / 100,
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return settlements;
}
```

### Complexity Analysis
- **Time Complexity**: $O(M \log M)$ where $M \le N$ is the number of non-zero balance members (bounded by sorting, or $O(M)$ greedy two-pointer).
- **Space Complexity**: $O(M)$ to store the creditor and debtor lists.
- **Maximum Payments**: At most $N - 1$ settlement transactions for $N$ group members.

