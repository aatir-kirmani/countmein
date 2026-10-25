export type Stage = "idea" | "building" | "launched" | "revenue";
export type Openness = "closed" | "specific" | "anyone";
export type Compensation = "equity" | "paid" | "rev_share" | "unpaid" | "tbd";
export type RequestStatus = "pending" | "interested" | "accepted" | "declined" | "withdrawn" | "expired";

export interface Profile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  skills: string[];
  links: Partial<Record<"x" | "linkedin" | "github" | "website" | "portfolio", string>>;
  hours_per_week: number | null;
  looking_for: string[];
  onboarded: boolean;
  is_admin: boolean;
  is_organizer: boolean;
  banned: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface EventRow {
  id: string;
  organizer_id: string;
  series_id: string | null;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  city: string | null;
  cover_url: string | null;
  gallery_urls: string[];
  video_url: string | null;
  code: string;
  visibility: "public" | "unlisted" | "invite_only";
  capacity: number | null;
  status: "upcoming" | "live" | "ended";
  ticket_price_cents: number;
  creem_product_id?: string | null;
  creem_product_price_cents?: number | null;
  currency: string;
  recap_sent: boolean;
  created_at: string;
}

export interface Slot {
  id: string;
  project_id: string;
  specialty: string;
  description: string | null;
  commitment: string | null;
  compensation: Compensation;
  status: "open" | "filled" | "closed";
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  pitch: string;
  description: string | null;
  stage: Stage;
  link: string | null;
  logo_url: string | null;
  tech_stack: string[];
  openness: Openness;
  general_note: string | null;
  created_at: string;
}

export type ProjectWithRelations = Project & {
  owner: Pick<Profile, "id" | "name" | "username" | "avatar_url" | "skills">;
  project_slots: Slot[];
};

export interface JoinRequest {
  id: string;
  project_id: string;
  slot_id: string | null;
  requester_id: string;
  event_id: string | null;
  message: string | null;
  status: RequestStatus;
  direction: "request" | "invite";
  decline_reason: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  assignee_id: string | null;
  done: boolean;
  created_at: string;
}
