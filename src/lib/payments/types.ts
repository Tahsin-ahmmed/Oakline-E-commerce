import type { PaymentMethodValue } from "@/lib/order-status";

export interface PaymentOrder {
  id: string;
  orderNumber: string;
  grandTotal: string;
  currency: string;
  customerEmail: string;
  items: { productName: string; variantName: string | null; quantity: number; unitPrice: string; imageUrl: string | null }[];
  shippingTotal: string;
  discountTotal: string;
}

export interface InitiateResult {
  /** Where to send the customer to complete payment, if the provider uses a hosted page. */
  redirectUrl?: string;
  /** Provider reference stored on the Payment (e.g. Stripe Checkout Session id). */
  providerReference?: string;
}

/**
 * A payment provider adapter. Adding bKash / Nagad / SSLCommerz means implementing this interface,
 * adding a webhook/IPN route that verifies the provider's signature, and registering it in registry.ts.
 */
export interface PaymentProvider {
  method: PaymentMethodValue;
  label: string;
  description: string;
  /** True when credentials are configured and the provider can take payments. */
  isConfigured(): boolean;
  /** True when payment happens online before fulfilment (vs. collected on delivery). */
  isOnline: boolean;
  initiate(order: PaymentOrder, paymentId: string): Promise<InitiateResult>;
  refund?(args: { providerPaymentId: string; amount: string; currency: string }): Promise<{ refundId: string }>;
}
