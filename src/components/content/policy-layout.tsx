import Link from "next/link";
import { format } from "date-fns";
import { Mail } from "lucide-react";
import { PageIntro } from "@/components/content/page-intro";

export interface PolicySection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** Two-column policy page: sticky table of contents + readable long-form sections. */
export function PolicyLayout({
  title,
  description,
  updated,
  sections,
  contactEmail,
}: {
  title: string;
  description?: string;
  updated: Date;
  sections: PolicySection[];
  contactEmail?: string;
}) {
  return (
    <div>
      <PageIntro eyebrow="Customer care" title={title} description={description} crumbs={[{ label: title }]} />
      <div className="container-page grid gap-12 pb-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-36">
            <p className="eyebrow mb-3">On this page</p>
            <ol className="space-y-2 border-l text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent pl-4 text-muted-foreground transition hover:border-foreground hover:text-foreground">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <article className="max-w-3xl">
          <p className="mb-8 text-xs text-muted-foreground">Last updated {format(updated, "d MMMM yyyy")}</p>
          <div className="space-y-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-36">
                <h2 className="text-2xl">{s.title}</h2>
                <div className="prose-oak mt-3">{s.body}</div>
              </section>
            ))}
          </div>
          {contactEmail && (
            <div className="mt-14 flex flex-col gap-3 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-heading text-lg">Still have a question?</p>
                <p className="text-sm text-muted-foreground">Our team replies within one business day.</p>
              </div>
              <div className="flex gap-4 text-sm">
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-1.5 underline-offset-4 hover:underline">
                  <Mail className="size-4" /> {contactEmail}
                </a>
                <Link href="/contact" className="underline underline-offset-4">
                  Contact us
                </Link>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
