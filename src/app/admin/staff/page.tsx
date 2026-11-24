import { requireStaff } from "@/lib/auth/guards";
import { listRoles, listStaff } from "@/services/admin/staff";
import { PageHeader } from "@/components/admin/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffManager } from "@/components/admin/staff/staff-manager";
import { RolesManager } from "@/components/admin/staff/roles-manager";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  await requireStaff("staff.manage", "/admin/staff");
  const [staff, roles] = await Promise.all([listStaff(), listRoles()]);
  return (
    <>
      <PageHeader title="Staff & roles" description="Admin accounts and what each role is allowed to do." />
      <Tabs defaultValue="staff" className="gap-5">
        <TabsList>
          <TabsTrigger value="staff">Staff accounts ({staff.filter((s) => s.isStaff).length})</TabsTrigger>
          <TabsTrigger value="roles">Roles & permissions ({roles.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <StaffManager staff={staff} roles={roles} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesManager roles={roles} />
        </TabsContent>
      </Tabs>
    </>
  );
}
