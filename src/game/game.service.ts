import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JoinSessionDto, ChooseNumberDto } from './dto/game.dto';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async getCurrentSession() {
    return this.prisma.gameSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false,
      },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async createNewSession(startedById?: string) {
    const sessionDuration = parseInt(process.env.SESSION_DURATION) || 20;
    const endsAt = new Date(Date.now() + sessionDuration * 1000);

    return this.prisma.gameSession.create({
      data: {
        endsAt,
        startedById,
        isActive: true,
        isCompleted: false,
      },
    });
  }

  async joinSession(userId: string, joinSessionDto: JoinSessionDto) {
    const maxPlayers = parseInt(process.env.MAX_PLAYERS_PER_SESSION) || 10;
    
    // Use database transaction to prevent race conditions
    return this.prisma.$transaction(async (tx) => {
      // Get or create current session with fresh data inside transaction
      let currentSession = await tx.gameSession.findFirst({
        where: {
          isActive: true,
          isCompleted: false,
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      });
      
      // If no active session exists, create one
      if (!currentSession) {
        console.log('SERVICE: Creating new session...');
        const newSession = await tx.gameSession.create({
          data: {
            endsAt: new Date(Date.now() + (parseInt(process.env.SESSION_DURATION) || 30) * 1000),
            startedById: userId,
            isActive: true,
            isCompleted: false,
          },
        });
        
        const participant = await tx.sessionParticipant.create({
          data: {
            userId,
            sessionId: newSession.id,
            isInQueue: false,
          },
        });
        
        console.log('SERVICE: New session created successfully');
        return participant;
      }

      if (new Date() > currentSession.endsAt) {
        throw new BadRequestException('Session has ended');
      }

      // Check if user is already in THIS specific session
      const existingParticipant = currentSession.participants.find(p => p.userId === userId);
      if (existingParticipant) {
        // User already in this session, just return their participation
        return existingParticipant;
      }

      // Count active participants with fresh data
      const activeParticipants = currentSession.participants.filter(p => !p.isInQueue);
      
      // If session is full (10 users), throw error instead of queueing
      if (activeParticipants.length >= maxPlayers) {
        throw new BadRequestException(`Session is full (${maxPlayers}/${maxPlayers} players). Please wait for the next session.`);
      }

      // Add to active session
      return tx.sessionParticipant.create({
        data: {
          userId,
          sessionId: currentSession.id,
          isInQueue: false,
        },
      });
    });
  }

  async leaveSession(userId: string) {
    const participant = await this.prisma.sessionParticipant.findFirst({
      where: {
        userId,
        session: {
          isActive: true,
          isCompleted: false,
        },
      },
      include: {
        session: {
          include: {
            participants: {
              where: {
                isInQueue: true,
              },
              orderBy: {
                joinedAt: 'asc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!participant) {
      throw new BadRequestException('No active session found');
    }

    await this.prisma.sessionParticipant.delete({
      where: { id: participant.id },
    });

    if (participant.session.participants.length > 0) {
      const nextInQueue = participant.session.participants[0];
      await this.prisma.sessionParticipant.update({
        where: { id: nextInQueue.id },
        data: { isInQueue: false },
      });
    }

    return { message: 'Left session successfully' };
  }

  async chooseNumber(userId: string, chooseNumberDto: ChooseNumberDto) {
    const { number } = chooseNumberDto;
    
    if (number < 1 || number > 9) {
      throw new BadRequestException('Number must be between 1 and 9');
    }

    const participant = await this.prisma.sessionParticipant.findFirst({
      where: {
        userId,
        session: {
          isActive: true,
          isCompleted: false,
        },
      },
    });

    if (!participant) {
      throw new BadRequestException('No active session found');
    }

    if (participant.isInQueue) {
      throw new ForbiddenException('Cannot choose number while in queue');
    }

    return this.prisma.sessionParticipant.update({
      where: { id: participant.id },
      data: { chosenNumber: number },
    });
  }

  async completeSession(sessionId: string) {
    console.log('SERVICE: completeSession called for session:', sessionId);
    
    // First check if session has any active participants
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });

    if (!session) {
      console.log('SERVICE: Session not found:', sessionId);
      throw new Error('Session not found');
    }

    console.log('SERVICE: Session found with participants:', {
      sessionId,
      totalParticipants: session.participants.length,
      participants: session.participants.map(p => ({
        username: p.user.username,
        isInQueue: p.isInQueue,
        chosenNumber: p.chosenNumber
      }))
    });

    // Filter active participants (not in queue)
    const activeParticipants = session.participants.filter(p => !p.isInQueue);
    console.log('SERVICE: Active participants after filtering:', {
      count: activeParticipants.length,
      participants: activeParticipants.map(p => ({
        username: p.user.username,
        chosenNumber: p.chosenNumber
      }))
    });

    // If no active participants, delete the session instead of completing it
    if (activeParticipants.length === 0) {
      console.log('SERVICE: No active participants found, deleting session');
      await this.prisma.gameSession.delete({
        where: { id: sessionId }
      });
      return null;
    }

    const winningNumber = Math.floor(Math.random() * 9) + 1;
    console.log('SERVICE: Generated winning number:', winningNumber);

    const updatedSession = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        winningNumber,
        isActive: false,
        isCompleted: true,
      },
    });

    console.log('SERVICE: Session marked as completed');

    const winnersUpdated = await this.prisma.sessionParticipant.updateMany({
      where: {
        sessionId,
        chosenNumber: winningNumber,
        isInQueue: false,
      },
      data: {
        isWinner: true,
      },
    });

    console.log('SERVICE: Winners updated:', winnersUpdated.count);
    return updatedSession;
  }

  private async addParticipantToSession(userId: string, sessionId: string) {
    return this.prisma.sessionParticipant.create({
      data: {
        userId,
        sessionId,
        isInQueue: false,
      },
    });
  }

  private async addParticipantToQueue(userId: string, sessionId: string) {
    return this.prisma.sessionParticipant.create({
      data: {
        userId,
        sessionId,
        isInQueue: true,
      },
    });
  }

  async getSessionStatus() {
    const currentSession = await this.getCurrentSession();
    
    if (!currentSession) {
      return {
        hasActiveSession: false,
        timeLeft: 0,
        participantCount: 0,
        queueCount: 0,
        session: null,
      };
    }

    const timeLeft = Math.max(0, Math.floor((currentSession.endsAt.getTime() - Date.now()) / 1000));
    const activeParticipants = currentSession.participants.filter(p => !p.isInQueue);
    const queuedParticipants = currentSession.participants.filter(p => p.isInQueue);

    return {
      hasActiveSession: true,
      timeLeft,
      participantCount: activeParticipants.length,
      queueCount: queuedParticipants.length,
      sessionId: currentSession.id,
      session: currentSession, // Return the actual session object
    };
  }

  async getUserSession(userId: string) {
    // Find the user's most recent active participation
    const participant = await this.prisma.sessionParticipant.findFirst({
      where: {
        userId,
        session: {
          isActive: true,
          isCompleted: false,
        },
      },
      include: {
        session: {
          include: {
            participants: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return participant ? {
      session: participant.session,
      timeRemaining: Math.max(0, Math.floor((participant.session.endsAt.getTime() - Date.now()) / 1000)),
      participantData: participant,
    } : null;
  }

  async getLatestCompletedSession(userId: string) {
    // Find the user's most recent completed session
    const participant = await this.prisma.sessionParticipant.findFirst({
      where: {
        userId,
        session: {
          isActive: false,
          isCompleted: true,
          winningNumber: {
            not: null,
          },
        },
      },
      include: {
        session: {
          include: {
            participants: {
              where: {
                isInQueue: false, // Only include active participants
              },
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        session: {
          endsAt: 'desc', // Most recent session first
        },
      },
    });

    if (!participant || !participant.session) {
      return null;
    }

    const session = participant.session;
    const allParticipants = session.participants;
    const winners = allParticipants.filter(p => p.isWinner);

    // Format the response to match the frontend gameResult format
    return {
      winningNumber: session.winningNumber,
      participants: allParticipants.map(p => ({
        username: p.user.username,
        chosenNumber: p.chosenNumber,
        isWinner: p.isWinner,
      })),
      winners: winners.map(p => ({
        username: p.user.username,
        chosenNumber: p.chosenNumber,
      })),
      totalPlayers: allParticipants.length,
      totalWinners: winners.length,
    };
  }
}