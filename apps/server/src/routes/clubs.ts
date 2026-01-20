/**
 * 俱乐部系统路由
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, ClubMember, Club, User } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 创建俱乐部
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, avatar, location, creatorId } = req.body;

    const club = await prisma.club.create({
      data: {
        name,
        description,
        avatar,
        location,
        memberCount: 1,
      },
    });

    // 创建者自动成为管理员
    await prisma.clubMember.create({
      data: {
        clubId: club.id,
        userId: creatorId,
        role: 'admin',
      },
    });

    res.status(201).json(club);
  } catch (error) {
    console.error('Failed to create club:', error);
    res.status(500).json({ error: 'Failed to create club' });
  }
});

// 获取俱乐部列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, limit = 20, offset = 0 } = req.query;

    const clubs = await prisma.club.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search as string } },
              { description: { contains: search as string } },
              { location: { contains: search as string } },
            ],
          }
        : {},
      orderBy: { memberCount: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(clubs);
  } catch (error) {
    console.error('Failed to get clubs:', error);
    res.status(500).json({ error: 'Failed to get clubs' });
  }
});

// 获取俱乐部详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const club = await prisma.club.findUnique({
      where: { id },
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // 获取成员列表
    const members = await prisma.clubMember.findMany({
      where: { clubId: id },
      orderBy: { joinedAt: 'asc' },
    });

    // 获取成员详情
    const memberIds = members.map((m: ClubMember) => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        name: true,
        avatar: true,
        rating: true,
        level: true,
      },
    });

    const userMap = new Map(
      users.map((u: Pick<User, 'id' | 'name' | 'avatar' | 'rating' | 'level'>) => [u.id, u])
    );

    const membersWithInfo = members.map((m: ClubMember) => ({
      ...m,
      user: userMap.get(m.userId),
    }));

    res.json({
      ...club,
      members: membersWithInfo,
    });
  } catch (error) {
    console.error('Failed to get club:', error);
    res.status(500).json({ error: 'Failed to get club' });
  }
});

// 更新俱乐部
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, avatar, location, userId } = req.body;

    // 检查是否是管理员
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId } },
    });

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update club' });
    }

    const club = await prisma.club.update({
      where: { id },
      data: { name, description, avatar, location },
    });

    res.json(club);
  } catch (error) {
    console.error('Failed to update club:', error);
    res.status(500).json({ error: 'Failed to update club' });
  }
});

// 加入俱乐部
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // 检查是否已经是成员
    const existing = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId } },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // 加入俱乐部
    const member = await prisma.clubMember.create({
      data: {
        clubId: id,
        userId,
        role: 'member',
      },
    });

    // 更新成员数
    await prisma.club.update({
      where: { id },
      data: { memberCount: { increment: 1 } },
    });

    res.status(201).json(member);
  } catch (error) {
    console.error('Failed to join club:', error);
    res.status(500).json({ error: 'Failed to join club' });
  }
});

// 退出俱乐部
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId } },
    });

    if (!membership) {
      return res.status(400).json({ error: 'Not a member' });
    }

    // 管理员不能退出（需要先转让）
    if (membership.role === 'admin') {
      const otherAdmins = await prisma.clubMember.count({
        where: { clubId: id, role: 'admin', userId: { not: userId } },
      });

      if (otherAdmins === 0) {
        return res.status(400).json({
          error: 'Cannot leave as the only admin. Transfer admin role first.',
        });
      }
    }

    await prisma.clubMember.delete({
      where: { clubId_userId: { clubId: id, userId } },
    });

    await prisma.club.update({
      where: { id },
      data: { memberCount: { decrement: 1 } },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to leave club:', error);
    res.status(500).json({ error: 'Failed to leave club' });
  }
});

// 获取用户加入的俱乐部
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const memberships = await prisma.clubMember.findMany({
      where: { userId },
    });

    const clubIds = memberships.map((m: ClubMember) => m.clubId);
    const clubs = await prisma.club.findMany({
      where: { id: { in: clubIds } },
    });

    const clubMap = new Map(clubs.map((c: Club) => [c.id, c]));

    const result = memberships.map((m: ClubMember) => {
      const club = clubMap.get(m.clubId);
      return {
        ...club,
        role: m.role,
        joinedAt: m.joinedAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to get user clubs:', error);
    res.status(500).json({ error: 'Failed to get user clubs' });
  }
});

// 提升/降级成员
router.post('/:id/members/:memberId/role', async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const { userId, newRole } = req.body;

    // 检查操作者是否是管理员
    const adminCheck = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId } },
    });

    if (!adminCheck || adminCheck.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change roles' });
    }

    const updated = await prisma.clubMember.update({
      where: { clubId_userId: { clubId: id, userId: memberId } },
      data: { role: newRole },
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to change member role:', error);
    res.status(500).json({ error: 'Failed to change member role' });
  }
});

// 获取俱乐部排行榜
router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 获取所有成员
    const members = await prisma.clubMember.findMany({
      where: { clubId: id },
    });

    const memberIds = members.map((m: ClubMember) => m.userId);

    // 获取成员详情和评分
    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        name: true,
        avatar: true,
        rating: true,
        level: true,
      },
    });

    const leaderboard = users.map(
      (user: Pick<User, 'id' | 'name' | 'avatar' | 'rating' | 'level'>, index: number) => ({
        rank: index + 1,
        ...user,
      })
    );

    res.json(leaderboard);
  } catch (error) {
    console.error('Failed to get club leaderboard:', error);
    res.status(500).json({ error: 'Failed to get club leaderboard' });
  }
});

export default router;
