import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// 创建比赛邀请
router.post('/', async (req, res) => {
  try {
    const data = z.object({
      inviterId: z.string(),
      inviteeId: z.string(),
      matchTime: z.string().transform((s) => new Date(s)),
      location: z.string().optional(),
      message: z.string().optional(),
    }).parse(req.body);

    const invite = await prisma.matchInvite.create({ data });

    // 创建通知
    const inviter = await prisma.user.findUnique({ where: { id: data.inviterId } });
    await prisma.notification.create({
      data: {
        userId: data.inviteeId,
        type: 'match_invite',
        title: '比赛邀请',
        body: `${inviter?.name || '球友'} 邀请你进行比赛`,
        data: JSON.stringify({ inviteId: invite.id }),
      },
    });

    res.status(201).json(invite);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// 获取用户收到的邀请
router.get('/received/:userId', async (req, res) => {
  try {
    const invites = await prisma.matchInvite.findMany({
      where: { inviteeId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });

    // 获取邀请者信息
    const inviterIds = invites.map((i) => i.inviterId);
    const inviters = await prisma.user.findMany({
      where: { id: { in: inviterIds } },
    });

    const result = invites.map((invite) => ({
      ...invite,
      inviter: inviters.find((u) => u.id === invite.inviterId),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// 获取用户发出的邀请
router.get('/sent/:userId', async (req, res) => {
  try {
    const invites = await prisma.matchInvite.findMany({
      where: { inviterId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });

    // 获取被邀请者信息
    const inviteeIds = invites.map((i) => i.inviteeId);
    const invitees = await prisma.user.findMany({
      where: { id: { in: inviteeIds } },
    });

    const result = invites.map((invite) => ({
      ...invite,
      invitee: invitees.find((u) => u.id === invite.inviteeId),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching sent invites:', error);
    res.status(500).json({ error: 'Failed to fetch sent invites' });
  }
});

// 接受邀请
router.patch('/:id/accept', async (req, res) => {
  try {
    const invite = await prisma.matchInvite.update({
      where: { id: req.params.id },
      data: { status: 'accepted' },
    });

    // 通知邀请者
    const invitee = await prisma.user.findUnique({ where: { id: invite.inviteeId } });
    await prisma.notification.create({
      data: {
        userId: invite.inviterId,
        type: 'match_invite',
        title: '邀请已接受',
        body: `${invitee?.name || '球友'} 接受了你的比赛邀请`,
        data: JSON.stringify({ inviteId: invite.id }),
      },
    });

    res.json(invite);
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// 拒绝邀请
router.patch('/:id/decline', async (req, res) => {
  try {
    const invite = await prisma.matchInvite.update({
      where: { id: req.params.id },
      data: { status: 'declined' },
    });
    res.json(invite);
  } catch (error) {
    console.error('Error declining invite:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// 删除邀请
router.delete('/:id', async (req, res) => {
  try {
    await prisma.matchInvite.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting invite:', error);
    res.status(500).json({ error: 'Failed to delete invite' });
  }
});

export default router;
