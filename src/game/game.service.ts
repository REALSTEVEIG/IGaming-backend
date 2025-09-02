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
      // Check if user already has an active session
      const existingParticipant = await tx.sessionParticipant.findFirst({
        where: {
          userId,
          session: {
            isActive: true,
            isCompleted: false,
          },
        },
      });

      if (existingParticipant) {
        throw new BadRequestException('User already has an active session');
      }

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
        const newSession = await tx.gameSession.create({
          data: {
            endsAt: new Date(Date.now() + (parseInt(process.env.SESSION_DURATION) || 20) * 1000),
            startedById: userId,
            isActive: true,
            isCompleted: false,
          },
        });
        return tx.sessionParticipant.create({
          data: {
            userId,
            sessionId: newSession.id,
            isInQueue: false,
          },
        });
      }

      if (new Date() > currentSession.endsAt) {
        throw new BadRequestException('Session has ended');
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
    // First check if session has any active participants
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { isInQueue: false }
        }
      }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // If no active participants, delete the session instead of completing it
    if (session.participants.length === 0) {
      await this.prisma.gameSession.delete({
        where: { id: sessionId }
      });
      return null;
    }

    const winningNumber = Math.floor(Math.random() * 9) + 1;

    const updatedSession = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        winningNumber,
        isActive: false,
        isCompleted: true,
      },
    });

    await this.prisma.sessionParticipant.updateMany({
      where: {
        sessionId,
        chosenNumber: winningNumber,
        isInQueue: false,
      },
      data: {
        isWinner: true,
      },
    });

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
    };
  }
}