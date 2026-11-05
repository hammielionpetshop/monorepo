// Pintu modul `logistics` (Logistik Minimal, spec L6). Satu-satunya modul HRIS yang menyentuh tabel `@petshop/logistics`;
// modul lain dan app/ hanya mengimpor dari sini (scripts/check-module-boundaries.mjs, eslint).
export {
  ROLE_LABELS, ROUTE_KIND_LABELS, STATUS_LABELS, WAGE_KIND_LABELS, contentProblem, crewProblem, fridayOf, garageCheck, isHanging, manualDateProblem,
  addDays, tripNumber, wagesFor, wibDate, type CrewRole, type RouteKind, type TripStatus, type WageKind,
} from './rules/trip';
export {
  addCrew, addManualWage, addShopping, arriveTrip, cancelTrip, cancelWage, closeByOffice, createTrip, departTrip, dropShopping, finishShopping,
  removeCrew, updateDraft, type ManualWageInput, type TripInput,
} from './server/trips';
export { saveRoute, saveVehicle, setFleetActive, setGarageBranch, turnFenceOff, turnFenceOn } from './server/fleet';
export {
  fleetScreen, logisticsAttention, myTripMenuVisible, myTripsScreen, openTripPhoto, tripAttendanceScreen, tripDetailScreen, tripFormScreen, tripsScreen,
  wagesScreen, type TripCard, type TripTab,
} from './server/screens';
export { runLogisticsDaily } from './server/jobs';
export { kasirChangeAttention, keepKasirChange, runKasirCheck } from './server/kasir-changes';
export {
  RATE_STATE_LABELS, amountFor, changeKind, dayLabel, earliestFrom, numbersProblem, pairLabel, rateOnDate, rupiah, sameNumbers,
  type RateChange, type RateNumbers, type RateRecord, type RateState,
} from './rules/rates';
export {
  cancelRate, createRate, fixRate, fixableRate, fleetLabels, loadRates, rateById, rateOn, ratePreview, rateProblem, ratesScreen, ritaseRows, tripNumbers,
  unratedPairs, type RateInput, type RateRow, type RitaseRow,
} from './server/rates';
export { RatesScreen } from './ui/rates-screen';
export { TripsScreen } from './ui/trips-screen';
export { TripForm } from './ui/trip-form';
export { TripDetailScreen } from './ui/trip-detail-screen';
export { MyTripsScreen } from './ui/my-trips-screen';
export { FleetScreen } from './ui/fleet-screen';
export { WagesScreen } from './ui/wages-screen';
export { TripAttendanceScreen } from './ui/trip-attendance-screen';
export {
  DEFAULT_WEEK_DAY, WEEKDAYS, isWeekday, nextWeek, prevWeek, weekOf, weekRegimes, weekStartsBetween, weekdayLabel,
  type WeekRange, type WeekRegime, type Weekday,
} from './rules/week';
export { loadWeekRegimes, wageWeekOf } from './server/week';
export { crewTripsBetween } from './server/data';
export { QUEUE_LABELS, QUEUE_STATUSES, STORE_NOTE_MAX, type NoteKind, type QueueStatus } from './rules/delivery-notes';
export {
  deliveryNotesScreen, saveStore, storeDetailScreen, storesScreen, type NoteRow, type NotesFilter, type StoreRow,
} from './server/delivery-notes';
export { DeliveryNotesScreen } from './ui/delivery-notes-screen';
export { StoreTabs, StoresScreen } from './ui/stores-screen';
export { StoreDetailScreen } from './ui/store-detail-screen';
export {
  MAX_NOTES_PER_TRIP, PICKUP_LABELS, VISIT_LABELS, kasirChange, noteKey, parseNoteKey, pickupOrigins, planVisits, tripNotesProblem,
  type KasirChange, type NoteKey, type PickupStatus, type VisitStatus,
} from './rules/trip-notes';
export { finishPickup, releaseVisit, type TripNoteView, type TripPickupView, type TripVisitView } from './server/trip-notes';
export {
  CONDITION_LABELS, OTHER, PHASE_LABELS, VISIT_REASONS, cleanEndReport, deliverProblem, endReportDue, headHomeProblem, reopenOpen, tripPhase, visitReason,
  type Condition, type TripPhase, type VisitOutcome,
} from './rules/driver-trip';
export {
  closeCondition, decideNote, followupAttention, followupScreen, headHome, markReady, pendingEndReports, processVisit, reopenNote, retryVisit,
  sendEndReport, unmarkReady, type EndReportPending, type FollowupRow, type VisitInput,
} from './server/driver-trip';
export { FollowupScreen } from './ui/followup-screen';
export {
  POINT_KIND_LABELS, POINT_STATUS_LABELS, accuracyProblem, correctionReason, mapUrl, outsidePoint, parseCoordinates,
  type PointKind, type PointStatus,
} from './rules/store-points';
export {
  decidePoint, openStorePointPhoto, pastePoint, pendingPointCount, pendingPoints, proposeFromVisit, storePointHistory, type PointRow,
} from './server/store-points';
export { PendingPointsList, StorePointCard } from './ui/store-points-panel';
export {
  CHOSEN_METHODS, PAYMENT_HINTS, PAYMENT_LABELS, REPORT_KINDS, REPORT_LABELS, billOf, cleanPayment, cleanReport, leftToCollect,
  type ChosenMethod, type PaymentMethod, type ReportKind,
} from './rules/store-payments';
export {
  addVisitReport, correctPayment, decideVisitReport, markDecisionRecorded, openReportCount, storePaymentsScreen, toRecordScreen, unrecordedCounts,
  visitReportsScreen, type DecisionView, type PaymentSourceFilter, type ReportRow, type StorePaymentRow, type ToRecordRow, type VisitPaymentView,
  type VisitReportView,
} from './server/store-payments';
export { StorePaymentsScreen } from './ui/store-payments-screen';
export { CHECK_RED_DAYS, MONEY_KIND_LABELS, POS_STATUS_LABELS, cleanCheck, posStatusOf, suggestSplit, type MoneyKind, type PosStatus } from './rules/money-checks';
export {
  moneyCheckAttention, moneyCheckScreen, saveMoneyCheck, voidMoneyCheck, type CheckSource, type MoneyCheckTab, type MoneyPaymentView,
} from './server/money-checks';
export { MoneyCheckScreen } from './ui/money-check-screen';
export { ToRecordScreen } from './ui/to-record-screen';
export { VisitReportsScreen } from './ui/visit-reports-screen';
export { TripNotesPanel } from './ui/trip-notes-panel';
export {
  RESULT_LABELS, RETURN_ITEMS_MAX, cleanReceipt, cleanReturnItems, nextStep, pendingRed, quantityText, stepsNeeded,
  type ReceiptResult, type ReceiptStep, type ReturnItem, type ReturnItemInput,
} from './rules/returned-goods';
export {
  closePending, pendingNoteCounts, pendingNotesScreen, receiveGoods, returnedGoodsPhotoIds, returnedGoodsScreen, returnedGoodsWaiting,
  type PendingRow, type ReturnedGoodsRow, type SourceKind,
} from './server/returned-goods';
export { ReturnedGoodsScreen } from './ui/returned-goods-screen';
export { PendingNotesScreen } from './ui/pending-notes-screen';
export { LOAD_STATUS_LABELS, type LoadPhotoKind, type LoadReportStatus } from './rules/load-reports';
export {
  addLoadNotes, addLoadPhoto, cancelLoadReport, candidateNotes, createLoadReport, finishLoadReport, loadReportDetail, loadReportList, openLoadPhoto,
  releaseLoadNote, removeLoadPhoto, type LoadReportTab,
} from './server/load-reports';
export { LoadReportDetailScreen, LoadReportsScreen } from './ui/load-reports-screen';
export { GAP_REASONS, SELF_STOP_LABELS, SELF_TRIP_LABELS, type SelfStopStatus, type SelfTripStatus } from './rules/self-delivery';
export {
  finishSelfTrip, openSelfPhoto, receiveSelfCash, runningSelfTripNumber, selfCashWaitingCount, selfDeliveryMenuVisible, selfDeliveryPhotoGaps,
  selfDeliveryScreen, selfStopOutcome, startSelfTrip, type SelfDeliveryScreenData, type SelfStopInput, type SelfStopView, type SelfTask, type SelfTripView,
} from './server/self-delivery';
export { proposeFromSelfStop } from './server/store-points';
export { SelfDeliveryScreen } from './ui/self-delivery-screen';
export { OFFICE_TABS, officeTab, type OfficeTab } from './rules/self-delivery-office';
export {
  closeSelfTrip, decideSelfStop, handoverSelfTrip, selfDeliveryAttention, selfDeliveryOfficeScreen, type SelfDeliveryOfficeData,
} from './server/self-delivery-office';
export { SelfDeliveryOfficeScreen } from './ui/self-delivery-office-screen';
export { addSelfStopReport, canCorrectSelf, correctSelfPayment } from './server/self-delivery-money';
// Logistik LT5a (spec LT1 §17.1): bensin sebagai sumber uang keluar, Dashboard Logistik, tinjau kiriman di luar titik.
export { FUEL_MAX, NO_REQUEST_REASONS, fuelPeriod, type NoRequestReason } from './rules/fuel';
export {
  correctFuel, fillFuelRequest, fuelPanel, fuelPeriodSummary, openFuelReceipt, recordFuelWithoutRequest, voidFuel, type FuelFillRow,
} from './server/fuel';
export { dashboardParts, logisticsDashboard, type BoardRow, type BoardSection } from './server/dashboard';
export { outsideScreen, reviewOutside, type OutsideKind, type OutsideRow } from './server/outside-points';
export { FuelPanel } from './ui/fuel-panel';
export { DashboardScreen } from './ui/dashboard-screen';
export { OutsideScreen } from './ui/outside-screen';
// Logistik LT5b (spec LT1 §17.2): Laporan Logistik baca saja, 6 tab, unduh CSV.
export { REPORT_TABS, reportRange, type ReportTab } from './rules/logistics-report';
export { logisticsReportDownload, logisticsReportScreen, reportParts, type ReportQuery } from './server/logistics-report';
export { LogisticsReportScreen } from './ui/logistics-report-screen';
