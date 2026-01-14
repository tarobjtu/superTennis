import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// 获取用户通知列表
router.get('/user/:userId', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 获取未读通知数量
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.params.userId, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error counting notifications:', error);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

// 标记通知为已读
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// 标记所有通知为已读
router.patch('/read-all/:userId', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.params.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// 创建通知（内部使用）
router.post('/', async (req, res) => {
  try {
    const data = z.object({
      userId: z.string(),
      type: z.string(),
      title: z.string(),
      body: z.string(),
      data: z.string().optional(),
    }).parse(req.body);

    const notification = await prisma.notification.create({ data });
    res.status(201).json(notification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// 删除通知
router.delete('/:id', async (req, res) => {
  try {
    await prisma.notification.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// 注册推送 token
router.post('/push-token', async (req, res) => {
  try {
    const data = z.object({
      userId: z.string(),
      token: z.string(),
      platform: z.string(),
    }).parse(req.body);

    const pushToken = await prisma.pushToken.upsert({
      where: { token: data.token },
      update: { userId: data.userId, platform: data.platform },
      create: data,
    });
    res.json(pushToken);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

export default router;
