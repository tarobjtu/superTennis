/**
 * 训练模式路由
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 训练类型定义
const TRAINING_TYPES = {
  serve: { name: '发球练习', icon: '🎾', description: '提高发球速度和准确性' },
  forehand: { name: '正手击球', icon: '💪', description: '强化正手进攻能力' },
  backhand: { name: '反手击球', icon: '🏃', description: '提升反手稳定性' },
  volley: { name: '网前截击', icon: '⚡', description: '练习网前技术' },
  rally: { name: '底线对抗', icon: '🔄', description: '增强底线相持能力' },
};

// 获取训练类型列表
router.get('/types', (req: Request, res: Response) => {
  const types = Object.entries(TRAINING_TYPES).map(([id, data]) => ({
    id,
    ...data,
  }));
  res.json(types);
});

// 开始训练会话
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, type } = req.body;

    if (!TRAINING_TYPES[type as keyof typeof TRAINING_TYPES]) {
      return res.status(400).json({ error: 'Invalid training type' });
    }

    const session = await prisma.trainingSession.create({
      data: {
        userId,
        type,
        duration: 0,
        totalShots: 0,
        successfulShots: 0,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Failed to create training session:', error);
    res.status(500).json({ error: 'Failed to create training session' });
  }
});

// 更新训练会话
router.put('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { duration, totalShots, successfulShots, avgSpeed, maxSpeed, notes } = req.body;

    const session = await prisma.trainingSession.update({
      where: { id },
      data: {
        duration,
        totalShots,
        successfulShots,
        avgSpeed,
        maxSpeed,
        notes,
      },
    });

    res.json(session);
  } catch (error) {
    console.error('Failed to update training session:', error);
    res.status(500).json({ error: 'Failed to update training session' });
  }
});

// 获取用户训练历史
router.get('/sessions/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type, limit = 20 } = req.query;

    const sessions = await prisma.trainingSession.findMany({
      where: {
        userId,
        ...(type ? { type: type as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json(sessions);
  } catch (error) {
    console.error('Failed to get training sessions:', error);
    res.status(500).json({ error: 'Failed to get training sessions' });
  }
});

// 获取训练统计
router.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 获取各类型训练总结
    const statsByType = await prisma.trainingSession.groupBy({
      by: ['type'],
      where: { userId },
      _count: true,
      _sum: {
        duration: true,
        totalShots: true,
        successfulShots: true,
      },
      _avg: {
        avgSpeed: true,
        maxSpeed: true,
      },
    });

    // 获取本周训练时长
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyStats = await prisma.trainingSession.aggregate({
      where: {
        userId,
        createdAt: { gte: weekAgo },
      },
      _sum: { duration: true },
      _count: true,
    });

    // 获取最近的训练趋势
    const recentSessions = await prisma.trainingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        type: true,
        successfulShots: true,
        totalShots: true,
        createdAt: true,
      },
    });

    res.json({
      byType: statsByType.map((stat) => ({
        type: stat.type,
        typeInfo: TRAINING_TYPES[stat.type as keyof typeof TRAINING_TYPES],
        sessionCount: stat._count,
        totalDuration: stat._sum.duration || 0,
        totalShots: stat._sum.totalShots || 0,
        successfulShots: stat._sum.successfulShots || 0,
        successRate: stat._sum.totalShots
          ? Math.round((stat._sum.successfulShots! / stat._sum.totalShots!) * 100)
          : 0,
        avgSpeed: stat._avg.avgSpeed,
        maxSpeed: stat._avg.maxSpeed,
      })),
      weekly: {
        totalDuration: weeklyStats._sum.duration || 0,
        sessionCount: weeklyStats._count,
      },
      recentSessions,
    });
  } catch (error) {
    console.error('Failed to get training stats:', error);
    res.status(500).json({ error: 'Failed to get training stats' });
  }
});

// 创建训练目标
router.post('/goals', async (req: Request, res: Response) => {
  try {
    const { userId, type, target, startDate, endDate } = req.body;

    const goal = await prisma.trainingGoal.create({
      data: {
        userId,
        type,
        target,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    console.error('Failed to create training goal:', error);
    res.status(500).json({ error: 'Failed to create training goal' });
  }
});

// 获取用户训练目标
router.get('/goals/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const goals = await prisma.trainingGoal.findMany({
      where: {
        userId,
        endDate: { gte: new Date() },
      },
      orderBy: { endDate: 'asc' },
    });

    res.json(goals);
  } catch (error) {
    console.error('Failed to get training goals:', error);
    res.status(500).json({ error: 'Failed to get training goals' });
  }
});

// 更新目标进度
router.put('/goals/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { current } = req.body;

    const goal = await prisma.trainingGoal.findUnique({ where: { id } });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const isCompleted = current >= goal.target;

    const updatedGoal = await prisma.trainingGoal.update({
      where: { id },
      data: { current, isCompleted },
    });

    // 如果完成目标，解锁成就
    if (isCompleted && !goal.isCompleted) {
      await prisma.achievement.upsert({
        where: {
          userId_type: {
            userId: goal.userId,
            type: `goal_${goal.type}`,
          },
        },
        update: {},
        create: {
          userId: goal.userId,
          type: `goal_${goal.type}`,
          title: '目标达成',
          description: `完成了 ${goal.type} 目标`,
          icon: '🎯',
        },
      });
    }

    res.json(updatedGoal);
  } catch (error) {
    console.error('Failed to update goal progress:', error);
    res.status(500).json({ error: 'Failed to update goal progress' });
  }
});

// 获取用户成就
router.get('/achievements/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const achievements = await prisma.achievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    });

    res.json(achievements);
  } catch (error) {
    console.error('Failed to get achievements:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

export default router;
