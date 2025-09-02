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
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private gameService: GameService,
    private prisma: PrismaService,
  ) {
    this.startSessionTimer();
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('requestSessionStatus')
  async handleSessionStatus(@ConnectedSocket() client: Socket) {
    const status = await this.gameService.getSessionStatus();
    client.emit('sessionStatus', status);
  }

  private startSessionTimer() {
    setInterval(async () => {
      const status = await this.gameService.getSessionStatus();
      
      if (status.hasActiveSession) {
        // Always broadcast status first
        this.broadcastToAll('sessionStatus', status);
        
        // Then complete session if time is up
        if (status.timeLeft <= 0) {
          const currentSession = await this.gameService.getCurrentSession();
          if (currentSession) {
            const result = await this.gameService.completeSession(currentSession.id);
            
            // If result is null, session was deleted due to no participants
            if (result === null) {
              // Just broadcast that no session is active now
              const newStatus = await this.gameService.getSessionStatus();
              this.broadcastToAll('sessionStatus', newStatus);
              return;
            }
            
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

            if (completedSession) {
              const winners = completedSession.participants.filter(p => p.isWinner);
              
              const gameResult = {
                winningNumber: result.winningNumber,
                winners: winners.map(w => ({
                  username: w.user.username,
                  chosenNumber: w.chosenNumber,
                })),
                totalPlayers: completedSession.participants.filter(p => !p.isInQueue).length,
                totalWinners: winners.length,
              };

              this.broadcastToAll('gameResult', gameResult);

              // Wait 10 seconds before allowing new sessions (don't auto-create)
              setTimeout(async () => {
                const newStatus = await this.gameService.getSessionStatus();
                this.broadcastToAll('sessionStatus', newStatus);
              }, 10000);
            }
          }
        }
      }
    }, 1000);
  }

  private broadcastToAll(event: string, data: any) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }
}