import Link from "next/link";

export function AnnouncementBar({ text, link }: { text: string; link?: string }) {
  const content = <span className="tracking-wide">{text}</span>;
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container-page flex h-9 items-center justify-center text-center text-[0.75rem]">
        {link ? (
          <Link href={link} className="underline-offset-4 hover:underline">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
