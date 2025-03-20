import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  address?: string;
}
