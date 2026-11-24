"use client";

import { Controller, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { BD_DIVISIONS, BD_LOCATIONS } from "@/lib/bd-locations";

type AddressKey = "label" | "fullName" | "phone" | "line1" | "line2" | "area" | "division" | "district" | "postalCode";

/**
 * Address inputs bound to a react-hook-form instance. `prefix` is the path of the address object
 * inside the form values (e.g. "shippingAddress"), or "" when the form *is* the address.
 */
export function AddressFields<T extends FieldValues>({
  form,
  prefix = "",
  idPrefix = "addr",
  showLabel = false,
}: {
  form: UseFormReturn<T>;
  prefix?: string;
  idPrefix?: string;
  showLabel?: boolean;
}) {
  const path = (k: AddressKey) => (prefix ? `${prefix}.${k}` : k) as Path<T>;
  const err = (k: AddressKey): string | undefined => {
    const root = prefix ? (form.formState.errors as Record<string, unknown>)[prefix] : form.formState.errors;
    const e = (root as Record<string, { message?: string }> | undefined)?.[k];
    return e?.message;
  };
  const id = (k: string) => `${idPrefix}-${k}`;
  const division = form.watch(path("division")) as string | undefined;
  const districts = division ? (BD_LOCATIONS[division] ?? []) : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showLabel && (
        <Field label="Label" htmlFor={id("label")} error={err("label")} hint="e.g. Home, Office" className="sm:col-span-2">
          <Input id={id("label")} {...form.register(path("label"))} />
        </Field>
      )}
      <Field label="Full name" htmlFor={id("fullName")} error={err("fullName")} required>
        <Input id={id("fullName")} autoComplete="shipping name" {...form.register(path("fullName"))} />
      </Field>
      <Field label="Phone" htmlFor={id("phone")} error={err("phone")} required>
        <Input id={id("phone")} type="tel" autoComplete="shipping tel" placeholder="01XXXXXXXXX" {...form.register(path("phone"))} />
      </Field>
      <Field label="Street address" htmlFor={id("line1")} error={err("line1")} className="sm:col-span-2" required>
        <Input id={id("line1")} autoComplete="shipping address-line1" placeholder="House, road, block" {...form.register(path("line1"))} />
      </Field>
      <Field label="Apartment, floor (optional)" htmlFor={id("line2")} error={err("line2")} className="sm:col-span-2">
        <Input id={id("line2")} autoComplete="shipping address-line2" {...form.register(path("line2"))} />
      </Field>
      <Field label="Division" htmlFor={id("division")} error={err("division")} required>
        <Controller
          control={form.control}
          name={path("division")}
          render={({ field }) => (
            <Select
              value={(field.value as string) || undefined}
              onValueChange={(v) => {
                field.onChange(v);
                form.setValue(path("district"), "" as never, { shouldValidate: false });
              }}
            >
              <SelectTrigger id={id("division")} className="w-full" aria-invalid={err("division") ? true : undefined}>
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {BD_DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="District" htmlFor={id("district")} error={err("district")} required>
        <Controller
          control={form.control}
          name={path("district")}
          render={({ field }) => (
            <Select value={(field.value as string) || undefined} onValueChange={field.onChange} disabled={!districts.length}>
              <SelectTrigger id={id("district")} className="w-full" aria-invalid={err("district") ? true : undefined}>
                <SelectValue placeholder={division ? "Select district" : "Select a division first"} />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Area / Thana" htmlFor={id("area")} error={err("area")}>
        <Input id={id("area")} placeholder="e.g. Dhanmondi" {...form.register(path("area"))} />
      </Field>
      <Field label="Postal code" htmlFor={id("postalCode")} error={err("postalCode")}>
        <Input id={id("postalCode")} autoComplete="shipping postal-code" inputMode="numeric" {...form.register(path("postalCode"))} />
      </Field>
    </div>
  );
}

export interface SavedAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  area: string | null;
  district: string;
  division: string;
  postalCode: string | null;
  isDefault: boolean;
}

export function formatAddressLines(a: Pick<SavedAddress, "line1" | "line2" | "area" | "district" | "division" | "postalCode">) {
  return [a.line1, a.line2, [a.area, a.district].filter(Boolean).join(", "), [a.division, a.postalCode].filter(Boolean).join(" ")].filter(
    (l): l is string => Boolean(l),
  );
}
