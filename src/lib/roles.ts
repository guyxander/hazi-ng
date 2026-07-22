export const ADMIN_ROLES = new Set(["admin", "superadmin"]);
export const ASSIGNABLE_PROFILE_ROLES = new Set(["buyer", "seller", "agent", "business", "admin", "superadmin"]);
export const SELF_SELECTABLE_PROFILE_ROLES = new Set(["buyer", "seller", "business"]);

export function isAdminRole(role: string | null | undefined) {
  return Boolean(role && ADMIN_ROLES.has(role));
}

export function isSuperAdminRole(role: string | null | undefined) {
  return role === "superadmin";
}

export function isAgentRole(role: string | null | undefined) {
  return role === "agent";
}

export function canUseAgentDashboard(role: string | null | undefined, premiumPlan?: string | null) {
  return isAgentRole(role) || premiumPlan === "premium_agent";
}
