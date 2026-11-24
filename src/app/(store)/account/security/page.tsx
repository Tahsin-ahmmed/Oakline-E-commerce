import { requireUser } from "@/lib/auth/guards";
import { ChangePasswordForm } from "@/components/account/profile-forms";
import { VerificationBanner } from "@/components/account/verification-banner";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser("/account/security");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl">Password &amp; security</h2>
        <p className="mt-1 text-sm text-muted-foreground">Changing your password signs you out on all other devices.</p>
      </div>
      {!user.emailVerified && <VerificationBanner email={user.email} />}
      <ChangePasswordForm />
    </div>
  );
}
