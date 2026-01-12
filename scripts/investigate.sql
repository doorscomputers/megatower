-- Investigate M2-2F-16 payment issue
\echo '=== UNIT M2-2F-16 ==='

SELECT u."unitNumber", o."lastName", o."firstName"
FROM "Unit" u
JOIN "Owner" o ON u."ownerId" = o.id
WHERE u."unitNumber" = 'M2-2F-16';

\echo ''
\echo '=== PAYMENTS ==='

SELECT p."paymentDate"::date as date, p."orNumber" as or_num, p."totalAmount" as total
FROM "Payment" p
JOIN "Unit" u ON p."unitId" = u.id
WHERE u."unitNumber" = 'M2-2F-16'
ORDER BY p."paymentDate" DESC;

\echo ''
\echo '=== BILLS ==='

SELECT
  to_char(b."billingMonth", 'YYYY-MM') as month,
  b."totalAmount" as total,
  b."paidAmount" as paid,
  b."balance" as balance,
  b."status"
FROM "Bill" b
JOIN "Unit" u ON b."unitId" = u.id
WHERE u."unitNumber" = 'M2-2F-16'
ORDER BY b."billingMonth" ASC;

\echo ''
\echo '=== BILL-PAYMENT ALLOCATIONS ==='

SELECT
  to_char(b."billingMonth", 'YYYY-MM') as bill_month,
  p."orNumber" as or_num,
  bp."amount" as allocated
FROM "BillPayment" bp
JOIN "Bill" b ON bp."billId" = b.id
JOIN "Payment" p ON bp."paymentId" = p.id
JOIN "Unit" u ON b."unitId" = u.id
WHERE u."unitNumber" = 'M2-2F-16'
ORDER BY b."billingMonth", p."paymentDate";

\echo ''
\echo '=== ADVANCE BALANCE ==='

SELECT ab."advanceDues", ab."advanceUtilities"
FROM "UnitAdvanceBalance" ab
JOIN "Unit" u ON ab."unitId" = u.id
WHERE u."unitNumber" = 'M2-2F-16';
