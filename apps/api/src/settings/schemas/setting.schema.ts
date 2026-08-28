import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({ timestamps: true })
export class Setting { @Prop({ required: true, unique: true }) key: string; @Prop({ type: Object, required: true }) value: unknown; }
export const SettingSchema = SchemaFactory.createForClass(Setting);
