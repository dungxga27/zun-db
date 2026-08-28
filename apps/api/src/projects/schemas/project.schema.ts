import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, unique: true, trim: true }) name: string;
  @Prop({ required: true, unique: true }) databaseName: string;
  @Prop({ required: true, unique: true }) username: string;
  @Prop({ trim: true, maxlength: 500 }) description?: string;
  @Prop({ required: true }) createdBy: string;
}
export type ProjectDocument = HydratedDocument<Project>;
export const ProjectSchema = SchemaFactory.createForClass(Project);
