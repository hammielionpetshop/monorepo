// Pintu modul `announcements` (Pengumuman, spec F3-2; Papan Perubahan Aturan menyusul F3-3). Modul lain dan app/ hanya mengimpor dari sini.
export {
  EMERGENCY_STATUS_LABELS, EMERGENCY_TITLE_MAX, checkEndReason, emergencyStatus, endOfDayWib, lastAllowedDate, letterCount,
  matchesTarget, validateEmergency,
  type EmergencyInput, type EmergencyStatus, type EmergencyTarget,
} from './rules/emergency';
export {
  countRecipients, emergencyFormOptions, emergencyLimits, emergencyReaders, endEmergency, listEmergencies, markEmergencyRead,
  pendingEmergencies, sendEmergency,
  type EmergencyLimitsView, type EmergencyQueueItem, type EmergencyRow, type ReaderRow,
} from './server/emergency';
export { emergencyTargetSchema } from './server/schemas';
export { AnnouncementsScreen, type AnnouncementTab } from './ui/announcements-screen';
export { ReadersScreen } from './ui/readers-screen';
export { SendEmergencyScreen } from './ui/send-emergency-screen';
