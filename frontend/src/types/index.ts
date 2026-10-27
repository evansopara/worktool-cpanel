export type UserRole =
  | 'operations_manager'
  | 'team_lead'
  | 'project_manager'
  | 'staff'
  | 'intern'
  | 'customer_support_officer'
  | 'client';

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: UserRole;
  specialization?: string;
  department?: string;
  phone?: string;
  profile_picture?: string;
  status: 'active' | 'inactive' | 'pending';
  work_status?: 'available' | 'busy' | 'on_leave' | 'offline';
  must_set_password: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectCategory =
  | 'website_development'
  | 'dpl_outright'
  | 'dpl_partnership'
  | 'direct_marketing'
  | 'support_maintenance';

export type ProjectMemberRole = 'viewer' | 'member' | 'admin' | 'technical_support';

export interface Project {
  id: number;
  name: string;
  description?: string;
  category?: ProjectCategory;
  client_id?: number;
  manager_id?: number;
  created_by?: number;
  status: 'active' | 'inactive' | 'pending' | 'completed';
  progress?: number;
  start_date?: string;
  end_date?: string;
  domain_registered_at?: string;
  domain_expires_at?: string;
  budget?: number;
  client?: User;
  manager?: User;
  creator?: User;
  members?: ProjectMember[];
  tasks?: Task[];
  resources?: Resource[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role?: ProjectMemberRole;
  invitation_status: 'pending' | 'accepted' | 'declined';
  user?: User;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  project_id: number;
  assignee_id?: number;
  assigned_by?: number;
  status: 'todo' | 'pending' | 'in_progress' | 'completed' | 'review' | 'technical_support' | 'not_approved';
  priority: 'low' | 'medium' | 'high';
  progress?: number;
  iteration_number?: number;
  start_date?: string;
  deadline?: string;
  working_hours?: number;
  working_minutes?: number;
  estimated_hours?: number;
  time_spent?: number;
  is_timer_running: boolean;
  timer_start_time?: string;
  timer_stopped_at?: string;
  has_been_started: boolean;
  actual_start_time?: string;
  completed_at?: string;
  project?: Project;
  assignee?: User;
  assigner?: User;
  sessions?: TaskSession[];
  iterations?: TaskIteration[];
  created_at: string;
  updated_at: string;
}

export interface TaskSession {
  id: number;
  task_id: number;
  user_id: number;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface TaskIteration {
  id: number;
  task_id: number;
  title: string;
  description?: string;
  assigned_to?: number;
  due_date?: string;
  status: string;
  assignee?: User;
}

export interface ProjectPlan {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  created_by?: number;
  deliverables?: Deliverable[];
}

export interface Deliverable {
  id: number;
  plan_id: number;
  title: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  status: string;
  dependencies?: number[];
  assignee?: User;
}

export interface ProjectMessage {
  id: number;
  project_id: number;
  sender_id: number;
  content: string;
  parent_id?: number;
  is_edited: boolean;
  sender?: User;
  created_at: string;
  updated_at: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  read: boolean;
  sender?: User;
  receiver?: User;
  created_at: string;
}

export interface GeneralChannelMessage {
  id: number;
  sender_id: number;
  content: string;
  reactions?: Record<string, string[]>;
  sender?: User;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface Memo {
  id: number;
  sender_id: number;
  subject: string;
  content: string;
  type: 'individual' | 'general' | 'department';
  department?: string;
  recipients: number[];
  sender?: User;
  reads?: MemoRead[];
  responses?: MemoResponse[];
  created_at: string;
}

export interface MemoRead {
  memo_id: number;
  user_id: number;
  read_at: string;
}

export interface MemoResponse {
  id: number;
  memo_id: number;
  user_id: number;
  content: string;
  user?: User;
  created_at: string;
}

export interface Note {
  id: number;
  user_id: number;
  title: string;
  content?: string;
  todo_items?: { text: string; done: boolean }[];
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveApplication {
  id: number;
  user_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days?: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: number;
  reviewed_at?: string;
  review_comment?: string;
  user?: User;
  reviewer?: User;
  created_at: string;
}

export type BookingType = 'one_on_one' | 'team' | 'marketing_meeting_call' | 'general';

export interface Booking {
  id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  meeting_link?: string;
  participants?: number[];
  type: BookingType;
  status: 'scheduled' | 'cancelled' | 'completed';
  scheduled_by: number;
  scheduler?: User;
  created_at: string;
}

export interface Resource {
  id: number;
  project_id: number;
  name: string;
  url: string;
  type?: string;
  uploaded_by: number;
  uploader?: User;
  created_at: string;
}

export interface TechnicalSupportRequest {
  id: number;
  title: string;
  description: string;
  task_id?: number;
  requester_id: number;
  assigned_to_id?: number;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: string;
  resolution?: string;
  resolved_at?: string;
  requester?: User;
  assignedTo?: User;
  created_at: string;
}

export interface DeadlineExtensionRequest {
  id: number;
  task_id: number;
  requester_id: number;
  project_manager_id: number;
  reason: string;
  requested_deadline: string;
  status: 'pending' | 'approved' | 'rejected';
  decision_reason?: string;
  decided_by?: number;
  decided_at?: string;
  approved_deadline?: string;
  approved_working_hours?: number;
  approved_working_minutes?: number;
  task?: Task;
  requester?: User;
  projectManager?: User;
  created_at: string;
}

export interface Complaint {
  id: number;
  name: string;
  email: string;
  product_manager_name?: string;
  developer_name?: string;
  technical_manager_name?: string;
  valuable_things?: string[];
  detailed_explanation: string;
  screenshot_url?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  review_comments?: string;
  submitter_id?: number;
  reviewed_by?: number;
  reviewed_at?: string;
  created_at: string;
}

export interface StaffComplaint {
  id: number;
  name: string;
  email: string;
  department?: string;
  detailed_explanation: string;
  screenshot_url?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  review_comments?: string;
  submitter_id?: number;
  reviewed_at?: string;
  submitter?: User;
  created_at: string;
}

export interface StaffQuery {
  id: number;
  subject: string;
  message: string;
  submitted_by: number;
  assigned_to: number;
  status: 'pending' | 'acknowledged' | 'contested';
  response?: string;
  responded_at?: string;
  submitter?: User;
  assignee?: User;
  created_at: string;
}

export interface Sop {
  id: number;
  title: string;
  description?: string;
  category?: string;
  created_by: number;
  status: 'active' | 'archived';
  creator?: User;
  segments?: SopSegment[];
  created_at: string;
}

export interface SopSegment {
  id: number;
  sop_id: number;
  title: string;
  content: string;
  order_index?: number;
}

export type IssueCategory = 'bug' | 'feature_request' | 'improvement' | 'other';

export interface IssueReport {
  id: number;
  title: string;
  description: string;
  category?: IssueCategory;
  suggestions?: string;
  reported_by: number;
  project_id?: number;
  task_id?: number;
  priority?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'closed';
  resolution?: string;
  resolved_at?: string;
  screenshot_url?: string;
  reporter?: User;
  project?: Project;
  task?: Task;
  created_at: string;
}

export interface ReviewLink {
  id: number;
  title: string;
  link_url: string;
  description?: string;
  sent_by: number;
  assigned_to?: number;
  status: 'pending' | 'approved' | 'not_approved';
  review_comment?: string;
  reviewed_at?: string;
  sender?: User;
  assignee?: User;
  created_at: string;
}

export interface ClientSentiment {
  id: number;
  project_id?: number;
  client_id?: number;
  sentiment: 'satisfied' | 'dissatisfied';
  is_flagged: boolean;
  feedback?: string;
  recorded_by?: number;
  recorded_at: string;
  created_at: string;
  project?: Project;
  client?: User;
  recorder?: User;
}

export interface ProjectBriefing {
  id: number;
  project_id: number;
  content: string;
  created_by: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}
