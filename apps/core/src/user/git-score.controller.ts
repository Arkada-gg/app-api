import {
    Controller,
    Logger,
    Post,
    UnauthorizedException,
    BadRequestException,
    InternalServerErrorException,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { SignatureAuthGuard } from '../auth/guard/signature-auth.guard';
import { GetUserAddress } from '../auth/user.decorator';

@Controller('git-score')
export class GitScoreController {
    private readonly logger = new Logger(GitScoreController.name);

    constructor(private readonly userService: UserService) { }

    @UseGuards(SignatureAuthGuard)
    @Post('update')
    @ApiOperation({ summary: 'Обновить Git Score для текущего пользователя' })
    @ApiResponse({ status: 200, description: 'Обновление завершено' })
    @ApiResponse({ status: 401, description: 'Не аутентифицирован' })
    @ApiResponse({ status: 400, description: 'Запрос возможен только раз в день' })
    @ApiResponse({ status: 500, description: 'Ошибка обновления' })
    async updateGitScore(@GetUserAddress() userAddress: string) {
        this.logger.log('Запуск обновления Git Score для пользователя...');

        const user = await this.userService.findByAddress(userAddress);

        if (!user) {
            throw new UnauthorizedException('Not authenticated');
        }

        const now = new Date();
        if (user.last_git_score_update) {
            const lastUpdate = new Date(user.last_git_score_update);
            const oneDayInMs = 24 * 60 * 60 * 1000;
            if (now.getTime() - lastUpdate.getTime() < oneDayInMs) {
                throw new BadRequestException('Обновление возможно только раз в день');
            }
        }

        try {
            const totalPoints = await this.userService.calculateAndSetGitScore(userAddress);

            await this.userService.updateLastGitScoreUpdate(userAddress, now);

            this.logger.log(
                `✅ User ${userAddress} - totalPoints: ${totalPoints}`
            );

            return {
                message: 'Git Score обновлен',
                totalPoints,
            };
        } catch (error) {
            this.logger.error(`Ошибка в обновлении GitScore: ${(error as Error).message}`);
            throw new InternalServerErrorException(
                `Ошибка обновления: ${(error as Error).message}`
            );
        }
    }
}