import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { _ConfigModule } from '../_config/config.module';
import { UserModule } from '../user/user.module';
import { SignatureAuthGuard } from './guard/signature-auth.guard';
import { ConditionalSignatureAuthGuard } from './guard/conditional-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    SignatureAuthGuard,
    ConditionalSignatureAuthGuard,
  ],
  exports: [AuthService, SignatureAuthGuard, ConditionalSignatureAuthGuard],
  imports: [_ConfigModule, UserModule],
})
export class AuthModule {}
