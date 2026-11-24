"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { AlertTriangle, Banknote, CreditCard, Loader2, Lock, MapPin, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/shared/form-field";
import { Money } from "@/components/shared/price";
import { SmartImage } from "@/components/shared/smart-image";
import { EmptyState } from "@/components/shared/empty-state";
import { CouponForm } from "@/components/cart/coupon-form";
import { AddressFields, formatAddressLines, type SavedAddress } from "@/components/account/address-fields";
import { CART_COUNT_KEY, CART_KEY, useApplyCoupon, useCart, useRemoveCoupon } from "@/hooks/use-cart";
import { api, ApiClientError, applyFieldErrors, errorMessage } from "@/lib/api-client";
import { checkoutSchema } from "@/lib/validations/checkout";
import type { PaymentMethodValue } from "@/lib/order-status";
import { cn } from "@/lib/utils";

type FormIn = z.input<typeof checkoutSchema>;
type FormOut = z.output<typeof checkoutSchema>;

interface PaymentOption {
  method: PaymentMethodValue;
  label: string;
  description: string;
  available: boolean;
  isOnline: boolean;
}

interface QuoteOption {
  id: string;
  name: string;
  description: string | null;
  fee: string;
  isFree: boolean;
  estimate: string;
  codAvailable: boolean;
  zoneName: string;
  total: string;
  tax: string;
}

interface Quote {
  options: QuoteOption[];
  subtotal: string;
  discount: string;
  couponError: string | null;
  freeShippingCoupon: boolean;
  taxInclusive: boolean;
  taxRate: number;
}

function Step({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7" aria-labelledby={`step-${n}`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id={`step-${n}`} className="flex items-center gap-3 font-sans text-lg font-medium tracking-normal">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const PAYMENT_ICONS: Partial<Record<PaymentMethodValue, typeof Banknote>> = { COD: Banknote, STRIPE: CreditCard };

export function CheckoutForm({
  user,
  paymentOptions,
}: {
  user: { name: string; email: string; phone: string } | null;
  paymentOptions: PaymentOption[];
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: cart, isLoading: cartLoading } = useCart();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [issues, setIssues] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new" | null>(null);
  const redirecting = useRef(false);

  const firstAvailablePayment = paymentOptions.find((p) => p.available)?.method ?? "COD";
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      idempotencyKey,
      customer: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" },
      shippingAddress: {
        label: "",
        fullName: user?.name ?? "",
        phone: user?.phone ?? "",
        line1: "",
        line2: "",
        area: "",
        division: "",
        district: "",
        postalCode: "",
      },
      saveAddress: Boolean(user),
      shippingMethodId: "",
      paymentMethod: firstAvailablePayment,
      couponCode: "",
      note: "",
      acceptTerms: false as unknown as true,
    },
  });
  const { errors, isSubmitting } = form.formState;

  // Saved addresses for signed-in customers.
  const { data: addresses } = useQuery({
    queryKey: ["account-addresses"],
    queryFn: () => api<SavedAddress[]>("/api/account/addresses"),
    enabled: Boolean(user),
  });

  const applyAddress = (a: SavedAddress) => {
    setSelectedAddressId(a.id);
    form.setValue("shippingAddress", {
      label: a.label ?? "",
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? "",
      area: a.area ?? "",
      division: a.division,
      district: a.district,
      postalCode: a.postalCode ?? "",
    });
    form.setValue("saveAddress", false);
    void form.trigger("shippingAddress");
  };

  useEffect(() => {
    if (!addresses || selectedAddressId !== null) return;
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (def) applyAddress(def);
    else setSelectedAddressId("new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  // Coupon: the cart holds the applied coupon; only send it when it is currently valid.
  const couponCode = cart?.couponCode && !cart.couponMessage ? cart.couponCode : "";
  useEffect(() => {
    form.setValue("couponCode", couponCode);
  }, [couponCode, form]);

  // Shipping quote follows destination + coupon + cart contents.
  const division = form.watch("shippingAddress.division");
  const district = form.watch("shippingAddress.district");
  const area = useDebounced(form.watch("shippingAddress.area") ?? "", 500);
  const quoteEnabled = Boolean(division && district && cart && cart.items.length);
  const { data: quote, isFetching: quoting, isError: quoteError } = useQuery({
    queryKey: ["shipping-quote", division, district, area, couponCode, cart?.subtotal, cart?.itemCount],
    queryFn: () =>
      api<Quote>("/api/shipping/quote", {
        method: "POST",
        body: { division, district, area: area || undefined, couponCode: couponCode || undefined },
      }),
    enabled: quoteEnabled,
    placeholderData: (prev) => prev,
  });

  const methodId = form.watch("shippingMethodId");
  const paymentMethod = form.watch("paymentMethod");
  const options = useMemo(() => (quoteEnabled ? (quote?.options ?? []) : []), [quote, quoteEnabled]);
  const selectedMethod = options.find((o) => o.id === methodId) ?? null;

  useEffect(() => {
    if (!options.length) {
      if (methodId) form.setValue("shippingMethodId", "");
      return;
    }
    if (!options.some((o) => o.id === methodId)) form.setValue("shippingMethodId", options[0].id, { shouldValidate: true });
  }, [options, methodId, form]);

  const codBlocked = Boolean(selectedMethod && !selectedMethod.codAvailable);
  useEffect(() => {
    if (codBlocked && paymentMethod === "COD") {
      const alt = paymentOptions.find((p) => p.available && p.method !== "COD");
      if (alt) form.setValue("paymentMethod", alt.method);
    }
  }, [codBlocked, paymentMethod, paymentOptions, form]);

  useEffect(() => {
    if (!cartLoading && cart && cart.items.length === 0 && !redirecting.current) router.replace("/cart");
  }, [cart, cartLoading, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setIssues([]);
    if (values.paymentMethod === "COD" && codBlocked) {
      setFormError("Cash on Delivery isn't available for the selected delivery method. Choose another delivery or payment method.");
      return;
    }
    try {
      const res = await api<{ orderNumber: string; redirectUrl: string }>("/api/orders", { body: values });
      redirecting.current = true;
      qc.setQueryData(CART_COUNT_KEY, 0);
      void qc.invalidateQueries({ queryKey: CART_KEY });
      if (/^https?:\/\//.test(res.redirectUrl)) window.location.assign(res.redirectUrl);
      else router.push(res.redirectUrl);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409 && e.details && Array.isArray((e.details as { items?: string[] }).items)) {
        setIssues((e.details as { items: string[] }).items);
        void qc.invalidateQueries({ queryKey: CART_KEY });
      }
      const applied = applyFieldErrors(e, form.setError);
      setFormError(errorMessage(e));
      if (!applied) toast.error(errorMessage(e));
    }
  });

  if (cartLoading || !cart) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (cart.items.length === 0) {
    return <EmptyState title="Your bag is empty" action={<Button asChild><Link href="/products">Continue shopping</Link></Button>} />;
  }

  const purchasable = cart.items.filter((i) => i.purchasable);
  const subtotal = quote?.subtotal ?? cart.subtotal;
  const discount = quote?.discount ?? cart.discount;
  const total = selectedMethod?.total ?? cart.estimatedTotal;
  const tax = selectedMethod?.tax ?? "0.00";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-12">
      <div className="space-y-6">
        <Step
          n={1}
          title="Contact information"
          aside={
            !user && (
              <Link href="/login?next=/checkout" className="text-sm underline underline-offset-4">
                Have an account? Sign in
              </Link>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="customer-name" error={errors.customer?.name?.message} required>
              <Input id="customer-name" autoComplete="name" {...form.register("customer.name")} />
            </Field>
            <Field label="Phone" htmlFor="customer-phone" error={errors.customer?.phone?.message} required>
              <Input id="customer-phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...form.register("customer.phone")} />
            </Field>
            <Field
              label="Email"
              htmlFor="customer-email"
              error={errors.customer?.email?.message}
              hint="Your order confirmation will be sent here."
              className="sm:col-span-2"
              required
            >
              <Input id="customer-email" type="email" autoComplete="email" readOnly={Boolean(user)} {...form.register("customer.email")} />
            </Field>
          </div>
        </Step>

        <Step n={2} title="Shipping address">
          {user && addresses && addresses.length > 0 && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedAddressId === a.id}
                  onClick={() => applyAddress(a)}
                  className={cn(
                    "rounded-lg border p-4 text-left text-sm transition",
                    selectedAddressId === a.id ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40",
                  )}
                >
                  <p className="flex items-center gap-2 font-medium">
                    <MapPin className="size-3.5" /> {a.label || a.fullName}
                    {a.isDefault && <span className="rounded bg-secondary px-1.5 text-[0.65rem] uppercase">Default</span>}
                  </p>
                  <p className="mt-1 text-muted-foreground">{formatAddressLines(a).join(", ")}</p>
                  <p className="text-muted-foreground">{a.phone}</p>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={selectedAddressId === "new"}
                onClick={() => {
                  setSelectedAddressId("new");
                  form.setValue("shippingAddress", {
                    label: "",
                    fullName: form.getValues("customer.name"),
                    phone: form.getValues("customer.phone"),
                    line1: "",
                    line2: "",
                    area: "",
                    division: "",
                    district: "",
                    postalCode: "",
                  });
                  form.setValue("saveAddress", true);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm transition",
                  selectedAddressId === "new" ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40",
                )}
              >
                <Plus className="size-4" /> Use a new address
              </button>
            </div>
          )}
          {(!user || !addresses?.length || selectedAddressId === "new") && <AddressFields form={form} prefix="shippingAddress" idPrefix="ship" />}
          {user && selectedAddressId === "new" && (
            <label className="mt-4 flex items-center gap-3 text-sm">
              <Checkbox checked={Boolean(form.watch("saveAddress"))} onCheckedChange={(v) => form.setValue("saveAddress", v === true)} />
              Save this address to my account
            </label>
          )}
          {user && selectedAddressId && selectedAddressId !== "new" && errors.shippingAddress && (
            <p className="mt-3 text-sm text-destructive">This saved address is incomplete — choose “Use a new address” to correct it.</p>
          )}
        </Step>

        <Step n={3} title="Delivery method">
          {!quoteEnabled ? (
            <p className="text-sm text-muted-foreground">Choose your division and district to see delivery options.</p>
          ) : quoting && !quote ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : quoteError ? (
            <p className="text-sm text-destructive">We couldn&apos;t load delivery options. Please try again.</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-destructive">Sorry, we don&apos;t deliver to this location yet.</p>
          ) : (
            <div className="space-y-3" role="radiogroup" aria-label="Delivery method">
              {options.map((o) => (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition",
                    methodId === o.id ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40",
                  )}
                >
                  <input type="radio" value={o.id} className="size-4 accent-[var(--primary)]" {...form.register("shippingMethodId")} />
                  <Truck className="size-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.estimate}
                      {o.description ? ` · ${o.description}` : ""}
                      {!o.codAvailable && " · Prepaid only"}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{o.isFree ? "Free" : <Money value={o.fee} />}</span>
                </label>
              ))}
              {quoting && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Updating…</p>}
            </div>
          )}
          {errors.shippingMethodId?.message && <p className="mt-2 text-sm text-destructive">{errors.shippingMethodId.message}</p>}
        </Step>

        <Step n={4} title="Payment">
          <div className="space-y-3" role="radiogroup" aria-label="Payment method">
            {paymentOptions.map((p) => {
              const disabled = !p.available || (p.method === "COD" && codBlocked);
              const Icon = PAYMENT_ICONS[p.method] ?? CreditCard;
              return (
                <label
                  key={p.method}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 transition",
                    disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-foreground/40",
                    paymentMethod === p.method && !disabled && "border-foreground ring-1 ring-foreground",
                  )}
                >
                  <input
                    type="radio"
                    value={p.method}
                    disabled={disabled}
                    className="size-4 accent-[var(--primary)]"
                    {...form.register("paymentMethod")}
                  />
                  <Icon className="size-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {!p.available
                        ? "Coming soon"
                        : p.method === "COD" && codBlocked
                          ? "Not available for the selected delivery method"
                          : p.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {paymentMethod === "STRIPE" && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> You&apos;ll be redirected to Stripe&apos;s secure page to complete payment. We never see your card details.
            </p>
          )}
          {errors.paymentMethod?.message && <p className="mt-2 text-sm text-destructive">{errors.paymentMethod.message}</p>}
          <Field label="Order note (optional)" htmlFor="note" error={errors.note?.message} className="mt-6">
            <Textarea id="note" rows={3} placeholder="Delivery instructions, gift message…" {...form.register("note")} />
          </Field>
        </Step>
      </div>

      <aside className="h-fit space-y-5 rounded-xl border bg-card p-6 shadow-[var(--shadow-soft)] lg:sticky lg:top-32">
        <h2 className="font-heading text-xl">Order summary</h2>
        <ul className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.image && <SmartImage src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />}
                <span className="absolute -top-0 -right-0 flex size-5 items-center justify-center rounded-bl-md bg-primary text-[0.65rem] text-primary-foreground">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2">{item.name}</p>
                {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                {item.warning && <p className="text-xs text-destructive">{item.warning}</p>}
              </div>
              <Money value={item.lineTotal} className="text-sm" />
            </li>
          ))}
        </ul>
        <CouponForm
          appliedCode={cart.couponCode}
          message={cart.couponMessage ?? quote?.couponError}
          pending={applyCoupon.isPending || removeCoupon.isPending}
          onApply={(code) => applyCoupon.mutateAsync(code)}
          onRemove={() => removeCoupon.mutateAsync()}
        />
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd><Money value={subtotal} /></dd>
          </div>
          {Number(discount) > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount{couponCode && ` (${couponCode})`}</dt>
              <dd>-<Money value={discount} /></dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{selectedMethod ? selectedMethod.isFree ? "Free" : <Money value={selectedMethod.fee} /> : "—"}</dd>
          </div>
          {quote && quote.taxRate > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>{quote.taxInclusive ? `Includes VAT (${quote.taxRate}%)` : `VAT (${quote.taxRate}%)`}</dt>
              <dd><Money value={tax} /></dd>
            </div>
          )}
        </dl>
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Total</span>
          <Money value={total} className="text-2xl font-semibold" />
        </div>

        {issues.length > 0 && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> Please review your bag</p>
            <ul className="mt-1 list-disc pl-5">
              {issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
            <Link href="/cart" className="mt-2 inline-block underline underline-offset-4">Go to bag</Link>
          </div>
        )}
        {formError && issues.length === 0 && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p>
        )}

        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={Boolean(form.watch("acceptTerms"))}
            onCheckedChange={(v) => form.setValue("acceptTerms", (v === true) as true, { shouldValidate: form.formState.isSubmitted })}
            className="mt-0.5"
            aria-invalid={errors.acceptTerms ? true : undefined}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-4">terms &amp; conditions</Link> and{" "}
            <Link href="/returns-policy" target="_blank" className="underline underline-offset-4">return policy</Link>.
          </span>
        </label>
        {errors.acceptTerms?.message && <p className="-mt-3 text-xs text-destructive">{errors.acceptTerms.message}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting || purchasable.length !== cart.items.length || !selectedMethod || quoting}
          data-testid="place-order"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Lock />}
          {paymentMethod === "COD" ? "Place order" : "Continue to payment"}
        </Button>
        {cart.hasIssues && <p className="text-center text-xs text-destructive">Some items in your bag need attention.</p>}
        <p className="text-center text-xs text-muted-foreground">Prices, stock and discounts are confirmed when you place the order.</p>
      </aside>
    </form>
  );
}
