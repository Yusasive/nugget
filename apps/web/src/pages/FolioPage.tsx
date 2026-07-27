import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import type {
  FolioChargeCategory,
  FolioDto,
  InitiatePaymentResponse,
  InvoiceDto,
  PaymentDto,
  PaymentMethod,
  PaymentProvider,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { api, ApiError, downloadAuthenticatedFile } from '../lib/api-client';

const EMPTY_CHARGE: { description: string; amount: string; category: FolioChargeCategory } = {
  description: '',
  amount: '',
  category: 'INCIDENTAL',
};
const EMPTY_PAYMENT = { method: 'CASH' as PaymentMethod, provider: 'MANUAL' as PaymentProvider, amount: '' };
const EMPTY_REFUND = { amount: '', reason: '' };

const INVOICE_STATUS_PILL: Record<InvoiceDto['paymentStatus'], string> = {
  UNPAID: 'error',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
};

const PAYMENT_STATUS_PILL: Record<PaymentDto['status'], string> = {
  PENDING: 'info',
  SUCCESSFUL: 'success',
  FAILED: 'error',
  REFUNDED: 'error',
  PARTIALLY_REFUNDED: 'warning',
};

export function FolioPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'FRONT_DESK';
  const canRefund =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'ACCOUNTANT';

  const [chargeForm, setChargeForm] = useState(EMPTY_CHARGE);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [refundForm, setRefundForm] = useState(EMPTY_REFUND);
  const [error, setError] = useState<string | null>(null);

  const folio = useQuery({
    queryKey: ['folio', bookingId],
    queryFn: () => api.get<FolioDto>(`/bookings/${bookingId}/folio`),
    enabled: !!bookingId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['folio', bookingId] });

  const addCharge = useMutation({
    mutationFn: () =>
      api.post(`/bookings/${bookingId}/folio-charges`, {
        description: chargeForm.description,
        amount: chargeForm.amount,
        category: chargeForm.category,
      }),
    onSuccess: async () => {
      setChargeForm(EMPTY_CHARGE);
      setError(null);
      await invalidate();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not add charge'),
  });

  const issueInvoice = useMutation({
    mutationFn: () => api.post<InvoiceDto>(`/bookings/${bookingId}/invoices`),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not issue invoice'),
  });

  const voidInvoice = useMutation({
    mutationFn: (invoiceId: string) => api.post<InvoiceDto>(`/invoices/${invoiceId}/void`),
    onSuccess: () => invalidate(),
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      api.post<InitiatePaymentResponse>(`/invoices/${paymentInvoiceId}/payments`, {
        method: paymentForm.method,
        amount: paymentForm.amount,
        provider: paymentForm.provider,
      }),
    onSuccess: async (res) => {
      setPaymentInvoiceId(null);
      setPaymentForm(EMPTY_PAYMENT);
      setError(null);
      await invalidate();
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      }
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not record payment'),
  });

  const refundPayment = useMutation({
    mutationFn: () =>
      api.post(`/payments/${refundPaymentId}/refund`, {
        amount: refundForm.amount,
        reason: refundForm.reason || undefined,
      }),
    onSuccess: async () => {
      setRefundPaymentId(null);
      setRefundForm(EMPTY_REFUND);
      setError(null);
      await invalidate();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not process refund'),
  });

  function handleChargeSubmit(event: FormEvent) {
    event.preventDefault();
    addCharge.mutate();
  }

  function handlePaymentSubmit(event: FormEvent) {
    event.preventDefault();
    recordPayment.mutate();
  }

  function handleRefundSubmit(event: FormEvent) {
    event.preventDefault();
    refundPayment.mutate();
  }

  if (folio.isPending) return <p className="muted">Loading folio…</p>;
  if (folio.isError || !folio.data) return <div className="alert error">Could not load folio.</div>;

  const data = folio.data;
  const hasActiveInvoice = data.invoices.some((inv) => inv.status === 'ISSUED');
  const paymentInvoice = data.invoices.find((inv) => inv.id === paymentInvoiceId);

  return (
    <>
      <div className="page-header">
        <h2>Guest Folio</h2>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      <div className="card-grid" style={{ marginBottom: 'var(--gutter)' }}>
        <div className="metric-card">
          <div className="label">Total charges</div>
          <div className="value">₦{data.totalCharges}</div>
        </div>
        <div className="metric-card">
          <div className="label">Total paid</div>
          <div className="value">₦{data.totalPaid}</div>
        </div>
        <div className="metric-card">
          <div className="label">Balance due</div>
          <div className="value">₦{data.balanceDue}</div>
        </div>
      </div>

      <h3>Charges</h3>
      <div className="table-wrap" style={{ marginBottom: 'var(--gutter)' }}>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Added by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Room charge (incl. early/late fee)</td>
              <td className="muted">ROOM</td>
              <td>
                ₦{data.roomCharge}
                {data.earlyCheckInFee && <span className="muted"> (+₦{data.earlyCheckInFee} early)</span>}
                {data.lateCheckOutFee && <span className="muted"> (+₦{data.lateCheckOutFee} late)</span>}
              </td>
              <td className="muted">—</td>
            </tr>
            {data.charges.map((charge) => (
              <tr key={charge.id}>
                <td>{charge.description}</td>
                <td className="muted">{charge.category}</td>
                <td>₦{charge.amount}</td>
                <td>
                  {charge.createdByStaff.firstName} {charge.createdByStaff.lastName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form className="form-card" onSubmit={handleChargeSubmit} style={{ marginBottom: 'var(--gutter)' }}>
          <div className="field">
            <label htmlFor="charge-description">Add charge: description</label>
            <input
              id="charge-description"
              required
              value={chargeForm.description}
              onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="charge-category">Category</label>
            <select
              id="charge-category"
              value={chargeForm.category}
              onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value as 'INCIDENTAL' | 'FEE' })}
            >
              <option value="INCIDENTAL">Incidental</option>
              <option value="FEE">Fee</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="charge-amount">Amount</label>
            <input
              id="charge-amount"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={chargeForm.amount}
              onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={addCharge.isPending}>
            {addCharge.isPending ? 'Adding…' : 'Add charge'}
          </button>
        </form>
      )}

      <div className="page-header">
        <h3>Invoices</h3>
        {canManage && !hasActiveInvoice && (
          <button type="button" className="btn-primary" onClick={() => issueInvoice.mutate()} disabled={issueInvoice.isPending}>
            {issueInvoice.isPending ? 'Issuing…' : 'Issue invoice'}
          </button>
        )}
      </div>

      {data.invoices.length === 0 && <p className="muted">No invoices issued yet.</p>}

      {data.invoices.map((invoice) => (
        <div key={invoice.id} className="form-card" style={{ marginBottom: 'var(--gutter)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1' }}>
            <div>
              <strong>{invoice.invoiceNumber}</strong>{' '}
              <span className={`pill ${invoice.status === 'VOID' ? 'error' : INVOICE_STATUS_PILL[invoice.paymentStatus]}`}>
                {invoice.status === 'VOID' ? 'VOID' : invoice.paymentStatus}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => downloadAuthenticatedFile(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}
              >
                Download PDF
              </button>
              {canManage && invoice.status === 'ISSUED' && invoice.paymentStatus === 'UNPAID' && (
                <button type="button" className="btn-link" onClick={() => voidInvoice.mutate(invoice.id)}>
                  Void
                </button>
              )}
              {canManage && invoice.status === 'ISSUED' && invoice.paymentStatus !== 'PAID' && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setPaymentInvoiceId(invoice.id);
                    setPaymentForm({ ...EMPTY_PAYMENT, amount: invoice.balanceDue });
                  }}
                >
                  Record payment
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap" style={{ gridColumn: '1 / -1' }}>
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Provider</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoice.payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No payments yet.
                    </td>
                  </tr>
                )}
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.method}</td>
                    <td className="muted">{payment.provider}</td>
                    <td>₦{payment.amount}</td>
                    <td>
                      <span className={`pill ${PAYMENT_STATUS_PILL[payment.status]}`}>{payment.status}</span>
                    </td>
                    <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
                      {(payment.status === 'SUCCESSFUL' || payment.status === 'PARTIALLY_REFUNDED') && (
                        <>
                          {canRefund && (
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => setRefundPaymentId(payment.id)}
                            >
                              Refund
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() =>
                              downloadAuthenticatedFile(
                                `/payments/${payment.id}/receipt.pdf`,
                                `receipt-${invoice.invoiceNumber}.pdf`,
                              )
                            }
                          >
                            Receipt
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Drawer
        open={paymentInvoiceId !== null}
        title={`Record payment — ${paymentInvoice?.invoiceNumber ?? ''}`}
        onClose={() => setPaymentInvoiceId(null)}
      >
        <form className="form-card" onSubmit={handlePaymentSubmit}>
          <p className="muted">Balance due: ₦{paymentInvoice?.balanceDue}</p>
          <div className="field">
            <label htmlFor="pay-provider">Provider</label>
            <select
              id="pay-provider"
              value={paymentForm.provider}
              onChange={(e) => setPaymentForm({ ...paymentForm, provider: e.target.value as PaymentProvider })}
            >
              <option value="MANUAL">Manual (cash / POS in person)</option>
              <option value="PAYSTACK">Paystack</option>
              <option value="FLUTTERWAVE">Flutterwave</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pay-method">Method</label>
            <select
              id="pay-method"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="USSD">USSD</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pay-amount">Amount</label>
            <input
              id="pay-amount"
              inputMode="decimal"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={recordPayment.isPending}>
            {recordPayment.isPending ? 'Recording…' : 'Record payment'}
          </button>
        </form>
      </Drawer>

      <Drawer open={refundPaymentId !== null} title="Refund payment" onClose={() => setRefundPaymentId(null)}>
        <form className="form-card" onSubmit={handleRefundSubmit}>
          <div className="field">
            <label htmlFor="refund-amount">Amount</label>
            <input
              id="refund-amount"
              inputMode="decimal"
              required
              value={refundForm.amount}
              onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="refund-reason">Reason (optional)</label>
            <input
              id="refund-reason"
              value={refundForm.reason}
              onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={refundPayment.isPending}>
            {refundPayment.isPending ? 'Processing…' : 'Refund'}
          </button>
        </form>
      </Drawer>
    </>
  );
}
