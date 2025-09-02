import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Username for registration',
    example: 'player123',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Username for login',
    example: 'player123',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}