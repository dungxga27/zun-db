export type AdminRole = "admin" | "viewer";

export interface AdminUser {
  _id: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Project {
  _id: string;
  name: string;
  databaseName: string;
  username: string;
  description?: string;
  createdAt: string;
}

export interface ProvisionedProject {
  project: Project;
  uri: string;
}
