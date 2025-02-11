import { IsUUID, IsString, IsNotEmpty, IsOptional } from 'class-validator';
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

<<<<<<< HEAD
  // @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  // @IsString()
  // signature: string;
=======
  @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  @IsString()
  @IsOptional()
  signature: string;
>>>>>>> a117b3ae48d7f49e9157c9d44eeaa3395a110db8
}
