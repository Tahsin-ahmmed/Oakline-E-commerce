"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge, ToneBadge } from "@/components/shared/status-badge";
import { Panel } from "@/components/admin/page-header";
import { useAdmin } from "@/components/admin/admin-context";
import { ShippingTester } from "@/components/admin/shipping/shipping-tester";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { BD_LOCATIONS, BD_DIVISIONS } from "@/lib/bd-locations";
import { formatMoney } from "@/lib/money";
import type { AdminZone } from "@/services/admin/shipping";

type Method = AdminZone["methods"][number];
type Errors = Record<string, string>;

function fieldErrors(e: unknown): Errors {
  if (!(e instanceof ApiClientError) || !e.details) return {};
  const out: Errors = {};
  for (const [k, v] of Object.entries(e.details)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  return out;
}

function CheckGrid({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.82rem] font-medium text-foreground/80">{label}</legend>
      <div className="grid max-h-44 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-md border bg-card p-3 sm:grid-cols-3">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.includes(o)} onCheckedChange={(c) => onChange(c ? [...value, o] : value.filter((x) => x !== o))} />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ZoneDialog({ zone, open, onOpenChange }: { zone?: AdminZone; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState(zone?.name ?? "");
  const [divisions, setDivisions] = useState<string[]>(zone?.divisions ?? []);
  const [districts, setDistricts] = useState<string[]>(zone?.districts ?? []);
  const [areas, setAreas] = useState((zone?.areas ?? []).join(", "));
  const [isDefault, setIsDefault] = useState(zone?.isDefault ?? false);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(zone?.sortOrder ?? 0));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  // Districts are offered from the chosen divisions; when none are chosen, every district is available.
  const districtOptions = (divisions.length ? divisions.flatMap((d) => BD_LOCATIONS[d] ?? []) : Object.values(BD_LOCATIONS).flat()).sort();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = {
        name,
        divisions,
        districts,
        areas: areas.split(",").map((a) => a.trim()).filter(Boolean),
        isDefault,
        isActive,
        sortOrder: Number(sortOrder) || 0,
      };
      await api(zone ? `/api/admin/shipping/zones/${zone.id}` : "/api/admin/shipping/zones", { method: zone ? "PATCH" : "POST", body });
      toast.success(zone ? "Zone updated" : "Zone created");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{zone ? "Edit shipping zone" : "New shipping zone"}</DialogTitle>
            <DialogDescription>
              A destination matches the most specific zone: area, then district, then division, then the default zone.
            </DialogDescription>
          </DialogHeader>
          <Field label="Zone name" htmlFor="zone-name" error={errors.name} required>
            <Input id="zone-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Inside Dhaka City" />
          </Field>
          <CheckGrid
            label="Divisions"
            options={BD_DIVISIONS}
            value={divisions}
            onChange={(v) => {
              setDivisions(v);
              if (v.length) {
                const allowed = new Set(v.flatMap((d) => BD_LOCATIONS[d] ?? []));
                setDistricts((ds) => ds.filter((d) => allowed.has(d)));
              }
            }}
          />
          <CheckGrid label={divisions.length ? "Districts (in selected divisions)" : "Districts"} options={districtOptions} value={districts} onChange={setDistricts} />
          <Field label="Areas" htmlFor="zone-areas" hint="Comma-separated neighbourhoods, e.g. Gulshan, Banani, Dhanmondi" error={errors.areas}>
            <Textarea id="zone-areas" value={areas} onChange={(e) => setAreas(e.target.value)} className="min-h-16" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sort order" htmlFor="zone-sort" error={errors.sortOrder}>
              <Input id="zone-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} /> Active
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} /> Default (fallback) zone
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {zone ? "Save zone" : "Create zone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MethodDialog({
  zoneId,
  method,
  open,
  onOpenChange,
}: {
  zoneId: string;
  method?: Method;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    name: method?.name ?? "",
    description: method?.description ?? "",
    fee: method?.fee ?? "",
    freeShippingThreshold: method?.freeShippingThreshold ?? "",
    minDays: String(method?.minDays ?? 1),
    maxDays: String(method?.maxDays ?? 3),
    codAvailable: method?.codAvailable ?? true,
    isActive: method?.isActive ?? true,
    sortOrder: String(method?.sortOrder ?? 0),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...v, zoneId, freeShippingThreshold: v.freeShippingThreshold === "" ? null : v.freeShippingThreshold };
      await api(method ? `/api/admin/shipping/methods/${method.id}` : "/api/admin/shipping/methods", { method: method ? "PATCH" : "POST", body });
      toast.success(method ? "Delivery method updated" : "Delivery method added");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{method ? "Edit delivery method" : "Add delivery method"}</DialogTitle>
          </DialogHeader>
          <Field label="Name" htmlFor="m-name" error={errors.name} required>
            <Input id="m-name" value={v.name} onChange={set("name")} placeholder="Standard Delivery" />
          </Field>
          <Field label="Description" htmlFor="m-desc" error={errors.description}>
            <Input id="m-desc" value={v.description} onChange={set("description")} placeholder="Shown at checkout" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fee" htmlFor="m-fee" error={errors.fee} required>
              <Input id="m-fee" type="number" min={0} step="0.01" value={v.fee} onChange={set("fee")} />
            </Field>
            <Field label="Free over" htmlFor="m-free" error={errors.freeShippingThreshold} hint="Leave blank for none">
              <Input id="m-free" type="number" min={0} step="0.01" value={v.freeShippingThreshold} onChange={set("freeShippingThreshold")} />
            </Field>
            <Field label="Min days" htmlFor="m-min" error={errors.minDays}>
              <Input id="m-min" type="number" min={0} value={v.minDays} onChange={set("minDays")} />
            </Field>
            <Field label="Max days" htmlFor="m-max" error={errors.maxDays}>
              <Input id="m-max" type="number" min={0} value={v.maxDays} onChange={set("maxDays")} />
            </Field>
            <Field label="Sort order" htmlFor="m-sort" error={errors.sortOrder}>
              <Input id="m-sort" type="number" min={0} value={v.sortOrder} onChange={set("sortOrder")} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={v.codAvailable} onCheckedChange={(c) => setV((s) => ({ ...s, codAvailable: c }))} /> Cash on Delivery available
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={v.isActive} onCheckedChange={(c) => setV((s) => ({ ...s, isActive: c }))} /> Active
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save method
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function coverage(zone: AdminZone) {
  const parts: string[] = [];
  if (zone.areas.length) parts.push(`${zone.areas.length} area${zone.areas.length > 1 ? "s" : ""}`);
  if (zone.districts.length) parts.push(zone.districts.length <= 4 ? zone.districts.join(", ") : `${zone.districts.length} districts`);
  if (zone.divisions.length) parts.push(zone.divisions.length <= 3 ? `${zone.divisions.join(", ")} division` : `${zone.divisions.length} divisions`);
  return parts.length ? parts.join(" · ") : zone.isDefault ? "Everywhere not covered by another zone" : "No locations assigned";
}

export function ShippingManager({ zones }: { zones: AdminZone[] }) {
  const router = useRouter();
  const { currency } = useAdmin();
  const [zoneDialog, setZoneDialog] = useState<{ zone?: AdminZone } | null>(null);
  const [methodDialog, setMethodDialog] = useState<{ zoneId: string; method?: Method } | null>(null);
  const money = (v: string) => formatMoney(v, currency);
  const hasDefault = zones.some((z) => z.isDefault && z.isActive);

  const remove = async (url: string, label: string) => {
    try {
      await api(url, { method: "DELETE" });
      toast.success(`${label} deleted`);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          {!hasDefault ? (
            <p className="text-sm text-warning">No active default zone — destinations outside your zones can&apos;t check out.</p>
          ) : (
            <span />
          )}
          <Button onClick={() => setZoneDialog({})}>
            <Plus /> New zone
          </Button>
        </div>
        {zones.length === 0 && (
          <EmptyState icon={Truck} title="No shipping zones yet" description="Create a default zone so customers anywhere in Bangladesh can check out." />
        )}
        {zones.map((zone) => (
          <Panel
            key={zone.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {zone.name}
                {zone.isDefault && (
                  <ToneBadge tone="info">
                    <Star className="size-3" /> Default
                  </ToneBadge>
                )}
                <ActiveBadge active={zone.isActive} />
              </span>
            }
            description={
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {coverage(zone)}
              </span>
            }
            actions={
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setZoneDialog({ zone })} aria-label={`Edit ${zone.name}`}>
                  <Pencil />
                </Button>
                <ConfirmDialog
                  title={`Delete “${zone.name}”?`}
                  description="Its delivery methods are deleted too. Past orders keep their shipping details."
                  destructive
                  confirmLabel="Delete zone"
                  onConfirm={() => remove(`/api/admin/shipping/zones/${zone.id}`, "Zone")}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${zone.name}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            }
            bodyClassName="p-0"
          >
            {zone.methods.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No delivery methods — customers in this zone can&apos;t check out yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Method</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Free over</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>COD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zone.methods.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-5">
                        <p className="font-medium">{m.name}</p>
                        {m.description && <p className="max-w-xs truncate text-xs text-muted-foreground">{m.description}</p>}
                      </TableCell>
                      <TableCell className="tabular-nums">{money(m.fee)}</TableCell>
                      <TableCell className="tabular-nums">{m.freeShippingThreshold ? money(m.freeShippingThreshold) : "—"}</TableCell>
                      <TableCell>{m.minDays === m.maxDays ? `${m.minDays} days` : `${m.minDays}–${m.maxDays} days`}</TableCell>
                      <TableCell>{m.codAvailable ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <ActiveBadge active={m.isActive} />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => setMethodDialog({ zoneId: zone.id, method: m })} aria-label={`Edit ${m.name}`}>
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          title={`Delete “${m.name}”?`}
                          description={m.orderCount ? `${m.orderCount} past order(s) used this method; they keep their recorded shipping name and fee.` : undefined}
                          destructive
                          confirmLabel="Delete method"
                          onConfirm={() => remove(`/api/admin/shipping/methods/${m.id}`, "Delivery method")}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${m.name}`}>
                              <Trash2 />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="border-t px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setMethodDialog({ zoneId: zone.id })}>
                <Plus /> Add delivery method
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      <div>
        <ShippingTester />
      </div>
      {zoneDialog && <ZoneDialog zone={zoneDialog.zone} open onOpenChange={(o) => !o && setZoneDialog(null)} />}
      {methodDialog && (
        <MethodDialog zoneId={methodDialog.zoneId} method={methodDialog.method} open onOpenChange={(o) => !o && setMethodDialog(null)} />
      )}
    </div>
  );
}
