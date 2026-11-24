import { ScrollText } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import type { SearchParams } from "@/lib/admin-params";
import { activityQuerySchema } from "@/lib/validations/admin/system";
import { activityFilterOptions, listActivity } from "@/services/admin/activity";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { DateRangeInputs } from "@/components/admin/activity/date-range-inputs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { ToneBadge } from "@/components/shared/status-badge";

export const metadata = { title: "Activity log" };

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Dhaka",
});

function actionTone(action: string) {
  if (/delete|deactivate|block|cancel/.test(action)) return "danger" as const;
  if (/create/.test(action)) return "success" as const;
  if (/update|status|adjust|reset/.test(action)) return "info" as const;
  return "neutral" as const;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("logs.view", "/admin/activity");
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) || undefined;
  const query = activityQuerySchema.parse({
    userId: one("userId"),
    entityType: one("entityType"),
    q: one("q"),
    from: one("from"),
    to: one("to"),
    page: one("page"),
  });
  const [data, options] = await Promise.all([listActivity(query), activityFilterOptions()]);

  return (
    <>
      <PageHeader title="Activity log" description="An audit trail of important admin operations." />
      <Toolbar>
        <SearchInput placeholder="Search action, summary or ID…" />
        <FilterSelect param="userId" placeholder="All staff" options={options.users.map((u) => ({ value: u.id, label: u.name }))} />
        <FilterSelect param="entityType" placeholder="All entities" options={options.entityTypes.map((e) => ({ value: e, label: e }))} />
        <DateRangeInputs />
        <ClearFilters keys={["q", "userId", "entityType", "from", "to"]} />
        <span className="ml-auto text-xs text-muted-foreground">{data.total.toLocaleString("en-IN")} entries</span>
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity found" description="Try a different filter or date range." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">When</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="pr-5">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => (
                <TableRow key={e.id} className="align-top">
                  <TableCell className="pl-5 text-xs whitespace-nowrap text-muted-foreground">{dateFmt.format(new Date(e.createdAt))}</TableCell>
                  <TableCell className="text-sm">
                    {e.user ? (
                      <>
                        <p className="font-medium">{e.user.name}</p>
                        <p className="text-xs text-muted-foreground">{e.user.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={actionTone(e.action)}>{e.action}</ToneBadge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.entityType}
                      {e.entityId && <span className="font-mono"> · {e.entityId.slice(0, 14)}</span>}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-md text-sm whitespace-normal">
                    {e.summary ?? "—"}
                    {e.metadata !== null && e.metadata !== undefined && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Metadata</summary>
                        <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-muted p-2 text-[0.7rem] leading-relaxed">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 font-mono text-xs text-muted-foreground">{e.ipAddress ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationLinks page={data.page} totalPages={data.totalPages} basePath="/admin/activity" searchParams={sp} className="mt-6" />
    </>
  );
}
