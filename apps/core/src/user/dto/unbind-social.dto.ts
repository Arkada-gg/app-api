import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UnbindSocialDto {
  @ApiProperty({ example: '0x123...', description: 'User Address' })
  @IsString()
  address: string;

  @ApiProperty({ example: '0x7520b00a...', description: 'Signed message' })
  @IsString()
  signature: string;
}
