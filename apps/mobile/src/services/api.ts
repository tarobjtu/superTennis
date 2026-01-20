// API 配置
// 开发环境使用本地服务器，生产环境需要替换为实际服务器地址
// 注意：真机测试时需要使用电脑的局域网 IP，不能用 localhost
import Constants from 'expo-constants';

const getDevApiUrl = () => {
  // 优先使用 Expo 的 hostUri（会自动获取正确的 IP）
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3001`;
  }
  // 回退到电脑的局域网 IP
  return 'http://10.200.63.13:3001';
};

const DEV_API_URL = getDevApiUrl();
const PROD_API_URL = 'https://api.supertennis.com'; // 生产环境地址

const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// 通用请求函数
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    // 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// Match 相关类型
export interface Match {
  id: string;
  player1Name: string;
  player2Name: string;
  matchType: 'singles' | 'doubles';
  setFormat: 'one' | 'three' | 'tiebreak10';
  useTiebreak: boolean;
  useAdvantage: boolean;
  player1Sets: number[];
  player2Sets: number[];
  player1Points: number;
  player2Points: number;
  currentSet: number;
  isFinished: boolean;
  winner: number | null;
  duration: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface CreateMatchInput {
  player1Name: string;
  player2Name: string;
  matchType: 'singles' | 'doubles';
  setFormat: 'one' | 'three' | 'tiebreak10';
  useTiebreak?: boolean;
  useAdvantage?: boolean;
}

export interface UpdateScoreInput {
  player1Sets: number[];
  player2Sets: number[];
  player1Points: number;
  player2Points: number;
  currentSet: number;
  isFinished?: boolean;
  winner?: number | null;
}

// Match API
export const matchApi = {
  // 获取所有比赛
  getAll: () => request<Match[]>('/api/matches'),

  // 获取单个比赛
  getById: (id: string) => request<Match>(`/api/matches/${id}`),

  // 创建比赛
  create: (data: CreateMatchInput) =>
    request<Match>('/api/matches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 更新比分
  updateScore: (id: string, data: UpdateScoreInput) =>
    request<Match>(`/api/matches/${id}/score`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 结束比赛
  finish: (id: string, winner: number, duration: number) =>
    request<Match>(`/api/matches/${id}/finish`, {
      method: 'PATCH',
      body: JSON.stringify({ winner, duration }),
    }),

  // 删除比赛
  delete: (id: string) =>
    request<null>(`/api/matches/${id}`, {
      method: 'DELETE',
    }),
};

// User 相关类型
export interface User {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  level: number;
  rating: number;
  createdAt: string;
}

export interface UserStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
}

// User API
export const userApi = {
  // 获取用户列表
  getAll: () => request<User[]>('/api/users'),

  // 按手机号查询用户
  getByPhone: (phone: string) => request<User[]>(`/api/users?phone=${encodeURIComponent(phone)}`),

  // 获取单个用户
  getById: (id: string) => request<User>(`/api/users/${id}`),

  // 获取用户统计
  getStats: (id: string) => request<UserStats>(`/api/users/${id}/stats`),

  // 创建用户
  create: (data: { name: string; phone?: string; level?: number }) =>
    request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 更新用户
  update: (id: string, data: Partial<User>) =>
    request<User>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Health check
export const healthCheck = () => request<{ status: string; timestamp: string }>('/health');

// Friendship 相关类型
export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
  requester?: User;
}

// Friends API
export const friendsApi = {
  // 发送好友请求
  sendRequest: (userId: string, friendId: string) =>
    request<Friendship>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ userId, friendId }),
    }),

  // 接受好友请求
  acceptRequest: (friendshipId: string) =>
    request<Friendship>('/api/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    }),

  // 删除好友
  remove: (id: string) => request<null>(`/api/friends/${id}`, { method: 'DELETE' }),

  // 获取好友列表
  getList: (userId: string) => request<User[]>(`/api/friends/list/${userId}`),

  // 获取待处理的好友请求
  getPending: (userId: string) => request<Friendship[]>(`/api/friends/pending/${userId}`),

  // 搜索用户
  searchUsers: (query: string, currentUserId: string) =>
    request<User[]>(
      `/api/friends/search?query=${encodeURIComponent(query)}&currentUserId=${currentUserId}`
    ),
};

// Video 相关类型
export interface MatchVideo {
  id: string;
  matchId: string;
  userId: string;
  filePath: string;
  duration?: number;
  fileSize?: number;
  thumbnailPath?: string;
  isHighlight: boolean;
  createdAt: string;
}

export interface Highlight {
  id: string;
  videoId: string;
  matchId: string;
  userId: string;
  startTime: number;
  endTime: number;
  type: 'ace' | 'winner' | 'rally' | 'dispute' | 'other';
  title?: string;
  description?: string;
  thumbnailPath?: string;
  createdAt: string;
}

// Videos API
export const videosApi = {
  // 创建视频记录
  create: (data: Omit<MatchVideo, 'id' | 'createdAt' | 'isHighlight'>) =>
    request<MatchVideo>('/api/videos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取用户视频
  getByUser: (userId: string) => request<MatchVideo[]>(`/api/videos/user/${userId}`),

  // 获取比赛视频
  getByMatch: (matchId: string) => request<MatchVideo[]>(`/api/videos/match/${matchId}`),

  // 删除视频
  delete: (id: string) => request<null>(`/api/videos/${id}`, { method: 'DELETE' }),

  // 创建精彩集锦
  createHighlight: (data: Omit<Highlight, 'id' | 'createdAt'>) =>
    request<Highlight>('/api/videos/highlights', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取用户精彩集锦
  getHighlights: (userId: string) => request<Highlight[]>(`/api/videos/highlights/user/${userId}`),

  // 删除精彩集锦
  deleteHighlight: (id: string) =>
    request<null>(`/api/videos/highlights/${id}`, { method: 'DELETE' }),
};

// Notification 相关类型
export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'match_invite' | 'match_reminder' | 'system';
  title: string;
  body: string;
  data?: string;
  isRead: boolean;
  createdAt: string;
}

// Notifications API
export const notificationsApi = {
  // 获取通知列表
  getAll: (userId: string) => request<Notification[]>(`/api/notifications/user/${userId}`),

  // 获取未读数量
  getUnreadCount: async (userId: string) => {
    const result = await request<{ count: number }>(`/api/notifications/unread-count/${userId}`);
    return result.count;
  },

  // 标记已读
  markAsRead: (id: string) =>
    request<Notification>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  // 全部标记已读
  markAllAsRead: (userId: string) =>
    request<{ success: boolean }>(`/api/notifications/read-all/${userId}`, { method: 'PATCH' }),

  // 删除通知
  delete: (id: string) => request<null>(`/api/notifications/${id}`, { method: 'DELETE' }),

  // 注册推送 token
  registerPushToken: (userId: string, token: string, platform: string) =>
    request('/api/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ userId, token, platform }),
    }),
};

// MatchInvite 相关类型
export interface MatchInvite {
  id: string;
  inviterId: string;
  inviteeId: string;
  matchTime: string;
  location?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  inviter?: User;
  invitee?: User;
}

// Invites API
export const invitesApi = {
  // 创建邀请
  create: (data: {
    inviterId: string;
    inviteeId: string;
    matchTime: string;
    location?: string;
    message?: string;
  }) =>
    request<MatchInvite>('/api/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取收到的邀请
  getReceived: (userId: string) => request<MatchInvite[]>(`/api/invites/received/${userId}`),

  // 获取发出的邀请
  getSent: (userId: string) => request<MatchInvite[]>(`/api/invites/sent/${userId}`),

  // 接受邀请
  accept: (id: string) => request<MatchInvite>(`/api/invites/${id}/accept`, { method: 'PATCH' }),

  // 拒绝邀请
  decline: (id: string) => request<MatchInvite>(`/api/invites/${id}/decline`, { method: 'PATCH' }),

  // 删除邀请
  delete: (id: string) => request<null>(`/api/invites/${id}`, { method: 'DELETE' }),
};

// Leaderboard 相关类型
export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  level: number;
  rank: number;
}

export interface RatingHistoryEntry {
  id: string;
  userId: string;
  rating: number;
  matchId?: string;
  change: number;
  createdAt: string;
}

// Leaderboard API
export const leaderboardApi = {
  // 获取排行榜
  getLeaderboard: (limit = 50, offset = 0) =>
    request<LeaderboardEntry[]>(`/api/leaderboard?limit=${limit}&offset=${offset}`),

  // 获取用户排名
  getUserRank: (userId: string) =>
    request<{ rank: number; total: number; percentile: number }>(`/api/leaderboard/rank/${userId}`),

  // 获取评分历史
  getRatingHistory: (userId: string, limit = 30) =>
    request<RatingHistoryEntry[]>(`/api/leaderboard/history/${userId}?limit=${limit}`),

  // 获取周/月排行
  getTopGainers: (period: 'week' | 'month' | 'all', limit = 10) =>
    request<any[]>(`/api/leaderboard/top/${period}?limit=${limit}`),

  // 匹配对手
  findMatch: (userId: string) => request<any[]>(`/api/leaderboard/match/${userId}`),

  // 更新比赛后评分
  updateRatings: (matchId: string, winnerId: string, loserId: string) =>
    request<any>('/api/leaderboard/update-ratings', {
      method: 'POST',
      body: JSON.stringify({ matchId, winnerId, loserId }),
    }),
};

// Training 相关类型
export interface TrainingSession {
  id: string;
  userId: string;
  type: 'serve' | 'forehand' | 'backhand' | 'volley' | 'rally';
  duration: number;
  totalShots: number;
  successfulShots: number;
  avgSpeed?: number;
  maxSpeed?: number;
  notes?: string;
  createdAt: string;
}

export interface TrainingGoal {
  id: string;
  userId: string;
  type: string;
  target: number;
  current: number;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
}

export interface Achievement {
  id: string;
  userId: string;
  type: string;
  title: string;
  description?: string;
  icon?: string;
  unlockedAt: string;
}

// Training API
export const trainingApi = {
  // 获取训练类型
  getTypes: () =>
    request<{ id: string; name: string; icon: string; description: string }[]>(
      '/api/training/types'
    ),

  // 开始训练
  startSession: (userId: string, type: string) =>
    request<TrainingSession>('/api/training/sessions', {
      method: 'POST',
      body: JSON.stringify({ userId, type }),
    }),

  // 更新训练
  updateSession: (id: string, data: Partial<TrainingSession>) =>
    request<TrainingSession>(`/api/training/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 获取训练历史
  getSessions: (userId: string, type?: string, limit = 20) =>
    request<TrainingSession[]>(
      `/api/training/sessions/user/${userId}?${type ? `type=${type}&` : ''}limit=${limit}`
    ),

  // 获取训练统计
  getStats: (userId: string) => request<any>(`/api/training/stats/${userId}`),

  // 创建目标
  createGoal: (data: Omit<TrainingGoal, 'id' | 'current' | 'isCompleted'>) =>
    request<TrainingGoal>('/api/training/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取目标
  getGoals: (userId: string) => request<TrainingGoal[]>(`/api/training/goals/${userId}`),

  // 更新目标进度
  updateGoalProgress: (id: string, current: number) =>
    request<TrainingGoal>(`/api/training/goals/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ current }),
    }),

  // 获取成就
  getAchievements: (userId: string) =>
    request<Achievement[]>(`/api/training/achievements/${userId}`),
};

// Club 相关类型
export interface Club {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  location?: string;
  memberCount: number;
  createdAt: string;
}

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  user?: User;
}

// Clubs API
export const clubsApi = {
  // 创建俱乐部
  create: (data: {
    name: string;
    description?: string;
    avatar?: string;
    location?: string;
    creatorId: string;
  }) =>
    request<Club>('/api/clubs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取俱乐部列表
  getAll: (search?: string, limit = 20, offset = 0) =>
    request<Club[]>(
      `/api/clubs?${search ? `search=${encodeURIComponent(search)}&` : ''}limit=${limit}&offset=${offset}`
    ),

  // 获取俱乐部详情
  getById: (id: string) => request<Club & { members: ClubMember[] }>(`/api/clubs/${id}`),

  // 更新俱乐部
  update: (id: string, userId: string, data: Partial<Club>) =>
    request<Club>(`/api/clubs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, userId }),
    }),

  // 加入俱乐部
  join: (id: string, userId: string) =>
    request<ClubMember>(`/api/clubs/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // 退出俱乐部
  leave: (id: string, userId: string) =>
    request<{ success: boolean }>(`/api/clubs/${id}/leave`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // 获取用户加入的俱乐部
  getUserClubs: (userId: string) =>
    request<(Club & { role: string; joinedAt: string })[]>(`/api/clubs/user/${userId}`),

  // 更改成员角色
  changeMemberRole: (clubId: string, memberId: string, userId: string, newRole: string) =>
    request<ClubMember>(`/api/clubs/${clubId}/members/${memberId}/role`, {
      method: 'POST',
      body: JSON.stringify({ userId, newRole }),
    }),

  // 获取俱乐部排行榜
  getLeaderboard: (id: string) => request<LeaderboardEntry[]>(`/api/clubs/${id}/leaderboard`),
};

// Analytics 相关类型
export interface OpponentReport {
  id: string;
  userId: string;
  opponentId?: string;
  opponentName: string;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  serveAnalysis?: string;
  returnAnalysis?: string;
  rallyAnalysis?: string;
  weaknesses?: string;
  strengths?: string;
  matchHistory: any[];
}

// Analytics API
export const analyticsApi = {
  // 获取对手分析
  getOpponentReport: (userId: string, opponentName: string) =>
    request<OpponentReport>(
      `/api/analytics/opponent/${userId}/${encodeURIComponent(opponentName)}`
    ),

  // 更新对手分析
  updateOpponentReport: (userId: string, opponentName: string, data: Partial<OpponentReport>) =>
    request<OpponentReport>(
      `/api/analytics/opponent/${userId}/${encodeURIComponent(opponentName)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),

  // 获取所有对手
  getOpponents: (userId: string) => request<any[]>(`/api/analytics/opponents/${userId}`),

  // 获取表现分析
  getPerformance: (userId: string, period?: 'week' | 'month' | 'year') =>
    request<any>(`/api/analytics/performance/${userId}?${period ? `period=${period}` : ''}`),

  // 获取技术分析
  getTechniqueAnalysis: (userId: string) => request<any>(`/api/analytics/technique/${userId}`),
};

export default {
  match: matchApi,
  user: userApi,
  friends: friendsApi,
  videos: videosApi,
  notifications: notificationsApi,
  invites: invitesApi,
  leaderboard: leaderboardApi,
  training: trainingApi,
  clubs: clubsApi,
  analytics: analyticsApi,
  healthCheck,
};
