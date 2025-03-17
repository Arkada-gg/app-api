import {
  Controller,
  Get,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('ACS Reports')
@Controller('acs')
export class AcsController {
  private readonly REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');

  @Get('reports')
  @ApiOperation({ summary: 'Получить список всех CSV отчетов' })
  @ApiResponse({
    status: 200,
    description: 'Список CSV-файлов.',
    type: [String],
  })
  getAllReports(): string[] {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      return [];
    }

    return fs
      .readdirSync(this.REPORTS_DIR)
      .filter((file) => file.endsWith('.csv'));
  }

  @Get('reports/:fileName')
  @ApiOperation({ summary: 'Скачать CSV отчет' })
  @ApiParam({
    name: 'fileName',
    description: 'Имя файла отчета',
    example: '2025-02-19-acs.csv',
  })
  @ApiResponse({
    status: 200,
    description: 'Файл успешно загружен',
  })
  @ApiResponse({
    status: 400,
    description: 'Файл не найден',
  })
  getReport(@Param('fileName') fileName: string, @Res() res: Response): void {
    const filePath = path.join(this.REPORTS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Файл не найден');
    }

    res.sendFile(filePath);
  }
}
