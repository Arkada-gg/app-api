import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUsernameDto {
  @ApiProperty({ description: 'Адрес кошелька пользователя', example: '0x...' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  @IsString()
  signature: string;

  @ApiProperty({
    description: 'Новый username для пользователя',
    example: 'newUsername',
  })
  @IsString()
  username: string;
}
