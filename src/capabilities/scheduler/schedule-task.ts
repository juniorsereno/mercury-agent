import { tool } from 'ai';
import { z } from 'zod';
import cron from 'node-cron';
import type { Scheduler, ScheduledTaskManifest } from '../../core/scheduler.js';

export function createScheduleTaskTool(scheduler: Scheduler) {
  return tool({
    description: 'Schedule a recurring task using a cron expression. You can optionally specify a skill name to invoke or a prompt to process.',
    parameters: z.object({
      cron: z.string().describe('Cron expression (e.g. "0 9 * * *" for daily at 9am, "*/30 * * * *" for every 30 min)'),
      description: z.string().describe('Human-readable description of what this task does'),
      prompt: z.string().optional().describe('Prompt to send to the agent when the task fires'),
      skill_name: z.string().optional().describe('Name of a skill to invoke when the task fires'),
    }),
    execute: async ({ cron: cronExpr, description, prompt, skill_name }) => {
      if (!cron.validate(cronExpr)) {
        return `Invalid cron expression: "${cronExpr}". Use standard 5-field cron format (min hour day month weekday).`;
      }

      if (!prompt && !skill_name) {
        return 'Either prompt or skill_name must be provided so the scheduled task has something to do.';
      }

      const id = `task-${Date.now().toString(36)}`;
      const manifest: ScheduledTaskManifest = {
        id,
        cron: cronExpr,
        description,
        prompt,
        skillName: skill_name,
        createdAt: new Date().toISOString(),
      };

      scheduler.addPersistedTask(manifest);
      scheduler.persistSchedules();

      const triggerType = skill_name ? `skill: ${skill_name}` : `prompt: "${prompt!.slice(0, 60)}"`;
      return `Task "${id}" scheduled. Cron: ${cronExpr}. Will execute ${triggerType}. Description: ${description}`;
    },
  });
}