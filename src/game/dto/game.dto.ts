import { IsNumber, IsOptional, Min, Max, IsArray, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinSessionDto {
  @ApiProperty({
    description: 'Optional session ID to join',
    required: false,
  })
  @IsOptional()
  sessionId?: string;
}

export class ChooseNumberDto {
  @ApiProperty({
    description: 'Number to choose (1-9)',
    example: 5,
    minimum: 1,
    maximum: 9,
  })
  @IsNumber()
  @Min(1)
  @Max(9)
  number: number;
}

export class CreatePrivateSessionDto {
  @ApiProperty({
    description: 'Array of username to invite (up to 9)',
    type: [String],
    example: ['user1', 'user2'],
  })
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  invitedUsernames: string[];
}