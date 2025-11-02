import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FocusView =
  | "HOME"
  | "SELECT_FLIGHT"
  | "SELECT_SEAT"
  | "CONFIRM_FOCUS"
  | "BOARDING_PASS"
  | "IN_FLIGHT"
  | "LANDING";

export interface City {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
}

export interface FakeFlight {
  id: string;
  airline: string;
  flightNo: string;
  origin: string;
  dest: string;
  departure: string;
}

export interface SeatSelection {
  label: string;
}

export interface FocusSessionDraft {
  flightId: string;
  durationMinutes: number;
  seat: string;
  focusType: FocusType;
}

export type FocusType = "Work" | "Study" | "Meditate" | "Read" | "Exercise";

export interface ActiveFlightState {
  sessionId: string;
  flight: FakeFlight;
  preparedAt: string;
  startedAt: string | null;
  durationMinutes: number;
  seat: string;
  focusType: FocusType;
  originCity: City;
  destinationCity: City;
  elapsedSeconds: number;
  distanceKm: number;
  status: "ready" | "airborne" | "completed";
}

export interface CompletedFlightEntry {
  id: string;
  flight: FakeFlight;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  seat: string;
  focusType: FocusType;
  distanceKm: number;
  miles: number;
}

export interface FocusStoreState {
  view: FocusView;
  userName: string;
  mapDot: { lat: number; lng: number };
  cities: City[];
  flights: FakeFlight[];
  draftDuration: number;
  selectedFlight: FakeFlight | null;
  selectedSeat: string | null;
  selectedFocus: FocusType | null;
  activeFlight: ActiveFlightState | null;
  history: CompletedFlightEntry[];
  trendsRange: "week" | "month" | "year";
  panels: {
    history: boolean;
    trends: boolean;
    settings: boolean;
  };
  hydrateSeed: (payload: { cities: City[]; flights: FakeFlight[]; mapDot: { lat: number; lng: number } }) => void;
  setUserName: (name: string) => void;
  togglePanel: (panel: "history" | "trends" | "settings") => void;
  closePanels: () => void;
  goTo: (view: FocusView) => void;
  selectFlight: (flight: FakeFlight) => void;
  openSeatSelection: () => void;
  updateDuration: (minutes: number) => void;
  selectSeat: (seat: string) => void;
  openFocusSelection: () => void;
  selectFocus: (type: FocusType) => void;
  openBoardingPass: () => void;
  startBoarding: () => void;
  launchFlight: () => void;
  tick: () => void;
  landFlight: () => void;
  completeLanding: () => void;
  abortFlight: () => void;
  setTrendsRange: (range: "week" | "month" | "year") => void;
}

const storage = createJSONStorage(() => (typeof window === "undefined" ? fakeStorage : window.localStorage));

const fakeStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined
};

function randomSessionId(): string {
  return crypto.randomUUID();
}

function toMiles(km: number): number {
  return Math.round(km * 0.621371 * 10) / 10;
}

function computeDistanceKm(a: City, b: City): number {
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return Math.round(earthRadius * c);
}

function finalizeEntry(active: ActiveFlightState, elapsedSeconds: number): CompletedFlightEntry {
  const totalSeconds = Math.max(1, active.durationMinutes * 60);
  const clampedElapsed = Math.min(totalSeconds, Math.max(1, Math.round(elapsedSeconds)));
  const durationMinutes = Math.max(1, Math.round(clampedElapsed / 60));
  const progress = Math.min(1, clampedElapsed / totalSeconds);
  const distanceKm = Math.round(active.distanceKm * progress);
  return {
    id: active.sessionId,
    flight: active.flight,
    startAt: active.startedAt ?? active.preparedAt,
    endAt: new Date().toISOString(),
    durationMinutes,
    seat: active.seat,
    focusType: active.focusType,
    distanceKm,
    miles: toMiles(distanceKm)
  };
}

export const useFocusStore = create<FocusStoreState>()(
  persist(
    (set, get) => ({
      view: "HOME",
      userName: "Aarav",
      mapDot: { lat: 28.6139, lng: 77.2090 },
      cities: [],
      flights: [],
      draftDuration: 25,
      selectedFlight: null,
      selectedSeat: null,
      selectedFocus: null,
      activeFlight: null,
      history: [],
      trendsRange: "week",
      panels: {
        history: false,
        trends: false,
        settings: false
      },
      hydrateSeed: ({ cities, flights, mapDot }) => set({ cities, flights, mapDot }),
      setUserName: (name) => set({ userName: name }),
      togglePanel: (panel) =>
        set((state) => ({
          panels: {
            history: panel === "history" ? !state.panels.history : false,
            trends: panel === "trends" ? !state.panels.trends : false,
            settings: panel === "settings" ? !state.panels.settings : false
          }
        })),
      closePanels: () => set({ panels: { history: false, trends: false, settings: false } }),
      goTo: (view) => set({ view }),
      selectFlight: (flight) =>
        set({ selectedFlight: flight, selectedSeat: null, selectedFocus: null }),
      openSeatSelection: () => {
        const { selectedFlight } = get();
        if (!selectedFlight) {
          return;
        }
        set({ view: "SELECT_SEAT" });
      },
      updateDuration: (minutes) => set({ draftDuration: Math.max(5, Math.min(180, minutes)) }),
      selectSeat: (seat) => set({ selectedSeat: seat }),
      openFocusSelection: () => {
        const { selectedSeat } = get();
        if (!selectedSeat) {
          return;
        }
        set({ view: "CONFIRM_FOCUS" });
      },
      selectFocus: (type) => set({ selectedFocus: type }),
      openBoardingPass: () => {
        const { selectedFlight, selectedSeat, selectedFocus } = get();
        if (!selectedFlight || !selectedSeat || !selectedFocus) {
          return;
        }
        set({ view: "BOARDING_PASS" });
      },
      startBoarding: () => {
        const state = get();
        const flight = state.selectedFlight;
        if (!flight || !state.selectedSeat) {
          return;
        }
        const originCity = state.cities.find((city) => city.code === flight.origin);
        const destinationCity = state.cities.find((city) => city.code === flight.dest);
        if (!originCity || !destinationCity) {
          return;
        }
        const distanceKm = computeDistanceKm(originCity, destinationCity);
        const activeFlight: ActiveFlightState = {
          sessionId: randomSessionId(),
          flight,
          preparedAt: new Date().toISOString(),
          startedAt: null,
          durationMinutes: state.draftDuration,
          seat: state.selectedSeat,
          focusType: state.selectedFocus ?? "Work",
          originCity,
          destinationCity,
          elapsedSeconds: 0,
          distanceKm,
          status: "ready"
        };
        set({ activeFlight, view: "IN_FLIGHT" });
      },
      launchFlight: () => {
        const active = get().activeFlight;
        if (!active || active.status === "completed") {
          return;
        }
        const startStamp = active.startedAt ?? new Date().toISOString();
        set({
          activeFlight: { ...active, startedAt: startStamp, status: "airborne" }
        });
      },
      tick: () => {
        const state = get();
        const { activeFlight } = state;
        if (!activeFlight || activeFlight.status !== "airborne") {
          return;
        }
        const totalSeconds = activeFlight.durationMinutes * 60;
        const elapsed = Math.min(totalSeconds, activeFlight.elapsedSeconds + 1);
        if (elapsed >= totalSeconds) {
          const entry = finalizeEntry(activeFlight, totalSeconds);
          set({
            history: [...state.history, entry],
            activeFlight: { ...activeFlight, elapsedSeconds: totalSeconds, status: "completed" },
            view: "LANDING"
          });
          return;
        }
        set({ activeFlight: { ...activeFlight, elapsedSeconds: elapsed } });
      },
      landFlight: () => {
        const state = get();
        const active = state.activeFlight;
        if (!active) {
          return;
        }
        const entry = finalizeEntry(active, Math.max(active.elapsedSeconds, 1));
        set({
          history: [...state.history, entry],
          activeFlight: { ...active, elapsedSeconds: active.durationMinutes * 60, status: "completed" },
          view: "LANDING"
        });
      },
      completeLanding: () =>
        set((state) => ({
          view: "HOME",
          selectedFlight: null,
          selectedSeat: null,
          selectedFocus: null,
          activeFlight: null,
          draftDuration: 25
        })),
      abortFlight: () =>
        set({
          view: "HOME",
          activeFlight: null,
          selectedFlight: null,
          selectedSeat: null,
          selectedFocus: null,
          draftDuration: 25
        }),
      setTrendsRange: (range) => set({ trendsRange: range })
    }),
    {
      name: "airfocus-store",
      storage,
      partialize: (state) => ({
        userName: state.userName,
        mapDot: state.mapDot,
        history: state.history,
        cities: state.cities,
        flights: state.flights
      })
    }
  )
);

export function selectGreeting(name: string): string {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 12) {
    return `Good Morning, ${name}.`;
  }
  if (hours >= 12 && hours < 17) {
    return `Good Afternoon, ${name}.`;
  }
  return `Good Evening, ${name}.`;
}

export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function computeRemainingKm(active: ActiveFlightState | null): number {
  if (!active) {
    return 0;
    }
  const totalSeconds = active.durationMinutes * 60;
  const progress = totalSeconds === 0 ? 0 : Math.min(1, active.elapsedSeconds / totalSeconds);
  return Math.max(0, Math.round(active.distanceKm * (1 - progress)));
}

export function computePlaneProgress(active: ActiveFlightState | null): number {
  if (!active) {
    return 0;
  }
  const total = active.durationMinutes * 60;
  return total === 0 ? 0 : Math.min(1, active.elapsedSeconds / total);
}
