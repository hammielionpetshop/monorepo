// Pintu modul `logistics` (Logistik Minimal, spec L6). Satu-satunya modul HRIS yang menyentuh tabel `@petshop/logistics`;
// modul lain dan app/ hanya mengimpor dari sini (scripts/check-module-boundaries.mjs, eslint).
export {
  ROLE_LABELS, ROUTE_KIND_LABELS, STATUS_LABELS, WAGE_KIND_LABELS, contentProblem, crewProblem, fridayOf, garageCheck, isHanging, manualDateProblem,
  tripNumber, wagesFor, type CrewRole, type RouteKind, type TripStatus, type WageKind,
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
export { TripsScreen } from './ui/trips-screen';
export { TripForm } from './ui/trip-form';
export { TripDetailScreen } from './ui/trip-detail-screen';
export { MyTripsScreen } from './ui/my-trips-screen';
export { FleetScreen } from './ui/fleet-screen';
export { WagesScreen } from './ui/wages-screen';
export { TripAttendanceScreen } from './ui/trip-attendance-screen';
