// Pintu modul `settings` (Pengaturan bertanggal, spec L2e). Modul lain dan app/ hanya mengimpor dari sini.
export {
  FIELD_DUTIES, ROLE_SUGGESTIONS, SETTINGS, SETTING_KEYS, isSettingKey,
  type SettingDefinition, type SettingKey, type TargetKind,
} from './rules/registry';
export { resolveSetting, type SettingRow, type SettingTarget } from './rules/resolve';
export { loadRows, shellSettingsToday, settingOn, settingVersions, settingsOn } from './server/read';
export { cancelSetting, checkReason, setSetting, type SetSettingInput } from './server/write';
export { positionSettingHandler } from './server/proposals';
export {
  getPositionSettingsScreen, getSettingsScreen, type PositionSettingsScreenData, type SettingsScreenData,
} from './server/screens';
export { SettingsScreen } from './ui/settings-screen';
export { PositionSettingsScreen, type PositionResubmit } from './ui/position-settings-screen';
