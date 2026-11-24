import { format } from "date-fns";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/account/profile-forms";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireUser("/account/profile");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, marketingOptIn: true, emailVerifiedAt: true, createdAt: true },
  });
  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl">Profile</h2>
      <ProfileForm
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          marketingOptIn: user.marketingOptIn,
          emailVerified: Boolean(user.emailVerifiedAt),
          memberSince: format(user.createdAt, "MMMM yyyy"),
        }}
      />
    </div>
  );
}
