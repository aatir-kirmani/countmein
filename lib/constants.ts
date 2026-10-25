export const SKILLS = [
  "Frontend", "Backend", "Mobile", "Design/UI/UX", "Product", "Marketing", "Growth", "SEO",
  "Content", "Sales", "Data/AI", "DevOps", "No-code", "Finance", "Legal", "Other",
] as const;

export const LOOKING_FOR = [
  { value: "cofounder", label: "Co-founder" },
  { value: "paid_gig", label: "Paid gig" },
  { value: "side_project", label: "Side project" },
  { value: "helping", label: "Just helping" },
] as const;

export const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "building", label: "Building" },
  { value: "launched", label: "Launched" },
  { value: "revenue", label: "Revenue" },
] as const;

export const COMPENSATION = [
  { value: "equity", label: "Equity" },
  { value: "paid", label: "Paid" },
  { value: "rev_share", label: "Rev share" },
  { value: "unpaid", label: "Unpaid" },
  { value: "tbd", label: "TBD" },
] as const;

export const DECLINE_REASONS = [
  "Slot already filled",
  "Looking for a different skill set",
  "Not the right time",
  "Other",
];

export const LINK_FIELDS = [
  { key: "x", label: "X / Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "github", label: "GitHub" },
  { key: "website", label: "Website" },
  { key: "portfolio", label: "Portfolio" },
] as const;

export const PROJECT_SELECT =
  "*, owner:profiles!projects_owner_id_fkey(id,name,username,avatar_url,skills), project_slots(*)";
