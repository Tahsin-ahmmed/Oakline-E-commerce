import Link from "next/link";
import type { ContactStatus, SubscriberStatus } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { cn } from "@/lib/utils";
import { listContactMessages, listSubscribers } from "@/services/admin/messages";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { ContactMessages, Subscribers } from "@/components/admin/messages/messages-view";
import { ExportButton } from "@/components/admin/orders/export-button";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("messages.manage", "/admin/messages");
  const sp = await searchParams;
  const tab = oneOf(sp, "tab", ["contact", "newsletter"] as const) ?? "contact";
  const { page, pageSize } = pageParams(sp);
  const q = str(sp, "q");

  const tabs = (
    <div className="mb-5 inline-flex rounded-lg border bg-card p-1 text-sm">
      {[
        ["contact", "Contact messages"],
        ["newsletter", "Newsletter subscribers"],
      ].map(([key, label]) => (
        <Link
          key={key}
          href={`/admin/messages?tab=${key}`}
          className={cn("rounded-md px-3 py-1.5 transition", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          aria-current={tab === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  if (tab === "newsletter") {
    const status = oneOf(sp, "status", ["SUBSCRIBED", "UNSUBSCRIBED"] as const) as SubscriberStatus | undefined;
    const data = await listSubscribers({ q, status, page, pageSize });
    return (
      <>
        <PageHeader title="Messages" description={`${data.active} active newsletter subscriber(s)`} actions={<ExportButton endpoint="/api/admin/newsletter/export" />} />
        {tabs}
        <Toolbar>
          <SearchInput placeholder="Search email" />
          <FilterSelect param="status" placeholder="All subscribers" options={[{ value: "SUBSCRIBED", label: "Subscribed" }, { value: "UNSUBSCRIBED", label: "Unsubscribed" }]} />
          <ClearFilters keys={["q", "status"]} />
        </Toolbar>
        <Subscribers subscribers={data.items} />
        <PaginationLinks page={page} totalPages={Math.max(1, Math.ceil(data.total / pageSize))} basePath="/admin/messages" searchParams={sp} className="mt-6" />
      </>
    );
  }

  const status = oneOf(sp, "status", ["NEW", "READ", "REPLIED", "ARCHIVED"] as const) as ContactStatus | undefined;
  const data = await listContactMessages({ q, status, page, pageSize });
  return (
    <>
      <PageHeader title="Messages" description={`${data.unread} unread contact message(s)`} />
      {tabs}
      <Toolbar>
        <SearchInput placeholder="Search name, email or text" />
        <FilterSelect
          param="status"
          placeholder="Inbox (not archived)"
          options={[
            { value: "NEW", label: "New" },
            { value: "READ", label: "Read" },
            { value: "REPLIED", label: "Replied" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
        <ClearFilters keys={["q", "status"]} />
      </Toolbar>
      <ContactMessages messages={data.items} />
      <PaginationLinks page={page} totalPages={Math.max(1, Math.ceil(data.total / pageSize))} basePath="/admin/messages" searchParams={sp} className="mt-6" />
    </>
  );
}
