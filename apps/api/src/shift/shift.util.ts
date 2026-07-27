import { Prisma } from '../generated/prisma/client';

export interface ReconciliationTransaction {
  type: 'CASH_IN' | 'CASH_OUT';
  amount: Prisma.Decimal;
}

export interface CashReconciliation {
  totalSales: Prisma.Decimal;
  totalCashCollected: Prisma.Decimal;
  closingCashExpected: Prisma.Decimal;
  discrepancy: Prisma.Decimal;
}

/**
 * PRD §5.4's shift-close reconciliation. `totalSales` and
 * `totalCashCollected` are the same figure for now — every transaction
 * modeled before Milestone 5's payment gateways exist is cash by
 * definition — but are kept as separate fields (per the TRD's cash_reports
 * table) since a non-cash tender will eventually make them diverge.
 */
export function computeCashReconciliation(
  openingCash: Prisma.Decimal,
  transactions: ReconciliationTransaction[],
  closingCashActual: Prisma.Decimal,
): CashReconciliation {
  const totalCashCollected = transactions.reduce(
    (sum, t) => (t.type === 'CASH_IN' ? sum.add(t.amount) : sum.sub(t.amount)),
    new Prisma.Decimal(0),
  );
  const closingCashExpected = openingCash.add(totalCashCollected);
  const discrepancy = closingCashActual.sub(closingCashExpected);

  return {
    totalSales: totalCashCollected,
    totalCashCollected,
    closingCashExpected,
    discrepancy,
  };
}
