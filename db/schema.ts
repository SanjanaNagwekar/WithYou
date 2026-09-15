import {sqliteTable,text,integer,real,index,uniqueIndex} from 'drizzle-orm/sqlite-core';

export const users=sqliteTable('user',{
 id:text('id').primaryKey(),
 name:text('name').notNull(),
 email:text('email').notNull(),
 emailVerified:integer('emailVerified',{mode:'boolean'}).notNull().default(false),
 image:text('image'),
 createdAt:text('createdAt').notNull(),
 updatedAt:text('updatedAt').notNull(),
},t=>[uniqueIndex('user_email_unique').on(t.email)]);

export const sessions=sqliteTable('session',{
 id:text('id').primaryKey(),
 expiresAt:text('expiresAt').notNull(),
 token:text('token').notNull(),
 createdAt:text('createdAt').notNull(),
 updatedAt:text('updatedAt').notNull(),
 ipAddress:text('ipAddress'),
 userAgent:text('userAgent'),
 userId:text('userId').notNull().references(()=>users.id,{onDelete:'cascade'}),
},t=>[
 uniqueIndex('session_token_unique').on(t.token),
 index('session_userId_idx').on(t.userId),
]);

export const accounts=sqliteTable('account',{
 id:text('id').primaryKey(),
 accountId:text('accountId').notNull(),
 providerId:text('providerId').notNull(),
 userId:text('userId').notNull().references(()=>users.id,{onDelete:'cascade'}),
 accessToken:text('accessToken'),
 refreshToken:text('refreshToken'),
 idToken:text('idToken'),
 accessTokenExpiresAt:text('accessTokenExpiresAt'),
 refreshTokenExpiresAt:text('refreshTokenExpiresAt'),
 scope:text('scope'),
 password:text('password'),
 createdAt:text('createdAt').notNull(),
 updatedAt:text('updatedAt').notNull(),
},t=>[index('account_userId_idx').on(t.userId)]);

export const verifications=sqliteTable('verification',{
 id:text('id').primaryKey(),
 identifier:text('identifier').notNull(),
 value:text('value').notNull(),
 expiresAt:text('expiresAt').notNull(),
 createdAt:text('createdAt').notNull(),
 updatedAt:text('updatedAt').notNull(),
},t=>[index('verification_identifier_idx').on(t.identifier)]);

export const voices=sqliteTable('voices',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),relationship:text('relationship').notNull(),voiceId:text('voice_id'),consentAt:text('consent_at').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_voices_owner').on(t.owner)]);
export const recordings=sqliteTable('recordings',{id:text('id').primaryKey(),owner:text('owner').notNull(),voiceId:text('voice_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),key:text('object_key').notNull(),mime:text('mime').notNull(),transcript:text('transcript').notNull().default(''),mood:text('mood').notNull().default('natural'),pace:real('pace').notNull().default(1),volume:real('volume').notNull().default(1),updatedAt:text('updated_at').notNull().default(''),createdAt:text('created_at').notNull()},t=>[index('idx_recordings_owner_voice').on(t.owner,t.voiceId)]);
export const locks=sqliteTable('generation_locks',{voiceId:text('voice_id').primaryKey(),expires:integer('expires').notNull()});
export const generationEvents=sqliteTable('generation_events',{id:text('id').primaryKey(),owner:text('owner').notNull(),voiceId:text('voice_id').notNull(),recordingId:text('recording_id').notNull(),action:text('action').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_generation_events_owner_created').on(t.owner,t.createdAt)]);
