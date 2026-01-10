# 📐 Predix — Architecture Contract (v1)

**Application name:** Predix  
**Domain:** Paper trading for prediction markets (Polymarket)

This document defines the **locked architecture** of Predix.
Any deviation from this contract requires an explicit version upgrade.

---

## 1️⃣ System Components

### Frontend (Web / Mobile-first)
- React
- Privy authentication
- Stateless UI
- No permanent market data storage
- No duplication of Polymarket state

### Backend (Predix API)
- Authentication & authorization
- User persistence
- Paper trade persistence
- Portfolio storage
- Validation & access control

### External Services
- **Polymarket APIs** — market truth (read-only)
- **Privy** — identity provider

---

## 2️⃣ Source of Truth (Critical Rule)

| Data | Source of Truth |
|----|----|
| Market price | Polymarket |
| Market status | Polymarket |
| Market resolution | Polymarket |
| Liquidity & volume | Polymarket |
| User identity | Privy |
| User trades | Predix backend |
| Entry price | Predix backend |
| Shares | Predix backend |
| Portfolio totals | Derived (not stored) |

🚫 Predix must **never**:
- Store live market prices
- Mirror Polymarket markets
- Sync external market state
- Recompute values already provided by Polymarket

---

## 3️⃣ Responsibility Split

### 🔵 Polymarket
Provides:
- YES / NO prices
- Resolution result
- Market lifecycle
- Market timestamps
- Liquidity & volume

Used strictly **read-only**.

---

### 🟢 Predix Backend
Owns:
- Users
- Paper trades
- Positions
- Portfolio persistence
- Authentication tokens

Does **not**:
- Calculate PnL
- Calculate portfolio totals
- Track live prices

---

### 🟣 Predix Frontend
Responsible for:
- Position value calculation
- PnL calculation
- Portfolio totals
- Aggregations
- Mobile-first UI

All calculations are:
- Deterministic
- Stateless
- Derived from backend + Polymarket data

---

## 4️⃣ Calculation Policy (Locked)

| Calculation | Location | Stored |
|-----------|---------|--------|
| Entry price | Backend | ✅ |
| Shares | Backend | ✅ |
| Current value | Frontend | ❌ |
| Position PnL | Frontend | ❌ |
| Portfolio total | Frontend | ❌ |
| Historical PnL (future) | Backend | ✅ |

Backend must **never** recompute frontend math.

---

## 5️⃣ API Contract Direction

### Frontend → Backend
- Auth exchange
- Create paper trades
- Fetch user portfolio

### Backend → Polymarket
- Fetch market metadata
- Fetch live prices
- Fetch resolution state

🚫 No backend → frontend price pushing  
🚫 No Polymarket → Predix database syncing

---

## 6️⃣ Testing Strategy (Mobile-safe)

### Production
- No test buttons
- No debug UI

### Development
- Backend testable via REST tools (curl, Postman, mobile clients)
- Optional dev-only endpoints guarded by environment flags

Frontend testing relies on:
- Real backend responses
- Deterministic calculations

---

## 7️⃣ Non-Goals (Explicit)

Predix is **not**:
- A Polymarket mirror
- A pricing engine
- A market indexer
- A reconciliation system

---

## 8️⃣ Versioning Rule

Any change to:
- Source of truth
- Calculation ownership
- Stored data
- API direction

➡️ Requires a **new architecture version**

---

## ✅ Status

- Architecture locked
- Production-safe
- Ready for Polymarket integration