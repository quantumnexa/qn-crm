import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const usersPath = path.join(dataDir, 'users.json');
const leadsPath = path.join(dataDir, 'leads.json');

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'sales';
  password: string; // plain for demo; replace with hash in production
};

export type Note = {
  id: string;
  userId: string;
  content: string;
  createdAt: string; // ISO
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  // New optional fields for extended headings
  platform?: string;
  preferredTime?: string; // preferred time to call
  startTimeline?: string; // how soon looking to start
  hasWebsite?: string | boolean; // yes/no or URL indicator
  businessDetails?: string; // business details description
  assignedTo?: string | null; // userId
  notes: Note[];
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    throw err;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function readUsers(): Promise<User[]> {
  return readJson<User[]>(usersPath, []);
}

export async function writeUsers(users: User[]): Promise<void> {
  await writeJson(usersPath, users);
}

export async function readLeads(): Promise<Lead[]> {
  return readJson<Lead[]>(leadsPath, []);
}

export async function writeLeads(leads: Lead[]): Promise<void> {
  await writeJson(leadsPath, leads);
}

export function genId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}