import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BindSocialDto {
  @ApiProperty({ example: '0x123...', description: 'User Address' })
  @IsString()
  address: string;

  @ApiProperty({ example: '0x7520b00a...', description: 'Signed message' })
  @IsString()
  signature: string;

  @ApiProperty({
    example: 'ACCESS_TOKEN_или_другой_токен_для_API_соцсети',
    description: 'OAuth или Bearer-токен соцсети',
  })
  @IsString()
  token: string;
}
