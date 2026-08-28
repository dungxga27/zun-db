import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Backup {
  @Prop({ required: true, index: true, type: Types.ObjectId }) projectId: Types.ObjectId;
  @Prop({ required: true, unique: true, index: true }) backupId: string;
  @Prop({ required: true }) databaseName: string;
  @Prop({ required: true }) path: string;
  @Prop({ required: true, enum: ['running', 'completed', 'failed'], default: 'running' }) status: 'running' | 'completed' | 'failed';
  @Prop() error?: string;
}

export type BackupDocument = HydratedDocument<Backup>;
export const BackupSchema = SchemaFactory.createForClass(Backup);
