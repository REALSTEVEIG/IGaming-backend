import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getTopPlayers(limit: number = 10) {
    const players = await this.prisma.user.findMany({
      include: {
        sessions: true, // Get all sessions (wins and losses)
      },
    });

    // Group players by username (case-insensitive) to handle duplicates
    const playerGroups = new Map<string, {
      id: string;
      username: string;
      wins: number;
      totalGames: number;
    }>();

    players.forEach(player => {
      const normalizedUsername = player.username.toLowerCase();
      const wins = player.sessions.filter(session => session.isWinner).length;
      const totalGames = player.sessions.length;

      if (playerGroups.has(normalizedUsername)) {
        // Merge stats if duplicate username found
        const existing = playerGroups.get(normalizedUsername);
        existing.wins += wins;
        existing.totalGames += totalGames;
        // Keep the original casing of the first occurrence
      } else {
        playerGroups.set(normalizedUsername, {
          id: player.id,
          username: player.username,
          wins,
          totalGames,
        });
      }
    });

    return Array.from(playerGroups.values())
      .sort((a, b) => b.wins - a.wins)
      .slice(0, limit);
  }

  async getSessionsByDate(startDate?: string, endDate?: string) {
    const whereClause: any = {
      isCompleted: true,
    };

    if (startDate) {
      whereClause.startedAt = {
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      whereClause.startedAt = {
        ...whereClause.startedAt,
        lte: new Date(endDate),
      };
    }

    return this.prisma.gameSession.findMany({
      where: whereClause,
      include: {
        participants: {
          where: {
            isInQueue: false, // Only include active participants, not queued ones
          },
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc', // Order by date
      },
    });
  }

  async getPlayersByPeriod(period: 'day' | 'week' | 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const sessions = await this.prisma.gameSession.findMany({
      where: {
        startedAt: {
          gte: startDate,
        },
        isCompleted: true,
      },
      include: {
        participants: {
          where: {
            isWinner: true,
          },
          include: {
            user: true,
          },
        },
      },
    });

    // Use a Map to track by normalized username to prevent case-sensitive duplicates
    const winnerCounts = new Map<string, { username: string; wins: number }>();

    sessions.forEach(session => {
      session.participants.forEach(participant => {
        const username = participant.user.username;
        const normalizedUsername = username.toLowerCase();
        
        if (winnerCounts.has(normalizedUsername)) {
          winnerCounts.get(normalizedUsername).wins++;
        } else {
          winnerCounts.set(normalizedUsername, {
            username: username, // Keep original casing
            wins: 1,
          });
        }
      });
    });

    // Convert to array and sort by wins descending
    const sortedWinners = Array.from(winnerCounts.values())
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    return sortedWinners;
  }
  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const totalGames = user.sessions.length;
    const wins = user.sessions.filter(session => session.isWinner).length;
    const losses = totalGames - wins;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    return {
      totalWins: wins,
      totalLosses: losses,
      totalGames,
      winRate: `${winRate}%`,
    };
  }
}