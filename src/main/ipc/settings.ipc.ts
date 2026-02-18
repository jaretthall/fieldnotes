import { ipcMain } from 'electron';
import type { AppSettings } from '../../../shared/types';
import { getAppSettings, updateAppSettings } from '../services/settings.service';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    return getAppSettings();
  });

  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>): Promise<AppSettings> => {
    return updateAppSettings(patch);
  });
}

