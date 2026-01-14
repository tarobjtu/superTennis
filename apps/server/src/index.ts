import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import matchRoutes from './routes/matches.js';
import userRoutes from './routes/users.js';
import friendRoutes from './routes/friends.js';
import videoRoutes from './routes/videos.js';
import notificationRoutes from './routes/notifications.js';
import inviteRoutes from './routes/invites.js';
import leaderboardRoutes from './routes/leaderboard.js';
import trainingRoutes from './routes/training.js';
import clubRoutes from './routes/clubs.js';
import analyticsRoutes from './routes/analytics.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/matches', matchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
async function main() {
  try {
    await prisma.$connect();
    console.log('📦 Database connected');

    // 绑定到 0.0.0.0 以便局域网内的设备（如手机）可以访问
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📱 Mobile app can connect via local network IP`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
