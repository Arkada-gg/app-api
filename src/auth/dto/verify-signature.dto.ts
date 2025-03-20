import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifySignatureDto {
  @ApiProperty({ example: '0x1234abcd...' })
  @IsString()
  address: string;

  @ApiProperty({
    example: 'Welcome to Arkada!\n\nAddress: 0x1234...\nNonce: abcd1234...',
    description: 'Message that user signed',
  })
  @IsString()
  message: string;

  @ApiProperty({
    example: '0xabcdef...',
    description: 'Signature from wallet',
  })
  @IsString()
  signature: string;
}
