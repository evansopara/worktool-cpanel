import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (username: string, password: string) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: Record<string, unknown>) => api.put('/auth/profile', data),
  changePassword: (data: Record<string, unknown>) => api.post('/auth/change-password', data),
  setupPassword: (token: string, password: string, password_confirmation: string) =>
    api.post('/auth/setup-password', { token, password, password_confirmation }),
  forgotPassword: (username: string) => api.post('/auth/forgot-password', { username }),
};

// Users
export const usersApi = {
  list: () => api.get('/users'),
  listAll: () => api.get('/users', { params: { all: 1 } }),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  remove: (id: number) => api.delete(`/users/${id}`),
  resetPasswordToken: (id: number) => api.post(`/users/${id}/reset-password-token`),
  setBreak: (id: number, breakStart: string | null) => api.put(`/users/${id}/break`, { break_one_time: breakStart }),
  deactivate: (id: number) => api.post(`/users/${id}/deactivate`),
  activate: (id: number) => api.post(`/users/${id}/activate`),
};

// Projects
export const projectsApi = {
  list: () => api.get('/projects'),
  create: (data: Record<string, unknown>) => api.post('/projects', data),
  get: (id: number) => api.get(`/projects/${id}`),
  update: (id: number, data: Record<string, unknown>) => api.put(`/projects/${id}`, data),
  remove: (id: number) => api.delete(`/projects/${id}`),
  members: (id: number) => api.get(`/projects/${id}/members`),
  addMember: (id: number, data: Record<string, unknown>) => api.post(`/projects/${id}/members`, data),
  removeMember: (id: number, userId: number) => api.delete(`/projects/${id}/members/${userId}`),
  plans: (id: number) => api.get(`/projects/${id}/plans`),
  createPlan: (id: number, data: Record<string, unknown>) => api.post(`/projects/${id}/plans`, data),
  createDeliverable: (projectId: number, planId: number, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/plans/${planId}/deliverables`, data),
  resources: (id: number) => api.get(`/projects/${id}/resources`),
  addResource: (id: number, data: Record<string, unknown>) => api.post(`/projects/${id}/resources`, data),
  briefing: (id: number) => api.get(`/projects/${id}/briefing`),
  saveBriefing: (id: number, content: string) => api.post(`/projects/${id}/briefing`, { content }),
};

// Client sentiment
export const sentimentsApi = {
  list: () => api.get('/sentiments'),
  create: (data: Record<string, unknown>) => api.post('/sentiments', data),
};

// Tasks
export const tasksApi = {
  list: (params?: Record<string, unknown>) => api.get('/tasks', { params }),
  create: (data: Record<string, unknown>) => api.post('/tasks', data),
  get: (id: number) => api.get(`/tasks/${id}`),
  update: (id: number, data: Record<string, unknown>) => api.put(`/tasks/${id}`, data),
  remove: (id: number) => api.delete(`/tasks/${id}`),
  startTimer: (id: number) => api.post(`/tasks/${id}/timer/start`),
  stopTimer: (id: number) => api.post(`/tasks/${id}/timer/stop`),
  iterations: (id: number) => api.get(`/tasks/${id}/iterations`),
  addIteration: (id: number, data: Record<string, unknown>) => api.post(`/tasks/${id}/iterations`, data),
  updateIteration: (taskId: number, iterationId: number, data: Record<string, unknown>) =>
    api.put(`/tasks/${taskId}/iterations/${iterationId}`, data),
};

// Deadline requests
export const deadlineApi = {
  list: () => api.get('/deadline-requests'),
  create: (data: Record<string, unknown>) => api.post('/deadline-requests', data),
  decide: (id: number, data: Record<string, unknown>) => api.put(`/deadline-requests/${id}/decide`, data),
};

// Messages
export const messagesApi = {
  projectMessages: (projectId: number) => api.get(`/projects/${projectId}/messages`),
  sendProjectMessage: (projectId: number, content: string, parentId?: number) =>
    api.post(`/projects/${projectId}/messages`, { content, parent_id: parentId }),
  updateProjectMessage: (id: number, content: string) => api.put(`/messages/project/${id}`, { content }),
  deleteProjectMessage: (id: number) => api.delete(`/messages/project/${id}`),
  inbox: () => api.get('/messages/inbox'),
  conversations: () => api.get('/messages/conversations'),
  directMessages: (userId: number) => api.get(`/messages/direct/${userId}`),
  sendDirect: (userId: number, content: string) => api.post(`/messages/direct/${userId}`, { content }),
  generalMessages: () => api.get('/messages/general'),
  sendGeneral: (content: string) => api.post('/messages/general', { content }),
  reactGeneral: (id: number, emoji: string) => api.post(`/messages/general/${id}/react`, { emoji }),
  deleteDirect: (id: number) => api.delete(`/messages/direct/${id}`),
  deleteGeneral: (id: number) => api.delete(`/messages/general/${id}`),
  pin: (type: 'direct' | 'project' | 'general', id: number, pinned: boolean) => api.post(`/messages/${type}/${id}/pin`, { pinned }),
};

// Notifications
export const notificationsApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  remove: (id: number) => api.delete(`/notifications/${id}`),
};

// Web Push subscriptions
export const pushApi = {
  publicKey: () => api.get<{ public_key: string | null }>('/push/public-key'),
  subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string }; content_encoding: string }) =>
    api.post('/push/subscriptions', subscription),
  unsubscribe: (endpoint: string) => api.delete('/push/subscriptions', { data: { endpoint } }),
};

// Memos
export const memosApi = {
  list: () => api.get('/memos'),
  create: (data: Record<string, unknown>) => api.post('/memos', data),
  get: (id: number) => api.get(`/memos/${id}`),
  remove: (id: number) => api.delete(`/memos/${id}`),
  respond: (id: number, content: string) => api.post(`/memos/${id}/respond`, { content }),
};

// Leave
export const leaveApi = {
  list: () => api.get('/leave'),
  create: (data: Record<string, unknown>) => api.post('/leave', data),
  decide: (id: number, data: Record<string, unknown>) => api.put(`/leave/${id}/decide`, data),
};

// Bookings
export const bookingsApi = {
  list: () => api.get('/bookings'),
  create: (data: Record<string, unknown>) => api.post('/bookings', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/bookings/${id}`, data),
  remove: (id: number) => api.delete(`/bookings/${id}`),
};

// Support
export const supportApi = {
  list: () => api.get('/support'),
  create: (data: Record<string, unknown>) => api.post('/support', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/support/${id}`, data),
};

// Complaints
export const complaintsApi = {
  list: () => api.get('/complaints'),
  create: (data: Record<string, unknown>) => api.post('/complaints', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/complaints/${id}`, data),
};

// Staff complaints
export const staffComplaintsApi = {
  list: () => api.get('/staff-complaints'),
  create: (data: Record<string, unknown>) => api.post('/staff-complaints', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/staff-complaints/${id}`, data),
};

// Staff queries
export const queriesApi = {
  list: () => api.get('/queries'),
  create: (data: Record<string, unknown>) => api.post('/queries', data),
  respond: (id: number, status: 'acknowledged' | 'contested', response?: string) =>
    api.post(`/queries/${id}/respond`, { status, response }),
  remove: (id: number) => api.delete(`/queries/${id}`),
};

// SOPs
export const sopsApi = {
  list: () => api.get('/sops'),
  create: (data: Record<string, unknown>) => api.post('/sops', data),
  get: (id: number) => api.get(`/sops/${id}`),
  update: (id: number, data: Record<string, unknown>) => api.put(`/sops/${id}`, data),
  remove: (id: number) => api.delete(`/sops/${id}`),
  addSegment: (sopId: number, data: Record<string, unknown>) => api.post(`/sops/${sopId}/segments`, data),
  updateSegment: (sopId: number, segId: number, data: Record<string, unknown>) =>
    api.put(`/sops/${sopId}/segments/${segId}`, data),
  removeSegment: (sopId: number, segId: number) => api.delete(`/sops/${sopId}/segments/${segId}`),
};

// Issues
export const issuesApi = {
  list: () => api.get('/issues'),
  create: (data: Record<string, unknown>) => api.post('/issues', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/issues/${id}`, data),
};

// Review links
export const reviewLinksApi = {
  list: () => api.get('/review-links'),
  create: (data: Record<string, unknown>) => api.post('/review-links', data),
  respond: (id: number, status: 'approved' | 'not_approved', review_comment?: string) =>
    api.post(`/review-links/${id}/respond`, { status, review_comment }),
  remove: (id: number) => api.delete(`/review-links/${id}`),
};

// Notes
export const notesApi = {
  list: () => api.get('/notes'),
  create: (data: Record<string, unknown>) => api.post('/notes', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/notes/${id}`, data),
  remove: (id: number) => api.delete(`/notes/${id}`),
};

// KPI report
export const departmentsApi = {
  list: () => api.get('/departments'),
};

export const kpiReportApi = {
  productivity: (params: Record<string, unknown>) => api.get('/kpi-report/productivity', { params }),
};
