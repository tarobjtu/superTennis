import { Router } from 'express';
import { PrismaClient, Match } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// 验证 schema
const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  level: z.number().default(3.0),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().optional(),
  level: z.number().optional(),
});

// GET /api/users - 获取所有用户 (支持 phone 查询参数)
router.get('/', async (req, res) => {
  try {
    const { phone } = req.query;

    // 如果提供了手机号，按手机号查询
    if (phone && typeof phone === 'string') {
      const user = await prisma.user.findFirst({
        where: { phone },
      });
      if (user) {
        return res.json([user]);
      }
      return res.json([]);
    }

    // 否则返回所有用户
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - 获取单个用户
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/users/:id/stats - 获取用户统计数据
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = req.params.id;

    // 获取用户所有比赛
    const matches = await prisma.match.findMany({
      where: {
        isFinished: true,
        // 这里简化处理，实际需要关联用户ID
      },
    });

    const totalMatches = matches.length;
    const wins = matches.filter((m: Match) => m.winner === 1).length; // 简化
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    res.json({
      totalMatches,
      wins,
      losses: totalMatches - wins,
      winRate,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// POST /api/users - 创建用户
router.post('/', async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        ...data,
        rating: 1200, // 初始 rating
      },
    });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id - 更新用户
router.patch('/:id', async (req, res) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
