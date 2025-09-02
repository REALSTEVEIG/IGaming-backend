import { IsNumber, IsOptional, Min, Max } from 'class-validator';
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