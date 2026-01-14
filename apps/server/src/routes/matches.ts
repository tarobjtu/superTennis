import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// 验证 schema
const createMatchSchema = z.object({
  player1Name: z.string().min(1),
  player2Name: z.string().min(1),
  matchType: z.enum(['singles', 'doubles']),
  setFormat: z.enum(['one', 'three', 'tiebreak10']),
  useTiebreak: z.boolean().default(true),
  useAdvantage: z.boolean().default(true),
});

const updateScoreSchema = z.object({
  player1Sets: z.array(z.number()),
  player2Sets: z.array(z.number()),
  player1Points: z.number(),
  player2Points: z.number(),
  currentSet: z.number(),
  isFinished: z.boolean().default(false),
  winner: z.number().nullable().optional(),
});

// 解析 match 中的 JSON 字段
function parseMatchJson(match: any) {
  return {
    ...match,
    player1Sets: JSON.parse(match.player1Sets || '[]'),
    player2Sets: JSON.parse(match.player2Sets || '[]'),
  };
}

// GET /api/matches - 获取所有比赛
router.get('/', async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(matches.map(parseMatchJson));
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET /api/matches/:id - 获取单个比赛
router.get('/:id', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
    });
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(parseMatchJson(match));
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// POST /api/matches - 创建新比赛
router.post('/', async (req, res) => {
  try {
    const data = createMatchSchema.parse(req.body);
    const match = await prisma.match.create({
      data: {
        ...data,
        player1Sets: JSON.stringify([0]),
        player2Sets: JSON.stringify([0]),
        player1Points: 0,
        player2Points: 0,
        currentSet: 0,
        isFinished: false,
      },
    });
    res.status(201).json(parseMatchJson(match));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating match:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// PATCH /api/matches/:id/score - 更新比分
router.patch('/:id/score', async (req, res) => {
  try {
    const data = updateScoreSchema.parse(req.body);
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        player1Sets: JSON.stringify(data.player1Sets),
        player2Sets: JSON.stringify(data.player2Sets),
        player1Points: data.player1Points,
        player2Points: data.player2Points,
        currentSet: data.currentSet,
        isFinished: data.isFinished,
        winner: data.winner,
        updatedAt: new Date(),
      },
    });
    res.json(parseMatchJson(match));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating score:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

// PATCH /api/matches/:id/finish - 结束比赛
router.patch('/:id/finish', async (req, res) => {
  try {
    const { winner, duration } = req.body;
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        isFinished: true,
        winner,
        duration,
        finishedAt: new Date(),
      },
    });
    res.json(parseMatchJson(match));
  } catch (error) {
    console.error('Error finishing match:', error);
    res.status(500).json({ error: 'Failed to finish match' });
  }
});

// DELETE /api/matches/:id - 删除比赛
router.delete('/:id', async (req, res) => {
  try {
    await prisma.match.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

export default router;
