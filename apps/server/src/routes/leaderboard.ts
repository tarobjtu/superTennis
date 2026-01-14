/**
 * 排行榜路由
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ELO 计算函数
function calculateEloChange(
  winnerRating: number,
  loserRating: number,
  kFactor: number = 32
): { winnerChange: number; loserChange: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  const winnerChange = Math.round(kFactor * (1 - expectedWinner));
  const loserChange = Math.round(kFactor * (0 - expectedLoser));

  return { winnerChange, loserChange };
}

// 获取排行榜
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const users = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      select: {
        id: true,
        name: true,
        avatar: true,
        rating: true,
        level: true,
      },
    });

    // 添加排名
    const leaderboard = users.map((user, index) => ({
      ...user,
      rank: Number(offset) + index + 1,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// 获取用户排名
router.get('/rank/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rating: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 计算排名（比这个分数高的人数 + 1）
    const higherCount = await prisma.user.count({
      where: { rating: { gt: user.rating } },
    });

    const totalUsers = await prisma.user.count();

    res.json({
      rank: higherCount + 1,
      total: totalUsers,
      percentile: Math.round((1 - higherCount / totalUsers) * 100),
    });
  } catch (error) {
    console.error('Failed to get user rank:', error);
    res.status(500).json({ error: 'Failed to get user rank' });
  }
});

// 获取评分历史
router.get('/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 30 } = req.query;

    const history = await prisma.ratingHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json(history);
  } catch (error) {
    console.error('Failed to get rating history:', error);
    res.status(500).json({ error: 'Failed to get rating history' });
  }
});

// 更新比赛后的评分
router.post('/update-ratings', async (req: Request, res: Response) => {
  try {
    const { matchId, winnerId, loserId } = req.body;

    // 获取两个用户的当前评分
    const [winner, loser] = await Promise.all([
      prisma.user.findUnique({ where: { id: winnerId } }),
      prisma.user.findUnique({ where: { id: loserId } }),
    ]);

    if (!winner || !loser) {
      return res.status(404).json({ error: 'Users not found' });
    }

    // 计算 ELO 变化
    const { winnerChange, loserChange } = calculateEloChange(
      winner.rating,
      loser.rating
    );

    // 更新评分
    const [updatedWinner, updatedLoser] = await Promise.all([
      prisma.user.update({
        where: { id: winnerId },
        data: { rating: winner.rating + winnerChange },
      }),
      prisma.user.update({
        where: { id: loserId },
        data: { rating: loser.rating + loserChange },
      }),
    ]);

    // 记录历史
    await Promise.all([
      prisma.ratingHistory.create({
        data: {
          userId: winnerId,
          rating: updatedWinner.rating,
          matchId,
          change: winnerChange,
        },
      }),
      prisma.ratingHistory.create({
        data: {
          userId: loserId,
          rating: updatedLoser.rating,
          matchId,
          change: loserChange,
        },
      }),
    ]);

    res.json({
      winner: {
        id: winnerId,
        oldRating: winner.rating,
        newRating: updatedWinner.rating,
        change: winnerChange,
      },
      loser: {
        id: loserId,
        oldRating: loser.rating,
        newRating: updatedLoser.rating,
        change: loserChange,
      },
    });
  } catch (error) {
    console.error('Failed to update ratings:', error);
    res.status(500).json({ error: 'Failed to update ratings' });
  }
});

// 获取周/月排行榜
router.get('/top/:period', async (req: Request, res: Response) => {
  try {
    const { period } = req.params;
    const { limit = 10 } = req.query;

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
      default:
        startDate = new Date(0);
    }

    // 获取时间段内积分变化最大的用户
    const ratingChanges = await prisma.ratingHistory.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate },
        change: { gt: 0 },
      },
      _sum: { change: true },
      orderBy: { _sum: { change: 'desc' } },
      take: Number(limit),
    });

    // 获取用户详情
    const userIds = ratingChanges.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        avatar: true,
        rating: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const topGainers = ratingChanges.map((r, index) => ({
      rank: index + 1,
      user: userMap.get(r.userId),
      totalGain: r._sum.change || 0,
    }));

    res.json(topGainers);
  } catch (error) {
    console.error('Failed to get top gainers:', error);
    res.status(500).json({ error: 'Failed to get top gainers' });
  }
});

// 匹配对手
router.get('/match/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 找到评分相近的用户（±150 分）
    const matchedUsers = await prisma.user.findMany({
      where: {
        id: { not: userId },
        rating: {
          gte: user.rating - 150,
          lte: user.rating + 150,
        },
      },
      orderBy: { rating: 'asc' },
      take: 10,
      select: {
        id: true,
        name: true,
        avatar: true,
        rating: true,
        level: true,
      },
    });

    // 计算预期胜率
    const suggestions = matchedUsers.map((opponent) => ({
      ...opponent,
      expectedWinRate: Math.round(
        (1 / (1 + Math.pow(10, (opponent.rating - user.rating) / 400))) * 100
      ),
      ratingDiff: opponent.rating - user.rating,
    }));

    res.json(suggestions);
  } catch (error) {
    console.error('Failed to find match:', error);
    res.status(500).json({ error: 'Failed to find match' });
  }
});

export default router;
