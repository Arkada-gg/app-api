import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    example: '0x5DD75C896af6231F665F7CDB62e060FA816b3c08',
    description: 'Адрес пользователя',
  })
  @IsString({ message: 'Аddress should be a string' })
  address: string;

  @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  @IsString()
  signature: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Имя пользователя' })
  @IsOptional()
  @IsString({ message: 'Name should be a string' })
  name?: string;

  @ApiPropertyOptional({
    example: 'johndoe@example.com',
    description: 'Email пользователя',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email is incorrect' })
  email?: string;
}
