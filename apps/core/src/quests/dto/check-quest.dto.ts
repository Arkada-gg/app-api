import { IsUUID, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckQuestDto {
  @ApiProperty({ description: 'ID задания', example: 'uuid-of-quest' })
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Адрес пользователя',
    example: '0xYourWalletAddress',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  // @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  // @IsString()
  // signature: string;
}
