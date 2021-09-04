import { StandardBlind } from '../standard-blind';
import { ComelitPlatform, HubConfig } from '../../comelit-platform';
import { HomebridgeAPI } from 'homebridge/lib/api';
import { withPrefix } from 'homebridge/lib/logger';
import { Categories } from 'homebridge';
import { BlindDeviceData, ComelitClient } from 'comelit-client';
import { PositionState } from '../hap';
import { EnhancedBlind } from '../enhanced-blind';
import { getPositionAsByte } from '../../utils';
import { Blind } from '../blind';

const STD_BLIND_DEVICE_DATA: BlindDeviceData = {
  id: 'DOM#BL#19.1',
  type: 2,
  sub_type: 7,
  descrizione: 'Tapparella destra',
  sched_status: '0',
  sched_lock: '1970-01-01 01:00:00',
  status: '0',
  powerst: '0',
  open_status: '1',
  num_modulo: '19',
  num_uscita: '1',
  openTime: '60',
  closeTime: '60',
  preferPosition: '',
  enablePreferPosition: '0',
  icon_id: '0',
  isProtected: '0',
  objectId: 'DOM#BL#19.1',
  placeId: 'GEN#PL#258',
};

const ENHANCED_BLIND_DEVICE_DATA: BlindDeviceData = {
  id: 'DOM#BL#32.1',
  type: 2,
  sub_type: 31,
  descrizione: 'Soggiorno',
  sched_status: '0',
  sched_lock: '1970-01-01 01:00:00',
  status: '0',
  powerst: '0',
  position: '255',
  open_status: '0',
  preferPosition: '127',
  enablePreferPosition: '1',
  num_modulo: '32',
  num_uscita: '1',
  openTime: '40',
  closeTime: '37',
  icon_id: '2',
  isProtected: '0',
  objectId: 'DOM#BL#32.1',
  placeId: 'GEN#PL#221',
};

jest.useFakeTimers();

jest.mock('comelit-client', () => {
  return {
    ComelitClient: jest.fn().mockImplementation(() => {
      return { toggleDeviceStatus: jest.fn(), setBlindPosition: jest.fn() };
    }),
  };
});

const config: HubConfig = {
  platform: 'comelit',
  username: 'string',
  password: 'string',
  hub_username: 'string',
  hub_password: 'string',
};

describe('Blinds', () => {
  it('should update std blind status', async () => {
    const api = new HomebridgeAPI();
    const platform = new ComelitPlatform(withPrefix('test'), config, api);
    const accessory = platform.createHapAccessory(
      STD_BLIND_DEVICE_DATA,
      Categories.WINDOW_COVERING,
      STD_BLIND_DEVICE_DATA.id
    );
    const client = new ComelitClient(() => jest.fn());
    const blind = new StandardBlind(platform, accessory, client);
    const service = accessory.getService(platform.Service.WindowCovering);
    const targetPosition = service.getCharacteristic(platform.Characteristic.TargetPosition);
    const positionState = service.getCharacteristic(platform.Characteristic.PositionState);
    const position = service.getCharacteristic(platform.Characteristic.CurrentPosition);

    expect(targetPosition.value).toBe(Blind.OPEN);
    expect(position.value).toBe(Blind.OPEN);
    expect(positionState.value).toBe(PositionState.STOPPED);

    await blind.setPosition(40, jest.fn);
    expect(client.toggleDeviceStatus).toHaveBeenCalledTimes(1);
    expect(client.toggleDeviceStatus).toHaveBeenCalledWith(STD_BLIND_DEVICE_DATA.id, 0);
    blind.updateDevice({
      ...STD_BLIND_DEVICE_DATA,
      type: 2,
      sub_type: 7,
      sched_status: '0',
      sched_lock: '1970-01-01 01:00:00',
      status: '2',
      powerst: '2',
      open_status: '1',
    });
    expect(setTimeout).toHaveBeenLastCalledWith(
      expect.any(Function),
      ((Blind.CLOSING_TIME * 1000) / 100) * 60
    );
    expect(positionState.value).toBe(PositionState.DECREASING);
    // @ts-ignore
    client.toggleDeviceStatus.mockClear();
    jest.runAllTimers();
    expect(client.toggleDeviceStatus).toHaveBeenCalledTimes(1);
    expect(client.toggleDeviceStatus).toHaveBeenCalledWith(STD_BLIND_DEVICE_DATA.id, 1);
    blind.updateDevice({
      ...STD_BLIND_DEVICE_DATA,
      type: 2,
      sub_type: 7,
      sched_status: '0',
      sched_lock: '1970-01-01 01:00:00',
      status: '0',
      powerst: '0',
      open_status: '1',
    });
    expect(positionState.value).toBe(PositionState.STOPPED);
  });

  it('should update enhanced blind status', async () => {
    const api = new HomebridgeAPI();
    const platform = new ComelitPlatform(withPrefix('test'), config, api);
    const accessory = platform.createHapAccessory(
      ENHANCED_BLIND_DEVICE_DATA,
      Categories.WINDOW_COVERING,
      ENHANCED_BLIND_DEVICE_DATA.id
    );
    const client = new ComelitClient(() => jest.fn());
    const blind = new EnhancedBlind(platform, accessory, client);
    const service = accessory.getService(platform.Service.WindowCovering);
    const positionState = service.getCharacteristic(platform.Characteristic.PositionState);
    const targetPosition = service.getCharacteristic(platform.Characteristic.TargetPosition);
    const position = service.getCharacteristic(platform.Characteristic.CurrentPosition);

    expect(targetPosition.value).toBe(Blind.CLOSED);
    expect(position.value).toBe(Blind.CLOSED);
    expect(positionState.value).toBe(PositionState.STOPPED);

    const callback = jest.fn;
    await blind.setPosition(40, callback);
    expect(client.setBlindPosition).toHaveBeenCalledTimes(1);
    // expect(callback).toHaveBeenCalledTimes(1);
    expect(client.setBlindPosition).toHaveBeenCalledWith(
      ENHANCED_BLIND_DEVICE_DATA.id,
      getPositionAsByte(40)
    );
    expect(targetPosition.value).toBe(40);
    blind.updateDevice({
      ...ENHANCED_BLIND_DEVICE_DATA,
      type: 2,
      sub_type: 31,
      sched_status: '0',
      sched_lock: '1970-01-01 01:00:00',
      status: '1',
      powerst: '1',
      position: '255',
      open_status: '0',
      preferPosition: '127',
      enablePreferPosition: '1',
    });
    expect(positionState.value).toBe(PositionState.INCREASING);
    blind.updateDevice({
      ...ENHANCED_BLIND_DEVICE_DATA,
      type: 2,
      sub_type: 31,
      sched_status: '0',
      sched_lock: '1970-01-01 01:00:00',
      status: '0',
      powerst: '1',
      position: `${getPositionAsByte(40)}`,
      open_status: '0',
      preferPosition: '127',
      enablePreferPosition: '1',
    });

    expect(positionState.value).toBe(PositionState.STOPPED);
    expect(position.value).toBe(40);
  });
});
