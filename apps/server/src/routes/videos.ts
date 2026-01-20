import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// 创建视频记录
router.post('/', async (req, res) => {
  try {
    const data = z
      .object({
        matchId: z.string(),
        userId: z.string(),
        filePath: z.string(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
        thumbnailPath: z.string().optional(),
      })
      .parse(req.body);

    const video = await prisma.matchVideo.create({ data });
    res.status(201).json(video);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating video:', error);
    res.status(500).json({ error: 'Failed to create video record' });
  }
});

// 获取用户的所有视频
router.get('/user/:userId', async (req, res) => {
  try {
    const videos = await prisma.matchVideo.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// 获取比赛的视频
router.get('/match/:matchId', async (req, res) => {
  try {
    const videos = await prisma.matchVideo.findMany({
      where: { matchId: req.params.matchId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(videos);
  } catch (error) {
    console.error('Error fetching match videos:', error);
    res.status(500).json({ error: 'Failed to fetch match videos' });
  }
});

// 删除视频
router.delete('/:id', async (req, res) => {
  try {
    await prisma.matchVideo.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// 创建精彩集锦
router.post('/highlights', async (req, res) => {
  try {
    const data = z
      .object({
        videoId: z.string(),
        matchId: z.string(),
        userId: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const highlight = await prisma.highlight.create({ data });
    res.status(201).json(highlight);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating highlight:', error);
    res.status(500).json({ error: 'Failed to create highlight' });
  }
});

// 获取用户的精彩集锦
router.get('/highlights/user/:userId', async (req, res) => {
  try {
    const highlights = await prisma.highlight.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(highlights);
  } catch (error) {
    console.error('Error fetching highlights:', error);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

// 删除精彩集锦
router.delete('/highlights/:id', async (req, res) => {
  try {
    await prisma.highlight.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting highlight:', error);
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
});

export default router;
