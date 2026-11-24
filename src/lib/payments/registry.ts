import "server-only";
import type { PaymentProvider } from "@/lib/payments/types";
import type { PaymentMethodValue } from "@/lib/order-status";
import { stripeProvider } from "@/lib/payments/stripe";

const codProvider: PaymentProvider = {
  method: "COD",
  label: "Cash on Delivery",
  description: "Pay in cash when your order arrives.",
  isOnline: false,
  isConfigured: () => true,
  async initiate() {
    return {};
  },
};

/**
 * Bangladesh gateways (bKash Tokenized Checkout, Nagad, SSLCommerz) plug into the same interface.
 * They report `isConfigured() === false` until an adapter with verified IPN/webhook handling is
 * implemented and credentials are supplied, so they are never offered at checkout prematurely and
 * no payment is ever simulated.
 */
function pendingGateway(method: PaymentMethodValue, label: string): PaymentProvider {
  return {
    method,
    label,
    description: `${label} — integration not enabled on this store yet.`,
    isOnline: true,
    isConfigured: () => false,
    async initiate() {
      throw new Error(`${label} is not enabled. Implement and configure its adapter in src/lib/payments.`);
    },
  };
}

const providers: Record<PaymentMethodValue, PaymentProvider> = {
  COD: codProvider,
  STRIPE: stripeProvider,
  BKASH: pendingGateway("BKASH", "bKash"),
  NAGAD: pendingGateway("NAGAD", "Nagad"),
  SSLCOMMERZ: pendingGateway("SSLCOMMERZ", "SSLCommerz"),
};

export function getProvider(method: PaymentMethodValue): PaymentProvider {
  return providers[method];
}

export interface PaymentOption {
  method: PaymentMethodValue;
  label: string;
  description: string;
  available: boolean;
  isOnline: boolean;
}

export function listPaymentOptions(opts: { codEnabled: boolean }): PaymentOption[] {
  return Object.values(providers).map((p) => ({
    method: p.method,
    label: p.label,
    description: p.description,
    isOnline: p.isOnline,
    available: p.method === "COD" ? opts.codEnabled : p.isConfigured(),
  }));
}
