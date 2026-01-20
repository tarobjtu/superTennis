/**
 * 分享服务 - 生成分享海报和社交分享
 */

import { Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// 比赛结果分享数据
export interface MatchShareData {
  player1Name: string;
  player2Name: string;
  player1Sets: number[];
  player2Sets: number[];
  winner: 1 | 2;
  duration: number;
  date: Date;
  matchType: 'singles' | 'doubles';
}

// 成就分享数据
export interface AchievementShareData {
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  userName: string;
}

// 训练总结分享数据
export interface TrainingShareData {
  type: string;
  duration: number;
  totalShots: number;
  successRate: number;
  avgSpeed?: number;
  date: Date;
  userName: string;
}

/**
 * 生成比赛结果文本
 */
export function generateMatchResultText(data: MatchShareData): string {
  const winnerName = data.winner === 1 ? data.player1Name : data.player2Name;
  const loserName = data.winner === 1 ? data.player2Name : data.player1Name;

  const sets = data.player1Sets.map((s, i) => `${s}-${data.player2Sets[i]}`).join(' ');

  const durationMin = Math.floor(data.duration / 60);
  const dateStr = data.date.toLocaleDateString('zh-CN');

  return `🎾 网球比赛结果

🏆 ${winnerName} 获胜！

比分: ${sets}
时长: ${durationMin} 分钟
日期: ${dateStr}
类型: ${data.matchType === 'singles' ? '单打' : '双打'}

#SuperTennis #网球 #运动`;
}

/**
 * 生成成就分享文本
 */
export function generateAchievementText(data: AchievementShareData): string {
  const dateStr = data.unlockedAt.toLocaleDateString('zh-CN');

  return `${data.icon} 成就解锁！

${data.title}
${data.description}

解锁者: ${data.userName}
解锁时间: ${dateStr}

#SuperTennis #网球 #成就`;
}

/**
 * 生成训练总结文本
 */
export function generateTrainingText(data: TrainingShareData): string {
  const durationMin = Math.floor(data.duration / 60);
  const dateStr = data.date.toLocaleDateString('zh-CN');

  const typeNames: { [key: string]: string } = {
    serve: '发球练习',
    forehand: '正手击球',
    backhand: '反手击球',
    volley: '网前截击',
    rally: '底线对抗',
  };

  let text = `🎾 训练完成！

训练类型: ${typeNames[data.type] || data.type}
训练时长: ${durationMin} 分钟
击球次数: ${data.totalShots}
成功率: ${data.successRate}%`;

  if (data.avgSpeed) {
    text += `\n平均球速: ${data.avgSpeed.toFixed(1)} km/h`;
  }

  text += `\n日期: ${dateStr}

#SuperTennis #网球训练 #运动`;

  return text;
}

/**
 * 生成排行榜分享文本
 */
export function generateLeaderboardText(
  rank: number,
  rating: number,
  userName: string,
  percentile: number
): string {
  let emoji = '';
  if (rank === 1) emoji = '🥇';
  else if (rank === 2) emoji = '🥈';
  else if (rank === 3) emoji = '🥉';
  else if (rank <= 10) emoji = '🏅';
  else emoji = '🎾';

  return `${emoji} SuperTennis 排行榜

玩家: ${userName}
排名: #${rank}
积分: ${rating}
超越: ${percentile}% 的玩家

#SuperTennis #网球排行 #运动`;
}

/**
 * 分享文本到社交平台
 */
export async function shareText(content: string, title?: string): Promise<boolean> {
  try {
    const result = await Share.share(
      {
        message: content,
        title: title || 'SuperTennis',
      },
      {
        dialogTitle: '分享到',
      }
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

/**
 * 分享比赛结果
 */
export async function shareMatchResult(data: MatchShareData): Promise<boolean> {
  const text = generateMatchResultText(data);
  return shareText(text, '比赛结果');
}

/**
 * 分享成就
 */
export async function shareAchievement(data: AchievementShareData): Promise<boolean> {
  const text = generateAchievementText(data);
  return shareText(text, '成就解锁');
}

/**
 * 分享训练总结
 */
export async function shareTraining(data: TrainingShareData): Promise<boolean> {
  const text = generateTrainingText(data);
  return shareText(text, '训练完成');
}

/**
 * 分享排行榜
 */
export async function shareLeaderboard(
  rank: number,
  rating: number,
  userName: string,
  percentile: number
): Promise<boolean> {
  const text = generateLeaderboardText(rank, rating, userName, percentile);
  return shareText(text, '排行榜');
}

/**
 * 生成海报 SVG 模板（比赛结果）
 */
export function generateMatchPosterSvg(data: MatchShareData): string {
  const winnerName = data.winner === 1 ? data.player1Name : data.player2Name;
  const sets = data.player1Sets.map((s, i) => `${s}-${data.player2Sets[i]}`).join('  ');
  const dateStr = data.date.toLocaleDateString('zh-CN');

  return `
<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1E40AF"/>
      <stop offset="100%" style="stop-color:#10B981"/>
    </linearGradient>
  </defs>

  <rect width="400" height="600" fill="url(#bg)"/>

  <text x="200" y="80" text-anchor="middle" fill="white" font-size="24" font-weight="bold">
    🎾 SuperTennis
  </text>

  <text x="200" y="180" text-anchor="middle" fill="white" font-size="48" font-weight="bold">
    🏆
  </text>

  <text x="200" y="240" text-anchor="middle" fill="white" font-size="28" font-weight="bold">
    ${winnerName} 获胜！
  </text>

  <text x="200" y="320" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="20">
    ${data.player1Name}
  </text>
  <text x="200" y="355" text-anchor="middle" fill="white" font-size="36" font-weight="bold">
    ${sets}
  </text>
  <text x="200" y="390" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="20">
    ${data.player2Name}
  </text>

  <text x="200" y="480" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="16">
    ${dateStr} · ${data.matchType === 'singles' ? '单打' : '双打'}
  </text>

  <text x="200" y="560" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="12">
    SuperTennis - 你的网球伙伴
  </text>
</svg>`;
}

/**
 * 生成海报 SVG 模板（成就）
 */
export function generateAchievementPosterSvg(data: AchievementShareData): string {
  return `
<svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FCD34D"/>
      <stop offset="100%" style="stop-color:#F59E0B"/>
    </linearGradient>
  </defs>

  <rect width="400" height="500" fill="url(#bg)"/>

  <text x="200" y="80" text-anchor="middle" fill="#1F2937" font-size="24" font-weight="bold">
    🎾 SuperTennis
  </text>

  <text x="200" y="180" text-anchor="middle" font-size="72">
    ${data.icon}
  </text>

  <text x="200" y="260" text-anchor="middle" fill="#1F2937" font-size="24" font-weight="bold">
    成就解锁！
  </text>

  <text x="200" y="310" text-anchor="middle" fill="#1F2937" font-size="20" font-weight="600">
    ${data.title}
  </text>

  <text x="200" y="350" text-anchor="middle" fill="rgba(31,41,55,0.7)" font-size="14">
    ${data.description}
  </text>

  <text x="200" y="420" text-anchor="middle" fill="rgba(31,41,55,0.6)" font-size="14">
    ${data.userName}
  </text>

  <text x="200" y="470" text-anchor="middle" fill="rgba(31,41,55,0.4)" font-size="12">
    SuperTennis - 你的网球伙伴
  </text>
</svg>`;
}

export default {
  shareText,
  shareMatchResult,
  shareAchievement,
  shareTraining,
  shareLeaderboard,
  generateMatchResultText,
  generateAchievementText,
  generateTrainingText,
  generateLeaderboardText,
  generateMatchPosterSvg,
  generateAchievementPosterSvg,
};
