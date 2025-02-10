import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class SignupDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/i, {
    message: 'Address must be a valid Ethereum address (0x...)',
  })
  address: string;

  @IsString()
  signature: string;

  @ApiPropertyOptional({ example: '9fFR' })
  @IsString()
  @IsOptional()
  refCode?: string;
}
