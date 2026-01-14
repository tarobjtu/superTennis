import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// 发送好友请求
router.post('/request', async (req, res) => {
  try {
    const { userId, friendId } = z.object({
      userId: z.string(),
      friendId: z.string(),
    }).parse(req.body);

    // 检查是否已经存在好友关系
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friendship already exists' });
    }

    const friendship = await prisma.friendship.create({
      data: { userId, friendId, status: 'pending' },
    });

    // 创建通知
    await prisma.notification.create({
      data: {
        userId: friendId,
        type: 'friend_request',
        title: '新好友请求',
        body: '有人想添加你为好友',
        data: JSON.stringify({ friendshipId: friendship.id, fromUserId: userId }),
      },
    });

    res.status(201).json(friendship);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// 接受好友请求
router.post('/accept', async (req, res) => {
  try {
    const { friendshipId } = z.object({
      friendshipId: z.string(),
    }).parse(req.body);

    const friendship = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted' },
    });

    res.json(friendship);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// 拒绝/删除好友请求
router.delete('/:id', async (req, res) => {
  try {
    await prisma.friendship.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting friendship:', error);
    res.status(500).json({ error: 'Failed to delete friendship' });
  }
});

// 获取用户好友列表
router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
    });

    // 获取好友的用户信息
    const friendIds = friendships.map((f) =>
      f.userId === userId ? f.friendId : f.userId
    );

    const friends = await prisma.user.findMany({
      where: { id: { in: friendIds } },
    });

    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// 获取待处理的好友请求
router.get('/pending/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const requests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'pending',
      },
    });

    // 获取请求者信息
    const requesters = await prisma.user.findMany({
      where: { id: { in: requests.map((r) => r.userId) } },
    });

    const result = requests.map((r) => ({
      ...r,
      requester: requesters.find((u) => u.id === r.userId),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// 搜索用户（用于添加好友）
router.get('/search', async (req, res) => {
  try {
    const { query, currentUserId } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId as string } },
          {
            OR: [
              { name: { contains: query } },
              { phone: { contains: query } },
            ],
          },
        ],
      },
      take: 20,
    });

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
