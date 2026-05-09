export type PaymentStatus = "paid" | "overdue" | "pending" | "failed";

export type UserRole = "admin" | "staff";

export interface UserOrgSnippet {
  id: string;
  name: string;
  status: "active" | "paused";
  upi_id: string | null;
  upi_number: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  organisation_id: string;
  organisation: UserOrgSnippet;
}

export interface Plan {
  id: string;
  organisation_id: string;
  name: string;
  amount: number;
  billing_cycle: "monthly" | "quarterly" | "annual";
  description: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  organisation_id: string;
  plan_id: string | null;
  plan_name: string | null;
  plan_amount: number | null;
  full_name: string;
  mobile: string;
  email: string | null;
  join_date: string | null;
  next_due_date: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  member_id: string;
  month: string;
  date: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
}

export interface DashboardStats {
  total_members: number;
  total_plans: number;
  members_by_plan: { plan: string; count: number }[];
  recent_payments: {
    id: string;
    member_name: string;
    month: string;
    date: string;
    amount: number;
    status: string;
  }[];
  upcoming_dues: {
    id: string;
    full_name: string;
    mobile: string | null;
    next_due_date: string;
    plan_name: string | null;
    plan_amount: number | null;
  }[];
}
