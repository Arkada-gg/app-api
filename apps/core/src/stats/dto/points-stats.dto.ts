import { ApiProperty } from '@nestjs/swagger';

export class PointsStatsDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_address: string;

  @ApiProperty()
  points: number;

  @ApiProperty()
  point_type: string;

  @ApiProperty()
  created_at: string;

  @ApiProperty({ nullable: true })
  campaign_id: string | null;

  @ApiProperty()
  points_before: number;

  @ApiProperty()
  points_after: number;

  @ApiProperty()
  name: string;
}
