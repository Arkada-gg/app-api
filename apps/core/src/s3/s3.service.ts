import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Multer } from 'multer';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.S3_BUCKET_NAME || 'my-arkada-bucket';

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async uploadFile(file: Multer.File): Promise<string> {
    try {
      const fileName = `${Date.now()}-${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const publicUrl = `https://${this.bucket}.s3.amazonaws.com/${fileName}`;
      return publicUrl;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file: ${error.message}`
      );
    }
  }
}
