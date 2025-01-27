import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IUser } from '../../shared/interfaces';

export class UpdateUserResponse {
  @ApiProperty({
    example: 'Пользователь успешно обновлен',
    description: 'Сообщение об успехе',
  })
  message?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Обновленные данные пользователя',
  })
  user?: IUser;

  @ApiPropertyOptional({
    example: true,
    description: 'Флаг успеха',
  })
  success?: boolean;
}
