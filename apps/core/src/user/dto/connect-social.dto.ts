import { IsString } from 'class-validator';

export class ConnectSocialDto {
  @IsString()
  username: string;
}
