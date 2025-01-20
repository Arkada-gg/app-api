import { BadRequestException, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { SignupDto } from './dto/signup.dto';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async signup(signupDto: SignupDto) {
    const { address, signature } = signupDto;

    const message = process.env.VERIFICATION_MESSAGE || '';

    const messageHash = ethers.hashMessage(message);
    const recovered = ethers.recoverAddress(messageHash, signature);

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      throw new BadRequestException('Invalid signature');
    }

    const user = await this.authRepository.createOrUpdateUser(address);

    return user;
  }
}
