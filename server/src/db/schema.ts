import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// === Auth ===
export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // 隨機 token
  userId: integer('user_id')
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// === Catalog ===
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  price: integer('price').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const cameras = pgTable(
  'cameras',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(), // 'video' | 'photo'
    key: text('key').notNull(),
    label: text('label').notNull(),
    price: integer('price').notNull().default(0),
    note: text('note').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    typeKeyUnique: uniqueIndex('cameras_type_key_unique').on(t.type, t.key),
  }),
);

export const ceremonies = pgTable(
  'ceremonies',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    price: integer('price').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    typeKeyUnique: uniqueIndex('ceremonies_type_key_unique').on(t.type, t.key),
  }),
);

export const addons = pgTable('addons', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  price: integer('price').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const photographers = pgTable(
  'photographers',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull().default(''),
    price: integer('price').notNull().default(0),
    photo: text('photo').notNull().default(''),
    desc: text('desc').notNull().default(''),
    portfolio: text('portfolio').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    typeKeyUnique: uniqueIndex('photographers_type_key_unique').on(t.type, t.key),
  }),
);

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'image' | 'video'
  url: text('url').notNull(),
  alt: text('alt').notNull().default(''),
  poster: text('poster').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
});

// === Booking + 表單回覆 ===
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  videoSlots: integer('video_slots').notNull().default(0),
  photoSlots: integer('photo_slots').notNull().default(0),
  videoCamsUsed: integer('video_cams_used').notNull().default(0),
  photoCamsUsed: integer('photo_cams_used').notNull().default(0),
  videoLeads: text('video_leads')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  photoLeads: text('photo_leads')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  notes: text('notes').notNull().default(''),
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  groom: text('groom').notNull(),
  bride: text('bride').notNull(),
  phone: text('phone').notNull(),
  eventDate: text('event_date').notNull(),
  service: text('service').notNull(),
  weddingTime: text('wedding_time').notNull().default(''),
  restaurant: text('restaurant').notNull().default(''),
  hotel: text('hotel').notNull().default(''),
  cerWz: text('cer_wz').notNull().default(''),
  cerYq: text('cer_yq').notNull().default(''),
  cerZh: text('cer_zh').notNull().default(''),
  makeupTime: text('makeup_time').notNull().default(''),
  total: integer('total').notNull().default(0),
  breakdown: text('breakdown').notNull().default(''),
  pdfUrl: text('pdf_url').notNull().default(''),
  signature: text('signature').notNull().default(''),
  raw: jsonb('raw'), // 原始 payload 備份
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
