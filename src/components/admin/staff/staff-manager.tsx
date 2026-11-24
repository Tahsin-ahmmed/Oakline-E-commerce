"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, KeyRound, Loader2, MoreHorizontal, Pencil, Plus, ShieldCheck, UserMinus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/shared/form-field";
import { ToneBadge } from "@/components/shared/status-badge";
import { useAdmin } from "@/components/admin/admin-context";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import type { RoleSummary, StaffMember } from "@/services/admin/staff";

type Errors = Record<string, string>;
function fieldErrors(e: unknown): Errors {
  if (!(e instanceof ApiClientError) || !e.details) return {};
  const out: Errors = {};
  for (const [k, v] of Object.entries(e.details)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  return out;
}

function RolePicker({ roles, value, onChange, error }: { roles: RoleSummary[]; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.82rem] font-medium text-foreground/80">Roles</legend>
      <div className="grid gap-2 rounded-md border bg-card p-3">
        {roles.map((r) => (
          <label key={r.id} className="flex items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={value.includes(r.id)} onCheckedChange={(c) => onChange(c ? [...value, r.id] : value.filter((x) => x !== r.id))} />
            <span>
              <span className="font-medium">{r.name}</span>
              {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </fieldset>
  );
}

function StaffDialog({
  roles,
  member,
  onClose,
}: {
  roles: RoleSummary[];
  member?: StaffMember;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>(member?.roles.map((r) => r.id) ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (member) await api(`/api/admin/staff/${member.id}`, { method: "PATCH", body: { name, roleIds } });
      else await api("/api/admin/staff", { body: { name, email, password, roleIds } });
      toast.success(member ? "Staff member updated" : "Staff account created");
      onClose();
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{member ? `Edit ${member.name}` : "Add staff member"}</DialogTitle>
            {!member && (
              <DialogDescription>Share the temporary password securely and ask them to change it after signing in.</DialogDescription>
            )}
          </DialogHeader>
          <Field label="Full name" htmlFor="s-name" error={errors.name} required>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {!member && (
            <>
              <Field label="Email" htmlFor="s-email" error={errors.email} required>
                <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Temporary password" htmlFor="s-pass" error={errors.password} hint="At least 10 characters with a letter and a number." required>
                <Input id="s-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </Field>
            </>
          )}
          <RolePicker roles={roles} value={roleIds} onChange={setRoleIds} error={errors.roleIds} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {member ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              await api(`/api/admin/staff/${member.id}/password`, { body: { password } });
              toast.success(`Password reset for ${member.name}. They've been signed out everywhere.`);
              onClose();
            } catch (err) {
              setError(fieldErrors(err).password);
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new temporary password for {member.email}.</DialogDescription>
          </DialogHeader>
          <Field label="New password" htmlFor="rp" error={error} hint="At least 10 characters with a letter and a number.">
            <Input id="rp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || password.length < 10}>
              {busy && <Loader2 className="animate-spin" />} Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

export function StaffManager({ staff, roles }: { staff: StaffMember[]; roles: RoleSummary[] }) {
  const router = useRouter();
  const { user } = useAdmin();
  const [dialog, setDialog] = useState<{ kind: "create" } | { kind: "edit" | "password"; member: StaffMember } | null>(null);
  const [confirm, setConfirm] = useState<{ member: StaffMember; action: "block" | "unblock" | "remove" } | null>(null);
  const [busy, setBusy] = useState(false);

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === "remove") await api(`/api/admin/staff/${confirm.member.id}`, { method: "DELETE" });
      else await api(`/api/admin/staff/${confirm.member.id}`, { method: "PATCH", body: { status: confirm.action === "block" ? "BLOCKED" : "ACTIVE" } });
      toast.success(confirm.action === "remove" ? "Staff access removed" : confirm.action === "block" ? "Account blocked" : "Account unblocked");
      setConfirm(null);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const active = staff.filter((s) => s.isStaff);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus /> Add staff member
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((m) => {
              const self = m.id === user.id;
              return (
                <TableRow key={m.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">
                      {m.name} {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <ToneBadge key={r.id} tone={r.key === "SUPER_ADMIN" ? "info" : "neutral"}>
                          {r.key === "SUPER_ADMIN" && <ShieldCheck className="size-3" />} {r.name}
                        </ToneBadge>
                      ))}
                      {m.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={m.status === "ACTIVE" ? "success" : "danger"}>{m.status === "ACTIVE" ? "Active" : "Blocked"}</ToneBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.lastLoginAt ? dateFmt.format(new Date(m.lastLoginAt)) : "Never"}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", member: m })}>
                          <Pencil /> Edit name & roles
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "password", member: m })}>
                          <KeyRound /> Reset password
                        </DropdownMenuItem>
                        {!self && (
                          <>
                            <DropdownMenuSeparator />
                            {m.status === "ACTIVE" ? (
                              <DropdownMenuItem onSelect={() => setConfirm({ member: m, action: "block" })}>
                                <Ban /> Block account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => setConfirm({ member: m, action: "unblock" })}>
                                <UserCheck /> Unblock account
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ member: m, action: "remove" })}>
                              <UserMinus /> Remove staff access
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {dialog?.kind === "create" && <StaffDialog roles={roles} onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <StaffDialog roles={roles} member={dialog.member} onClose={() => setDialog(null)} />}
      {dialog?.kind === "password" && <PasswordDialog member={dialog.member} onClose={() => setDialog(null)} />}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "remove" ? "Remove staff access?" : confirm?.action === "block" ? "Block this account?" : "Unblock this account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "remove"
                ? `${confirm.member.name} loses all admin roles and is signed out. Their login remains as a regular customer account.`
                : confirm?.action === "block"
                  ? `${confirm?.member.name} is signed out everywhere and can't sign in until unblocked.`
                  : `${confirm?.member.name} will be able to sign in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant={confirm?.action === "unblock" ? "default" : "destructive"} onClick={runConfirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
