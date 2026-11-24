import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { customerUpdateSchema } from "@/lib/validations/admin/sales";
import { getCustomer, updateCustomer } from "@/services/admin/customers";

export const GET = route<{ id: string }>({ auth: "staff", permission: "customers.view" }, async ({ params }) => {
  const customer = await getCustomer(params.id);
  if (!customer) throw notFound("Customer not found.");
  return customer;
});

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "customers.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(customerUpdateSchema);
  return updateCustomer(params.id, input, user!, ip);
});
