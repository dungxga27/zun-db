import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';

@Injectable()
export class MongoAdminService implements OnApplicationShutdown {
  private client?: MongoClient;
  constructor(private readonly config: ConfigService) {}

  async getClient() {
    if (!this.client) {
      this.client = new MongoClient(this.config.getOrThrow('MONGO_ADMIN_URI'));
      await this.client.connect();
    }
    return this.client;
  }
  async db(name: string) { return (await this.getClient()).db(name); }
  async admin() { return (await this.getClient()).db('admin').admin(); }
  async ping() { return (await this.admin()).ping(); }
  async onApplicationShutdown() { await this.client?.close(); }

  projectUri(username: string, password: string, database: string) {
    const source = new URL(this.config.getOrThrow('MONGO_ADMIN_URI'));
    source.username = username;
    source.password = password;
    source.hostname = this.config.get<string>('PROJECT_MONGODB_HOST') || source.hostname;
    source.port = this.config.get<string>('PROJECT_MONGODB_PORT') || source.port || '27017';
    source.pathname = `/${database}`;
    source.searchParams.set('authSource', database);
    return source.toString();
  }
}
