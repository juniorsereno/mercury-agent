import cron from 'node-cron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { MercuryConfig } from '../utils/config.js';
import { getMercuryHome } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export interface ScheduledTask {
  id: string;
  cron: string;
  handler: () => Promise<void>;
  description: string;
}

export interface ScheduledTaskManifest {
  id: string;
  cron: string;
  description: string;
  skillName?: string;
  prompt?: string;
  createdAt: string;
}

const SCHEDULES_FILE = 'schedules.yaml';

function getSchedulesPath(): string {
  return join(getMercuryHome(), SCHEDULES_FILE);
}

export function loadSchedules(): ScheduledTaskManifest[] {
  const path = getSchedulesPath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = parseYaml(raw) as { tasks?: ScheduledTaskManifest[] };
    return data.tasks || [];
  } catch (err) {
    logger.warn({ err }, 'Failed to load schedules.yaml');
    return [];
  }
}

export function saveSchedules(tasks: ScheduledTaskManifest[]): void {
  const path = getSchedulesPath();
  const dir = getMercuryHome();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, stringifyYaml({ tasks }), 'utf-8');
}

export class Scheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private taskManifests: Map<string, ScheduledTaskManifest> = new Map();
  private heartbeatIntervalMinutes: number;
  private heartbeatHandler?: () => Promise<void>;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    config: MercuryConfig,
    private onScheduledTask?: (manifest: ScheduledTaskManifest) => Promise<void>,
  ) {
    this.heartbeatIntervalMinutes = config.heartbeat.intervalMinutes;
  }

  setOnScheduledTask(handler: (manifest: ScheduledTaskManifest) => Promise<void>): void {
    this.onScheduledTask = handler;
  }

  onHeartbeat(handler: () => Promise<void>): void {
    this.heartbeatHandler = handler;
  }

  startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    const ms = this.heartbeatIntervalMinutes * 60 * 1000;
    logger.info({ intervalMin: this.heartbeatIntervalMinutes }, 'Heartbeat started');

    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.heartbeatHandler?.();
      } catch (err) {
        logger.error({ err }, 'Heartbeat error');
      }
    }, ms);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.info('Heartbeat stopped');
    }
  }

  addTask(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      this.removeTask(task.id);
    }
    const scheduled = cron.schedule(task.cron, async () => {
      try {
        await task.handler();
      } catch (err) {
        logger.error({ task: task.id, err }, 'Scheduled task error');
      }
    });
    this.tasks.set(task.id, scheduled);
    logger.info({ id: task.id, cron: task.cron, desc: task.description }, 'Task scheduled');
  }

  addPersistedTask(manifest: ScheduledTaskManifest): void {
    this.taskManifests.set(manifest.id, manifest);
    this.addTask({
      id: manifest.id,
      cron: manifest.cron,
      description: manifest.description,
      handler: async () => {
        logger.info({ task: manifest.id }, 'Scheduled task firing');
        if (this.onScheduledTask) {
          await this.onScheduledTask(manifest);
        }
      },
    });
  }

  removeTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
    this.taskManifests.delete(id);
  }

  getManifests(): ScheduledTaskManifest[] {
    return [...this.taskManifests.values()];
  }

  restorePersistedTasks(): void {
    const persisted = loadSchedules();
    for (const manifest of persisted) {
      if (cron.validate(manifest.cron)) {
        this.addPersistedTask(manifest);
      } else {
        logger.warn({ id: manifest.id, cron: manifest.cron }, 'Skipping invalid cron expression');
      }
    }
    if (persisted.length > 0) {
      logger.info({ count: persisted.length }, 'Restored persisted scheduled tasks');
    }
  }

  persistSchedules(): void {
    saveSchedules(this.getManifests());
  }

  stopAll(): void {
    this.stopHeartbeat();
    for (const [, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
    this.taskManifests.clear();
  }
}