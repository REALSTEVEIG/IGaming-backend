import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { GameService } from './game.service';
import { JoinSessionDto, ChooseNumberDto } from './dto/game.dto';
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
}