"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { Panel } from "@/components/admin/page-header";
import { useAdmin } from "@/components/admin/admin-context";
import { api, errorMessage } from "@/lib/api-client";
import { BD_DIVISIONS, BD_LOCATIONS } from "@/lib/bd-locations";
import { formatMoney } from "@/lib/money";

interface TestResult {
  zone: { id: string; name: string; isDefault: boolean } | null;
  storeFreeThreshold: string;
  options: { id: string; name: string; fee: string; baseFee: string; isFree: boolean; estimate: string; codAvailable: boolean }[];
}

export function ShippingTester() {
  const { currency } = useAdmin();
  const [division, setDivision] = useState("Dhaka");
  const [district, setDistrict] = useState("Dhaka");
  const [area, setArea] = useState("");
  const [subtotal, setSubtotal] = useState("2500");
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const money = (v: string) => formatMoney(v, currency);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(await api<TestResult>("/api/admin/shipping/test", { body: { division, district, area: area || undefined, subtotal: Number(subtotal) || 0 } }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Test a destination" description="See which zone and fees a customer would get." className="xl:sticky xl:top-24">
      <form onSubmit={run} className="grid gap-3">
        <Field label="Division" htmlFor="t-division">
          <Select
            value={division}
            onValueChange={(d) => {
              setDivision(d);
              setDistrict(BD_LOCATIONS[d]?.[0] ?? "");
            }}
          >
            <SelectTrigger id="t-division" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BD_DIVISIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="District" htmlFor="t-district">
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger id="t-district" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(BD_LOCATIONS[division] ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Area (optional)" htmlFor="t-area">
          <Input id="t-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Gulshan" />
        </Field>
        <Field label="Cart subtotal" htmlFor="t-subtotal">
          <Input id="t-subtotal" type="number" min={0} value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />} Check rates
        </Button>
      </form>
      {result && (
        <div className="mt-5 border-t pt-4 text-sm" aria-live="polite">
          {result.zone ? (
            <p>
              Matches <span className="font-medium">{result.zone.name}</span>
              {result.zone.isDefault && <span className="text-muted-foreground"> (default zone)</span>}
            </p>
          ) : (
            <p className="text-destructive">No zone matches — this destination can&apos;t check out.</p>
          )}
          <ul className="mt-3 space-y-2">
            {result.options.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 rounded-md bg-secondary/50 px-3 py-2">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.estimate}
                    {o.codAvailable ? " · COD" : " · Prepaid only"}
                  </p>
                </div>
                <p className="text-right tabular-nums">
                  {o.isFree ? (
                    <>
                      <span className="font-medium text-success">Free</span>
                      <span className="block text-xs text-muted-foreground line-through">{money(o.baseFee)}</span>
                    </>
                  ) : (
                    <span className="font-medium">{money(o.fee)}</span>
                  )}
                </p>
              </li>
            ))}
            {result.zone && result.options.length === 0 && <li className="text-muted-foreground">This zone has no active methods.</li>}
          </ul>
          {Number(result.storeFreeThreshold) > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Store-wide free delivery applies from {money(result.storeFreeThreshold)}.</p>
          )}
        </div>
      )}
    </Panel>
  );
}
