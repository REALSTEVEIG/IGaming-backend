import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('top-players')
  @ApiOperation({ summary: 'Get top 10 players by wins' })
  @ApiResponse({ status: 200, description: 'Top players retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of players to return (default: 10)' })
  async getTopPlayers(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.leaderboardService.getTopPlayers(limitNumber);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get sessions grouped by date' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  async getSessionsByDate(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.leaderboardService.getSessionsByDate(startDate, endDate);
  }

  @Get('winners')
  @ApiOperation({ summary: 'Get winners by time period' })
  @ApiResponse({ status: 200, description: 'Winners retrieved successfully' })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ['day', 'week', 'month'], 
    description: 'Time period for filtering winners' 
  })
  async getWinnersByPeriod(@Query('period') period: 'day' | 'week' | 'month' = 'day') {
    return this.leaderboardService.getPlayersByPeriod(period);
  }

  @Get('user-stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully' })
  async getUserStats(@Request() req) {
    return this.leaderboardService.getUserStats(req.user.id);
  }
}