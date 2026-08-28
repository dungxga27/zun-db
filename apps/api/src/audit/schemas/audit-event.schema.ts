import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, versionKey: false })
export class AuditEvent {
  @Prop({ required: true, index: true }) action: string;
  @Prop() actorId?: string;
  @Prop() target?: string;
  @Prop({ type: Object }) details?: Record<string, unknown>;
}
export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
