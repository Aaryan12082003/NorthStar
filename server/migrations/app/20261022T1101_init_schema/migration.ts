#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/743feafa81d383a26bdb121b5f2edf7f86e0acef473317168c146ca5313c55b3/contract';
import endContract from '../../snapshots/743feafa81d383a26bdb121b5f2edf7f86e0acef473317168c146ca5313c55b3/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'ActivityLog',
        columns: [
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Attachment',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('filename', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('originalName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('size', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('detail', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ip', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Comment',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Notification',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dedupeKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('taskId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Project',
        columns: [
          col('color', 'text', {
            notNull: true,
            default: lit('#2563EB'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deadline', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('description', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Project_status_check_ff01efe3',
            sql`"status" IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProjectMember',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'RecurringTaskRule',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('endsAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('frequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('interval', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('nextRunAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'RecurringTaskRule_frequency_check_4cc8f810',
            sql`"frequency" IN ('DAILY', 'WEEKLY', 'MONTHLY')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Subtask',
        columns: [
          col('done', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Tag',
        columns: [
          col('color', 'text', {
            notNull: true,
            default: lit('#64748B'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Task',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('deadline', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('description', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('estimatedHours', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('MEDIUM'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reviewNote', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('reviewedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('seriesId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('TODO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submittedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Task_priority_check_91766bfd',
            sql`"priority" IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW')`,
          ),
          checkExpression(
            'Task_status_check_0f1dd63b',
            sql`"status" IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'TaskAssignee',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'TaskTag',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tagId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('avatarColor', 'text', {
            notNull: true,
            default: lit('#2563EB'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notifyAssigned', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notifyChanges', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notifyDueSoon', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notifyDueToday', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notifyOverdue', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notifyReview', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timezone', 'text', {
            notNull: true,
            default: lit('Asia/Kolkata'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Workspace',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'WorkspaceMember',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'WorkspaceMember_role_check_5fff60be',
            sql`"role" IN ('ADMIN', 'MANAGER', 'EMPLOYEE')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Notification',
        constraint: 'Notification_userId_dedupeKey_key',
        columns: ['userId', 'dedupeKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProjectMember',
        constraint: 'ProjectMember_projectId_userId_key',
        columns: ['projectId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RecurringTaskRule',
        constraint: 'RecurringTaskRule_taskId_key',
        columns: ['taskId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Session',
        constraint: 'Session_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Tag',
        constraint: 'Tag_workspaceId_name_key',
        columns: ['workspaceId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'TaskAssignee',
        constraint: 'TaskAssignee_taskId_userId_key',
        columns: ['taskId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'TaskTag',
        constraint: 'TaskTag_taskId_tagId_key',
        columns: ['taskId', 'tagId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Workspace',
        constraint: 'Workspace_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WorkspaceMember',
        constraint: 'WorkspaceMember_workspaceId_userId_key',
        columns: ['workspaceId', 'userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityLog',
        index: 'ActivityLog_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityLog',
        index: 'ActivityLog_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityLog',
        index: 'ActivityLog_workspaceId_createdAt_idx_5ff7e893',
        columns: ['workspaceId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityLog',
        index: 'ActivityLog_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_workspaceId_createdAt_idx_5ff7e893',
        columns: ['workspaceId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Comment',
        index: 'Comment_taskId_createdAt_idx_f41547ff',
        columns: ['taskId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Comment',
        index: 'Comment_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Comment',
        index: 'Comment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Project',
        index: 'Project_ownerId_idx_e2d0c1ef',
        columns: ['ownerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Project',
        index: 'Project_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Project',
        index: 'Project_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectMember',
        index: 'ProjectMember_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectMember',
        index: 'ProjectMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringTaskRule',
        index: 'RecurringTaskRule_active_nextRunAt_idx_41d630a9',
        columns: ['active', 'nextRunAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Subtask',
        index: 'Subtask_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Tag',
        index: 'Tag_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_deadline_idx_1f1bcfa7',
        columns: ['deadline'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_reviewedById_idx_e2835478',
        columns: ['reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_seriesId_idx_582cd0a3',
        columns: ['seriesId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_workspaceId_status_idx_76d68132',
        columns: ['workspaceId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskAssignee',
        index: 'TaskAssignee_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskAssignee',
        index: 'TaskAssignee_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskTag',
        index: 'TaskTag_tagId_idx_86854244',
        columns: ['tagId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskTag',
        index: 'TaskTag_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WorkspaceMember',
        index: 'WorkspaceMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WorkspaceMember',
        index: 'WorkspaceMember_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ActivityLog',
        foreignKey: {
          name: 'ActivityLog_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ActivityLog',
        foreignKey: {
          name: 'ActivityLog_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Comment',
        foreignKey: {
          name: 'Comment_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Comment',
        foreignKey: {
          name: 'Comment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Project',
        foreignKey: {
          name: 'Project_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Project',
        foreignKey: {
          name: 'Project_ownerId_fkey',
          columns: ['ownerId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectMember',
        foreignKey: {
          name: 'ProjectMember_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectMember',
        foreignKey: {
          name: 'ProjectMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringTaskRule',
        foreignKey: {
          name: 'RecurringTaskRule_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Session',
        foreignKey: {
          name: 'Session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Subtask',
        foreignKey: {
          name: 'Subtask_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Tag',
        foreignKey: {
          name: 'Tag_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_reviewedById_fkey',
          columns: ['reviewedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskAssignee',
        foreignKey: {
          name: 'TaskAssignee_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskAssignee',
        foreignKey: {
          name: 'TaskAssignee_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskTag',
        foreignKey: {
          name: 'TaskTag_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskTag',
        foreignKey: {
          name: 'TaskTag_tagId_fkey',
          columns: ['tagId'],
          references: { schema: 'public', table: 'Tag', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WorkspaceMember',
        foreignKey: {
          name: 'WorkspaceMember_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WorkspaceMember',
        foreignKey: {
          name: 'WorkspaceMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
