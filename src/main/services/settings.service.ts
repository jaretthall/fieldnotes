import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AppSettings } from '../../../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  privacyMode: 'local_only',
  inputMode: 'text_only',
  aiProvider: 'off',
  ollamaModel: 'llama3.2:1b',
  cloudProvider: 'openai_compatible',
  cloudEndpoint: 'https://api.openai.com/v1/chat/completions',
  cloudModel: 'gpt-4o-mini',
  cloudApiKey: null,
};

function getSettingsPath(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'settings.json');
}

export function getAppSettings(): AppSettings {
  const filePath = getSettingsPath();
  if (!existsSync(filePath)) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = {
    ...getAppSettings(),
    ...patch,
  };
  writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

