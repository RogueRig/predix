# Polymarket API Capability Map
Predix — Architecture Reference

This document defines **what data Predix should trust Polymarket for**
and **what Predix must compute or persist itself**.

The goal is to:
- Avoid duplicated calculations
- Keep backend thin
- Keep frontend simple
- Ensure deterministic results

---

## 1. Core Principle

> **If Polymarket already computes it, Predix should NOT recompute it.**

Predix acts as:
- A **portfolio & PnL layer**
- A **user-specific aggregation layer**
- NOT a market pricing engine

---

## 2. Market-Level Data (Polymarket Source of Truth)

### Provided by Polymarket APIs

| Data | Source | Notes |
|----|----|----|
| Market ID | Polymarket | Stable identifier |
| Market Question | Polymarket | Display only |
| Outcomes (YES / NO / others) | Polymarket | Canonical |
| Outcome Prices | Polymarket | Real-time |
| Liquidity | Polymarket | Informational |
| Volume | Polymarket | Informational |
| Resolution Status | Polymarket | Critical |
| Winning Outcome | Polymarket | On resolution |

✅ **Predix should never override or cache these values long-term**

---

## 3. Trade-Level Data (Predix Responsibility)

### NOT provided by Polymarket (paper trading scope)

| Data | Stored By Predix | Reason |
|----|----|----|
| User ID | Predix | Multi-user support |
| Market ID | Predix | Foreign key |
| Outcome | Predix | Position direction |
| Shares | Predix | User intent |
| Avg Entry Price | Predix | Paper execution |
| Timestamp | Predix | Ordering |

Polymarket **does not know** about:
- Paper trades
- User portfolios
- Simulated execution

➡️ These **must** live in Predix DB.

---

## 4. Calculations: Who Does What?

### Calculations Polymarket Already Handles

| Calculation | Owner |
|----|----|
| Current outcome price | Polymarket |
| Implied probability | Polymarket |
| Market resolution | Polymarket |
| Winning outcome | Polymarket |

🚫 Predix must NOT recompute these.

---

### Calculations Predix Must Perform

| Calculation | Formula |
|----|----|
| Position Value | `shares × current_price` |
| Cost Basis | `shares × avg_entry_price` |
| Unrealized PnL | `position_value − cost_basis` |
| Realized PnL | On resolution event |
| Portfolio Total | Sum of positions |

✅ These are **user-specific**, not market-specific.

---

## 5. Resolution Handling Strategy (Future)

Predix **does not resolve markets**.

Instead:
1. Polymarket marks market as resolved
2. Polymarket declares winning outcome
3. Predix:
   - Reads resolution status
   - Computes final PnL
   - Locks position
   - Marks position as settled

No manual overrides.

---

## 6. Data We Intentionally Do NOT Store

To reduce complexity, Predix does **not persist**:

- Live order books
- Historical tick prices
- Liquidity curves
- AMM math
- Odds formulas

These are **display-only** and fetched live.

---

## 7. Caching Rules

| Data Type | Cache? | TTL |
|----|----|----|
| Market metadata | Yes | Short (minutes) |
| Prices | Optional | Very short |
| User positions | No | Always DB |
| Portfolio totals | No | Derived |

---

## 8. Architectural Summary

**Polymarket**
- Market truth
- Prices
- Resolution

**Predix Backend**
- Users
- Positions
- Aggregations
- Persistence

**Predix Frontend**
- Display
- Lightweight calculations
- UX only

---

## 9. Explicit Non-Goals (Important)

Predix is **NOT**:
- A pricing oracle
- A trading engine
- A market maker
- A Polymarket replacement

Predix is a **portfolio intelligence layer**.

---

## 10. Next Optional Steps (Not Required Now)

- Add Polymarket read-only adapter
- Add resolution sync job
- Add historical performance charts

All optional, all incremental.

---

Document status: **APPROVED FOR IMPLEMENTATION**