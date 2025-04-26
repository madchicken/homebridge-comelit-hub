import { DoorDeviceConfig, SupportedTypes } from './types';
import { HubConfig } from './comelit-platform';

/**
 * Returns the position as a value between 0 and 255.
 * Since Comelit system uses 0 for opened and 100 for closed, this function inverts the percentage to accommodate
 * the value for Homekit, that uses 0 for closed nad 100 for fully opened.
 * @param position number 0-100
 */
export function getPositionAsByte(position: number): number {
  return Math.round((100 - position) * 2.55);
}

/**
 * Returns the position as a value between 0 and 100
 * Since Comelit system uses 0 for opened and 100 for closed, this function inverts the percentage to accommodate
 * the value for Homekit, that uses 0 for closed and 100 for fully opened.
 * @param position number 0-255
 */
export function getPositionAsPerc(position: string): number {
  let number = 0;
  try {
    number = parseInt(position);
  } catch (_e) {
    // no op, use default (0)
  }
  return Math.round(100 - number / 2.55);
}

export const DEFAULT_DOOR_CONFIG = {
  name: '',
  type: SupportedTypes.door,
  opening_time: 20,
  closing_time: 20,
  opened_time: 60,
} as DoorDeviceConfig;

/**
 *
 * @param config
 * @param id
 */
export function getDoorDeviceConfigOrDefault(config: HubConfig, id: string): DoorDeviceConfig {
  let deviceConfig = config.door_devices?.find(d => d.name === id) || {
    ...DEFAULT_DOOR_CONFIG,
    name: id,
  };
  if (!deviceConfig.opened_time) {
    deviceConfig.opened_time = DEFAULT_DOOR_CONFIG.opened_time;
  }
  if (!deviceConfig.opening_time) {
    deviceConfig.opening_time = DEFAULT_DOOR_CONFIG.opening_time;
  }
  if (!deviceConfig.closing_time) {
    deviceConfig.closing_time = DEFAULT_DOOR_CONFIG.closing_time;
  }
  return deviceConfig;
}
