import { Controller, Post, Get, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { GameService } from './game.service';
import { JoinSessionDto, ChooseNumberDto, CreatePrivateSessionDto } from './dto/game.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('game')
@Controller('game')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GameController {
  constructor(private gameService: GameService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current session status' })
  @ApiResponse({ status: 200, description: 'Session status retrieved' })
  async getSessionStatus() {
    return this.gameService.getSessionStatus();
  }

  @Get('my-session')
  @ApiOperation({ summary: 'Get current user session status' })
  @ApiResponse({ status: 200, description: 'User session status retrieved' })
  async getMySession(@Request() req) {
    return this.gameService.getUserSession(req.user.id);
  }

  @Get('latest-result')
  @ApiOperation({ summary: 'Get latest completed session result' })
  @ApiResponse({ status: 200, description: 'Latest session result retrieved' })
  async getLatestResult(@Request() req) {
    return this.gameService.getLatestCompletedSession(req.user.id);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join current session' })
  @ApiResponse({ status: 201, description: 'Joined session successfully' })
  @ApiResponse({ status: 400, description: 'Session has ended or other error' })
  async joinSession(@Request() req, @Body() joinSessionDto: JoinSessionDto) {
    return this.gameService.joinSession(req.user.id, joinSessionDto);
  }

  @Delete('leave')
  @ApiOperation({ summary: 'Leave current session' })
  @ApiResponse({ status: 200, description: 'Left session successfully' })
  @ApiResponse({ status: 400, description: 'No active session found' })
  async leaveSession(@Request() req) {
    return this.gameService.leaveSession(req.user.id);
  }

  @Post('choose-number')
  @ApiOperation({ summary: 'Choose a number for the current session' })
  @ApiResponse({ status: 200, description: 'Number chosen successfully' })
  @ApiResponse({ status: 400, description: 'Invalid number or no active session' })
  async chooseNumber(@Request() req, @Body() chooseNumberDto: ChooseNumberDto) {
    return this.gameService.chooseNumber(req.user.id, chooseNumberDto);
  }

  @Post('create-private')
  @ApiOperation({ summary: 'Create a private session and invite users' })
  @ApiResponse({ status: 201, description: 'Private session created and invitation sent' })
  async createPrivateSession(@Request() req, @Body() createPrivateDto: CreatePrivateSessionDto) {
    return this.gameService.createPrivateSession(req.user.id, createPrivateDto);
  }

  @Post('start/:sessionId')
  @ApiOperation({ summary: 'start game session' })
  @ApiResponse({ status: 200, description: 'Private session started' })
  async startSession(@Request() req, @Param('sessionId') sessionId: string) {
    return this.gameService.startPrivateSession(req.user.id, sessionId);
  }

  @Get('invitation/:invitationId/accept')
  @ApiOperation({ summary: 'Accept invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully' })
  async acceptInvitation(@Request() req, @Param('invitationId') invitationId: string) {
    return this.gameService.acceptInvitation(req.user.id, invitationId);
  }

  @Post('invitation/:invitationId/reject')
  @ApiOperation({ summary: 'Reject invitation' })
  @ApiResponse({ status: 200, description: 'Invitation rejected successfully' })
  async rejectInvitation(@Request() req, @Param('invitationId') invitationId: string) {
    return this.gameService.rejectInvitation(req.user.id, invitationId);
  }
}