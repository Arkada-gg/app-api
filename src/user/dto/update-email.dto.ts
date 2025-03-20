import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty({ description: 'Адрес кошелька пользователя', example: '0x...' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  @IsString()
  signature: string;

  @ApiProperty({
    description: 'Новый email для пользователя',
    example: 'email@email.email',
  })
  @IsEmail({}, { message: 'Неверный формат email' })
  @IsNotEmpty({ message: 'Email не может быть пустым' })
  email: string;
}
