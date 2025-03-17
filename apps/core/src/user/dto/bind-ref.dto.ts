import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BindRefDto {
  @ApiProperty({ example: '0x123...', description: 'User Address' })
  @IsString()
  address: string;

  @ApiProperty({ example: '0x7520b00a...', description: 'Signed message' })
  @IsString()
  signature: string;

  @ApiProperty({
    example: '09HJKD',
    description: 'Реферальный код',
  })
  @IsString()
  refCode: string;
}
