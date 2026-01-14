/**
 * 高级数据分析路由
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 获取对手分析报告
router.get('/opponent/:userId/:opponentName', async (req: Request, res: Response) => {
  try {
    const { userId, opponentName } = req.params;

    let report = await prisma.opponentReport.findUnique({
      where: { userId_opponentName: { userId, opponentName } },
    });

    if (!report) {
      // 创建新报告
      report = await prisma.opponentReport.create({
        data: {
          userId,
          opponentName,
        },
      });
    }

    // 获取对战历史
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { player1Id: userId, player2Name: opponentName },
          { player2Id: userId, player1Name: opponentName },
        ],
        isFinished: true,
      },
      orderBy: { finishedAt: 'desc' },
    });

    // 计算统计
    let wins = 0;
    let losses = 0;
    const matchDetails: any[] = [];

    for (const match of matches) {
      const isPlayer1 = match.player1Id === userId;
      const won = isPlayer1 ? match.winner === 1 : match.winner === 2;

      if (won) wins++;
      else losses++;

      matchDetails.push({
        id: match.id,
        date: match.finishedAt,
        won,
        player1Sets: JSON.parse(match.player1Sets),
        player2Sets: JSON.parse(match.player2Sets),
        duration: match.duration,
      });
    }

    res.json({
      ...report,
      totalMatches: matches.length,
      wins,
      losses,
      winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
      matchHistory: matchDetails,
    });
  } catch (error) {
    console.error('Failed to get opponent report:', error);
    res.status(500).json({ error: 'Failed to get opponent report' });
  }
});

// 更新对手分析
router.put('/opponent/:userId/:opponentName', async (req: Request, res: Response) => {
  try {
    const { userId, opponentName } = req.params;
    const { serveAnalysis, returnAnalysis, rallyAnalysis, weaknesses, strengths } = req.body;

    const report = await prisma.opponentReport.upsert({
      where: { userId_opponentName: { userId, opponentName } },
      update: {
        serveAnalysis,
        returnAnalysis,
        rallyAnalysis,
        weaknesses,
        strengths,
      },
      create: {
        userId,
        opponentName,
        serveAnalysis,
        returnAnalysis,
        rallyAnalysis,
        weaknesses,
        strengths,
      },
    });

    res.json(report);
  } catch (error) {
    console.error('Failed to update opponent report:', error);
    res.status(500).json({ error: 'Failed to update opponent report' });
  }
});

// 获取用户所有对手列表
router.get('/opponents/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 从比赛记录中获取所有对手
    const matchesAsPlayer1 = await prisma.match.findMany({
      where: { player1Id: userId, isFinished: true },
      select: { player2Name: true, player2Id: true, winner: true },
    });

    const matchesAsPlayer2 = await prisma.match.findMany({
      where: { player2Id: userId, isFinished: true },
      select: { player1Name: true, player1Id: true, winner: true },
    });

    // 汇总对手统计
    const opponentStats = new Map<
      string,
      { name: string; id?: string; wins: number; losses: number }
    >();

    for (const match of matchesAsPlayer1) {
      const name = match.player2Name;
      const current = opponentStats.get(name) || { name, id: match.player2Id || undefined, wins: 0, losses: 0 };
      if (match.winner === 1) current.wins++;
      else current.losses++;
      opponentStats.set(name, current);
    }

    for (const match of matchesAsPlayer2) {
      const name = match.player1Name;
      const current = opponentStats.get(name) || { name, id: match.player1Id || undefined, wins: 0, losses: 0 };
      if (match.winner === 2) current.wins++;
      else current.losses++;
      opponentStats.set(name, current);
    }

    // 转换为数组并排序
    const opponents = Array.from(opponentStats.values())
      .map((o) => ({
        ...o,
        totalMatches: o.wins + o.losses,
        winRate: Math.round((o.wins / (o.wins + o.losses)) * 100),
      }))
      .sort((a, b) => b.totalMatches - a.totalMatches);

    res.json(opponents);
  } catch (error) {
    console.error('Failed to get opponents:', error);
    res.status(500).json({ error: 'Failed to get opponents' });
  }
});

// 获取整体表现分析
router.get('/performance/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { period = 'month' } = req.query;

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0);
    }

    // 获取时间段内的比赛
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        isFinished: true,
        finishedAt: { gte: startDate },
      },
      orderBy: { finishedAt: 'asc' },
    });

    let wins = 0;
    let losses = 0;
    let totalDuration = 0;
    let totalSetsWon = 0;
    let totalSetsLost = 0;
    let totalGamesWon = 0;
    let totalGamesLost = 0;

    const dailyStats: { [date: string]: { wins: number; losses: number } } = {};

    for (const match of matches) {
      const isPlayer1 = match.player1Id === userId;
      const won = isPlayer1 ? match.winner === 1 : match.winner === 2;

      if (won) wins++;
      else losses++;

      totalDuration += match.duration || 0;

      const p1Sets = JSON.parse(match.player1Sets);
      const p2Sets = JSON.parse(match.player2Sets);

      if (isPlayer1) {
        for (let i = 0; i < p1Sets.length; i++) {
          totalGamesWon += p1Sets[i];
          totalGamesLost += p2Sets[i];
          if (p1Sets[i] > p2Sets[i]) totalSetsWon++;
          else if (p2Sets[i] > p1Sets[i]) totalSetsLost++;
        }
      } else {
        for (let i = 0; i < p1Sets.length; i++) {
          totalGamesWon += p2Sets[i];
          totalGamesLost += p1Sets[i];
          if (p2Sets[i] > p1Sets[i]) totalSetsWon++;
          else if (p1Sets[i] > p2Sets[i]) totalSetsLost++;
        }
      }

      // 按日统计
      const date = match.finishedAt?.toISOString().split('T')[0] || '';
      if (!dailyStats[date]) {
        dailyStats[date] = { wins: 0, losses: 0 };
      }
      if (won) dailyStats[date].wins++;
      else dailyStats[date].losses++;
    }

    // 获取评分变化
    const ratingHistory = await prisma.ratingHistory.findMany({
      where: { userId, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      summary: {
        totalMatches: matches.length,
        wins,
        losses,
        winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
        totalDuration,
        avgMatchDuration: matches.length > 0 ? Math.round(totalDuration / matches.length) : 0,
      },
      sets: {
        won: totalSetsWon,
        lost: totalSetsLost,
        winRate:
          totalSetsWon + totalSetsLost > 0
            ? Math.round((totalSetsWon / (totalSetsWon + totalSetsLost)) * 100)
            : 0,
      },
      games: {
        won: totalGamesWon,
        lost: totalGamesLost,
        winRate:
          totalGamesWon + totalGamesLost > 0
            ? Math.round((totalGamesWon / (totalGamesWon + totalGamesLost)) * 100)
            : 0,
      },
      dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        ...stats,
      })),
      ratingHistory,
    });
  } catch (error) {
    console.error('Failed to get performance:', error);
    res.status(500).json({ error: 'Failed to get performance' });
  }
});

// 获取技术分析
router.get('/technique/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // 获取训练数据
    const trainingSessions = await prisma.trainingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 按类型分组
    const byType: { [type: string]: any } = {};

    for (const session of trainingSessions) {
      if (!byType[session.type]) {
        byType[session.type] = {
          sessions: 0,
          totalDuration: 0,
          totalShots: 0,
          successfulShots: 0,
          speeds: [] as number[],
        };
      }

      byType[session.type].sessions++;
      byType[session.type].totalDuration += session.duration;
      byType[session.type].totalShots += session.totalShots;
      byType[session.type].successfulShots += session.successfulShots;
      if (session.avgSpeed) byType[session.type].speeds.push(session.avgSpeed);
    }

    // 计算统计
    const techniques = Object.entries(byType).map(([type, data]) => ({
      type,
      sessions: data.sessions,
      totalDuration: data.totalDuration,
      totalShots: data.totalShots,
      successRate: data.totalShots > 0
        ? Math.round((data.successfulShots / data.totalShots) * 100)
        : 0,
      avgSpeed: data.speeds.length > 0
        ? Math.round(data.speeds.reduce((a: number, b: number) => a + b, 0) / data.speeds.length)
        : null,
    }));

    // 识别优势和弱点
    const sortedBySuccess = [...techniques].sort((a, b) => b.successRate - a.successRate);
    const strengths = sortedBySuccess.slice(0, 2).map((t) => t.type);
    const weaknesses = sortedBySuccess.slice(-2).map((t) => t.type);

    res.json({
      techniques,
      strengths,
      weaknesses,
      recommendations: generateRecommendations(techniques),
    });
  } catch (error) {
    console.error('Failed to get technique analysis:', error);
    res.status(500).json({ error: 'Failed to get technique analysis' });
  }
});

// 生成训练建议
function generateRecommendations(techniques: any[]): string[] {
  const recommendations: string[] = [];

  for (const tech of techniques) {
    if (tech.successRate < 60) {
      recommendations.push(`建议加强 ${getTypeName(tech.type)} 练习，目前成功率较低`);
    }
    if (tech.sessions < 5) {
      recommendations.push(`${getTypeName(tech.type)} 练习次数较少，建议增加训练频率`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('各项技术表现均衡，继续保持！');
  }

  return recommendations.slice(0, 5);
}

function getTypeName(type: string): string {
  const names: { [key: string]: string } = {
    serve: '发球',
    forehand: '正手',
    backhand: '反手',
    volley: '网前',
    rally: '底线',
  };
  return names[type] || type;
}

export default router;
