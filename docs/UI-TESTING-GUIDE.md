# UI Testing Guide - Billing System

## Test Scenario
Test billing with two units:
- **Unit A**: Has outstanding September balance, NO payment
- **Unit B**: Has outstanding September balance, WITH payment

Then generate October and November bills to verify penalty compounding.

---

## STEP 1: Start the Application

```bash
npm run dev
```

Open: http://localhost:3000

Login:
- Username: `admin`
- Password: `Admin@123456`

---

## STEP 2: Create Test Owners (if needed)

**Navigate to:** Owners > Add Owner (or `/owners/new`)

### Owner A (No Payment Test)
- Name: `Juan Test Unpaid`
- Email: `juan.unpaid@test.com`
- Phone: `09171111111`
- Address: `Test Address 1`

### Owner B (With Payment Test)
- Name: `Maria Test Paid`
- Email: `maria.paid@test.com`
- Phone: `09172222222`
- Address: `Test Address 2`

---

## STEP 3: Create Test Units

**Navigate to:** Units > Add Unit (or `/units/new`)

### Unit A - Test Unpaid
- Unit Number: `TEST-A`
- Floor Level: `2F`
- Area (sqm): `35`
- Unit Type: `RESIDENTIAL`
- Owner: `Juan Test Unpaid`
- Status: `OCCUPIED`

### Unit B - Test Paid
- Unit Number: `TEST-B`
- Floor Level: `2F`
- Area (sqm): `40`
- Unit Type: `RESIDENTIAL`
- Owner: `Maria Test Paid`
- Status: `OCCUPIED`

---

## STEP 4: Add September Meter Readings

**Navigate to:** Readings > Electric (or `/readings/electric`)

Select: Floor `2F`, Billing Period `September 2025`

### For TEST-A:
- Previous Reading: `1000`
- Present Reading: `1115` (consumption: 115 kWh)

### For TEST-B:
- Previous Reading: `2000`
- Present Reading: `2100` (consumption: 100 kWh)

Click **Save Readings**

---

**Navigate to:** Readings > Water (or `/readings/water`)

Select: Floor `2F`, Billing Period `September 2025`

### For TEST-A:
- Previous Reading: `100`
- Present Reading: `107` (consumption: 7 cu.m = Tier 3 = P370)

### For TEST-B:
- Previous Reading: `200`
- Present Reading: `205` (consumption: 5 cu.m = Tier 2 = P200)

Click **Save Readings**

---

## STEP 5: Generate September Bills

**Navigate to:** Billing > Generate Bills (or `/billing/generate`)

Select:
- Billing Month: `September 2025`
- Floor: `2F` (or All)

Click **Generate Bills**

### Expected September Bills:

**TEST-A (Juan Unpaid):**
| Component | Calculation | Amount |
|-----------|-------------|--------|
| Electric | 115 kWh × P8.39 | P964.85 |
| Water | 7 cu.m (Tier 3) | P370.00 |
| Assoc Dues | 35 sqm × P60 | P2,100.00 |
| **TOTAL** | | **P3,434.85** |

**TEST-B (Maria Paid):**
| Component | Calculation | Amount |
|-----------|-------------|--------|
| Electric | 100 kWh × P8.39 | P839.00 |
| Water | 5 cu.m (Tier 2) | P200.00 |
| Assoc Dues | 40 sqm × P60 | P2,400.00 |
| **TOTAL** | | **P3,439.00** |

---

## STEP 6: Record Payment for TEST-B Only

**Navigate to:** Payments > Record Payment (or `/payments/record`)

### Payment for Maria (TEST-B):
- Unit: `TEST-B`
- OR Number: `TEST-001`
- Payment Date: `September 25, 2025`
- Amount: `P3,439.00` (full payment)
- Payment Method: `CASH`

Click **Record Payment**

**DO NOT record payment for TEST-A** - this will test penalty calculation.

---

## STEP 7: Add October Meter Readings

**Navigate to:** Readings > Electric

Select: Floor `2F`, Billing Period `October 2025`

### For TEST-A:
- Previous Reading: `1115`
- Present Reading: `1215` (consumption: 100 kWh)

### For TEST-B:
- Previous Reading: `2100`
- Present Reading: `2180` (consumption: 80 kWh)

---

**Navigate to:** Readings > Water

Select: Floor `2F`, Billing Period `October 2025`

### For TEST-A:
- Previous Reading: `107`
- Present Reading: `112` (consumption: 5 cu.m = Tier 2 = P200)

### For TEST-B:
- Previous Reading: `205`
- Present Reading: `208` (consumption: 3 cu.m = Tier 2 = P200)

---

## STEP 8: Generate October Bills

**Navigate to:** Billing > Generate Bills

Select: Billing Month `October 2025`

Click **Generate Bills**

### Expected October Bills:

**TEST-A (Juan Unpaid) - WITH PENALTY:**
| Component | Calculation | Amount |
|-----------|-------------|--------|
| Electric | 100 kWh × P8.39 | P839.00 |
| Water | 5 cu.m (Tier 2) | P200.00 |
| Assoc Dues | 35 sqm × P60 | P2,100.00 |
| **October Charges** | | **P3,139.00** |
| Previous Balance | Sept unpaid | P3,434.85 |
| Penalty (10%) | P3,434.85 × 10% | P343.49 |
| **TOTAL DUE** | | **P6,917.34** |

**TEST-B (Maria Paid) - NO PENALTY:**
| Component | Calculation | Amount |
|-----------|-------------|--------|
| Electric | 80 kWh × P8.39 | P671.20 |
| Water | 3 cu.m (Tier 2) | P200.00 |
| Assoc Dues | 40 sqm × P60 | P2,400.00 |
| **TOTAL** | | **P3,271.20** |

---

## STEP 9: Add November Meter Readings

**Navigate to:** Readings > Electric

Select: Floor `2F`, Billing Period `November 2025`

### For TEST-A:
- Previous: `1215`, Present: `1300` (85 kWh)

### For TEST-B:
- Previous: `2180`, Present: `2270` (90 kWh)

---

**Navigate to:** Readings > Water

Select: Floor `2F`, Billing Period `November 2025`

### For TEST-A:
- Previous: `112`, Present: `114` (2 cu.m = Tier 2 = P200)

### For TEST-B:
- Previous: `208`, Present: `214` (6 cu.m = Tier 3 = P370)

---

## STEP 10: Generate November Bills

**Navigate to:** Billing > Generate Bills

Select: Billing Month `November 2025`

### Expected November Bills:

**TEST-A (Juan Unpaid) - COMPOUNDED PENALTY:**
| Component | Amount |
|-----------|--------|
| November Electric (85 kWh) | P713.15 |
| November Water (2 cu.m) | P200.00 |
| November Dues (35 sqm) | P2,100.00 |
| **November Charges** | **P3,013.15** |
| | |
| Previous Balance (Oct total) | P6,917.34 |
| Penalty on Oct (10%) | P691.73 |
| **TOTAL DUE** | **P10,622.22** |

**Penalty Breakdown for TEST-A:**
- Sept unpaid: P3,434.85
- Oct penalty: P343.49 (10% of Sept)
- Oct charges: P3,139.00
- Oct total: P6,917.34
- Nov penalty: P691.73 (10% of Oct total)
- Nov charges: P3,013.15
- **Nov total: P10,622.22**

**TEST-B (Maria Paid) - Still owes October:**
| Component | Amount |
|-----------|--------|
| November Electric | P755.10 |
| November Water | P370.00 |
| November Dues | P2,400.00 |
| **November Charges** | **P3,525.10** |
| Previous Balance (Oct) | P3,271.20 |
| Penalty (10%) | P327.12 |
| **TOTAL DUE** | **P7,123.42** |

---

## STEP 11: Verify in SOA

**Navigate to:** Billing > Statement of Account (or `/billing/soa`)

Select each unit and verify:
1. All transactions are listed chronologically
2. Payments show OR# numbers
3. Running balance is correct
4. Penalty calculations match expected values

---

## STEP 12: Check Collection Report

**Navigate to:** Reports > Daily Collection (or `/reports/collections`)

Select: Date `September 25, 2025`

Verify:
- Payment for TEST-B appears with OR# `TEST-001`
- Amount shows P3,439.00
- Component breakdown is correct

---

## Quick Reference - Expected Values

| Consumption | Expected Amount |
|-------------|-----------------|
| Electric 0 kWh | P50.00 (minimum) |
| Electric 100 kWh | P839.00 |
| Water 0-1 cu.m | P80.00 (Tier 1) |
| Water 2-5 cu.m | P200.00 (Tier 2) |
| Water 6-10 cu.m | P370.00 (Tier 3) |
| Water 12 cu.m | P450.00 (Tier 4) |
| Dues 35 sqm | P2,100.00 |
| Dues 40 sqm | P2,400.00 |

---

## Troubleshooting

If calculations don't match:
1. Check Settings > Billing Rates
2. Verify unit type is RESIDENTIAL (not COMMERCIAL)
3. Check if penalty rate is 10%
4. Verify readings were saved correctly

