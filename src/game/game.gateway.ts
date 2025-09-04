import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private timerInterval: NodeJS.Timeout | null = null;
  private isTimerRunning = false;
  private idleTickCount = 0;
  private readonly MAX_IDLE_TICKS = 10; // Stop timer after 10 seconds of no sessions

  constructor(
    private gameService: GameService,
    private prisma: PrismaService,
  ) {
    this.startSessionTimer();
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // Restart timer when clients connect to ensure live updates
    this.ensureTimerRunning();
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('requestSessionStatus')
  async handleSessionStatus(@ConnectedSocket() client: Socket) {
    console.log('WEBSOCKET: Client requested session status, ensuring timer is running...');
    // Restart timer when session status is requested to ensure live updates
    this.ensureTimerRunning();
    
    const status = await this.gameService.getSessionStatus();
    console.log('WEBSOCKET: Sending session status to client:', {
      hasActiveSession: status.hasActiveSession,
      timeLeft: status.timeLeft,
      participantCount: status.participantCount
    });
    client.emit('sessionStatus', status);
  }

  private startSessionTimer() {
    if (this.isTimerRunning) {
      console.log('TIMER: Timer already running, skipping start');
      return;
    }

    console.log('TIMER: Starting session timer...');
    this.isTimerRunning = true;
    
    this.timerInterval = setInterval(async () => {
      try {
        console.log('TIMER: Starting timer tick...');
        const status = await this.gameService.getSessionStatus();
        console.log('TIMER: Got status:', { hasActiveSession: status.hasActiveSession, timeLeft: status.timeLeft, participantCount: status.participantCount });
        
        if (status.hasActiveSession) {
          console.log('TIMER: Active session found...');
          this.idleTickCount = 0; // Reset idle count when session is active
          
          // Complete session FIRST if time is up, BEFORE broadcasting
          if (status.timeLeft <= 0) {
            console.log('TIMER: Time is up! Completing session BEFORE broadcasting...');
            console.log('TIMER: Time is up! Attempting to complete session...');
            const currentSession = status.session; // Use session from status to avoid race condition
            console.log('TIMER: Current session from status:', currentSession?.id);
            
            if (currentSession) {
              // First check participants before completing
              const participantsCheck = await this.prisma.gameSession.findUnique({
                where: { id: currentSession.id },
                include: {
                  participants: {
                    include: { user: true }
                  }
                }
              });
              
              console.log('TIMER: Pre-completion participants check:', {
                totalParticipants: participantsCheck?.participants.length || 0,
                activeParticipants: participantsCheck?.participants.filter(p => !p.isInQueue).length || 0,
                participants: participantsCheck?.participants.map(p => ({
                  username: p.user.username,
                  chosenNumber: p.chosenNumber,
                  isInQueue: p.isInQueue
                })) || []
              });
              
              console.log('TIMER: Calling completeSession...');
              const result = await this.gameService.completeSession(currentSession.id);
              console.log('TIMER: completeSession result:', result);
              
              // If result is null, session was deleted due to no participants
              if (result === null) {
                console.log('TIMER: Session was deleted due to no participants, stopping timer...');
                this.stopSessionTimer();
                const newStatus = await this.gameService.getSessionStatus();
                this.broadcastToAll('sessionStatus', newStatus);
                return;
              }
              
              console.log('TIMER: Getting completed session with participants...');
              // Get completed session with updated data
              const completedSession = await this.prisma.gameSession.findUnique({
                where: { id: currentSession.id },
                include: {
                  participants: {
                    include: {
                      user: true,
                    },
                  },
                },
              });

              console.log('TIMER: Completed session found:', !!completedSession);
              if (completedSession) {
                const allParticipants = completedSession.participants.filter(p => !p.isInQueue);
                const winners = allParticipants.filter(p => p.isWinner);
                console.log('TIMER: Participants after filtering:', allParticipants.length);
                console.log('TIMER: Winners found:', winners.length);
                console.log('TIMER: Winner details:', winners.map(w => ({ username: w.user.username, chosenNumber: w.chosenNumber, winningNumber: result.winningNumber })));
                
                const gameResult = {
                  winningNumber: result.winningNumber,
                  participants: allParticipants.map(p => ({
                    username: p.user.username,
                    chosenNumber: p.chosenNumber,
                    isWinner: p.isWinner,
                  })),
                  winners: winners.map(w => ({
                    username: w.user.username,
                    chosenNumber: w.chosenNumber,
                  })),
                  totalPlayers: allParticipants.length,
                  totalWinners: winners.length,
                };

                console.log('TIMER: Broadcasting gameResult:', JSON.stringify(gameResult));
                this.broadcastToAll('gameResult', gameResult);

                // Stop timer after game completion
                this.stopSessionTimer();

                // Wait 10 seconds before allowing new sessions (don't auto-create)
                setTimeout(async () => {
                  console.log('TIMER: 10 second wait completed, broadcasting final status...');
                  const newStatus = await this.gameService.getSessionStatus();
                  this.broadcastToAll('sessionStatus', newStatus);
                }, 10000);
              } else {
                console.log('TIMER: ERROR - No completed session found after completion!');
                this.stopSessionTimer();
              }
            } else {
              console.log('TIMER: ERROR - No current session found!');
              this.stopSessionTimer();
            }
          } else {
            console.log('TIMER: Time not up yet, broadcasting status...');
            // Only broadcast status if time is NOT up
            this.broadcastToAll('sessionStatus', status);
          }
        } else {
          console.log('TIMER: No active session, broadcasting status...');
          this.broadcastToAll('sessionStatus', status);
          
          // Increment idle count and stop timer if idle too long
          this.idleTickCount++;
          if (this.idleTickCount >= this.MAX_IDLE_TICKS) {
            console.log('TIMER: No sessions for too long, stopping timer to save resources...');
            this.stopSessionTimer();
            this.idleTickCount = 0;
            return;
          }
        }
        console.log('TIMER: Timer tick completed');
      } catch (error) {
        console.error('TIMER: Error in timer:', error);
        this.stopSessionTimer();
      }
    }, 1000);
  }

  private stopSessionTimer() {
    if (this.timerInterval) {
      console.log('TIMER: Stopping session timer...');
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.isTimerRunning = false;
    }
  }

  // Public method to restart timer when new session is created
  public ensureTimerRunning() {
    if (!this.isTimerRunning) {
      console.log('TIMER: Timer not running, restarting for active clients...');
      this.idleTickCount = 0; // Reset idle count
      this.startSessionTimer();
    } else {
      console.log('TIMER: Timer already running, no need to restart');
    }
  }

  private broadcastToAll(event: string, data: any) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }
}