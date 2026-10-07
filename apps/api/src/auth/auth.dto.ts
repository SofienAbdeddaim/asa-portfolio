import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, example: 'admin@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class ChallengeDto {
  @ApiProperty({ type: String, description: 'Short-lived token returned by /auth/login' })
  @IsString()
  @MaxLength(2048)
  challenge!: string;
}

export class EnableTotpDto extends ChallengeDto {
  @ApiProperty({ type: String, example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class VerifyMfaDto extends ChallengeDto {
  @ApiProperty({ type: String, required: false, example: '123456' })
  @ValidateIf((dto: VerifyMfaDto) => dto.recoveryCode === undefined)
  @IsString()
  @Length(6, 6)
  code?: string;

  @ApiProperty({ type: String, required: false, example: 'a1b2c-3d4e5' })
  @ValidateIf((dto: VerifyMfaDto) => dto.code === undefined)
  @IsString()
  @Length(11, 11)
  recoveryCode?: string;
}
