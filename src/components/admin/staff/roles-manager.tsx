"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ToneBadge } from "@/components/shared/status-badge";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { ALL_PERMISSIONS, PERMISSIONS, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import type { RoleSummary } from "@/services/admin/staff";

const GROUPED = ALL_PERMISSIONS.reduce<Record<string, typeof ALL_PERMISSIONS>>((acc, key) => {
  (acc[PERMISSIONS[key].group] ??= []).push(key);
  return acc;
}, {});

function RoleDialog({ role, onClose }: { role?: RoleSummary; onClose: () => void }) {
  const router = useRouter();
  const locked = role?.key === SUPER_ADMIN_ROLE;
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? ["dashboard.view"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toggle = (k: string, on: boolean) => setPerms((p) => (on ? [...new Set([...p, k])] : p.filter((x) => x !== k)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = locked ? { name, description } : { name, description, permissions: perms };
      await api(role ? `/api/admin/roles/${role.id}` : "/api/admin/roles", { method: role ? "PATCH" : "POST", body });
      toast.success(role ? "Role updated" : "Role created");
      onClose();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)])));
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{role ? `Edit ${role.name}` : "New role"}</DialogTitle>
            <DialogDescription>Permissions are enforced on the server. Changes apply on the staff member&apos;s next request.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" htmlFor="r-name" error={errors.name} required>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="r-desc" error={errors.description}>
              <Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          {locked && (
            <p className="flex items-center gap-2 rounded-md bg-secondary/70 px-3 py-2 text-sm">
              <Lock className="size-4" /> Super Admin always has every permission. Its permissions can&apos;t be changed.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(GROUPED).map(([group, keys]) => (
              <fieldset key={group} className="rounded-lg border p-3">
                <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</legend>
                <div className="grid gap-2">
                  {keys.map((k) => (
                    <label key={k} className="flex items-start gap-2.5 text-sm">
                      <Checkbox className="mt-0.5" disabled={locked} checked={locked || perms.includes(k)} onCheckedChange={(c) => toggle(k, Boolean(c))} />
                      <span>
                        {PERMISSIONS[k].name}
                        <span className="block font-mono text-[0.65rem] text-muted-foreground">{k}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {errors.permissions && <p className="text-xs font-medium text-destructive">{errors.permissions}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {role ? "Save role" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesManager({ roles }: { roles: RoleSummary[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ role?: RoleSummary } | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({})}>
          <Plus /> New role
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <div key={r.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="font-mono text-[0.65rem] text-muted-foreground">{r.key}</p>
              </div>
              <ToneBadge tone={r.isSystem ? "info" : "neutral"}>{r.isSystem ? "System" : "Custom"}</ToneBadge>
            </div>
            {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              {r.key === SUPER_ADMIN_ROLE ? "All permissions" : `${r.permissions.length} of ${ALL_PERMISSIONS.length} permissions`} · {r.userCount} member
              {r.userCount === 1 ? "" : "s"}
            </p>
            <div className="mt-4 flex gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => setDialog({ role: r })}>
                <Pencil /> Edit
              </Button>
              {!r.isSystem && (
                <ConfirmDialog
                  title={`Delete “${r.name}”?`}
                  description={r.userCount ? "Unassign this role from all staff first." : "This can't be undone."}
                  destructive
                  confirmLabel="Delete role"
                  onConfirm={async () => {
                    try {
                      await api(`/api/admin/roles/${r.id}`, { method: "DELETE" });
                      toast.success("Role deleted");
                      router.refresh();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                  trigger={
                    <Button variant="ghost" size="sm" disabled={r.userCount > 0}>
                      <Trash2 /> Delete
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {dialog && <RoleDialog role={dialog.role} onClose={() => setDialog(null)} />}
    </>
  );
}
