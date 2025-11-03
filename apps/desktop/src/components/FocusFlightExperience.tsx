import { useEffect, useMemo, useState, useRef, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AnimatedNumbers from "react-animated-numbers";
import {
  useFocusStore,
  selectGreeting,
  formatCountdown,
  computeRemainingKm,
  computePlaneProgress,
  type ActiveFlightState,
  type City,
  type CompletedFlightEntry,
  type FakeFlight,
  type FocusType
} from "../state/focus-store";
import { CITY_DATA } from "../data/cities";
import { FLIGHT_DATA } from "../data/fake-flights";

const FOCUS_TYPES: FocusType[] = ["Work", "Study", "Meditate", "Read"];
const SEAT_ROWS = 6;
const SEAT_COLUMNS = 4;

// Smart animated number component - only animates digits that change
function SmartAnimatedNumber({ value }: { value: number }) {
  const [prevValue, setPrevValue] = useState(value);
  const valueStr = String(value);
  const prevValueStr = String(prevValue);

  useEffect(() => {
    // Delay updating prevValue to allow animation to complete
    const timer = setTimeout(() => {
      setPrevValue(value);
    }, 650); // Slightly longer than animation duration
    return () => clearTimeout(timer);
  }, [value]);

  // Pad strings to same length for comparison
  const maxLen = Math.max(valueStr.length, prevValueStr.length);
  const paddedCurrent = valueStr.padStart(maxLen, '0');
  const paddedPrev = prevValueStr.padStart(maxLen, '0');

  return (
    <span style={{ display: 'inline-flex' }}>
      {paddedCurrent.split('').map((digit, index) => {
        const isChanging = digit !== paddedPrev[index];
        const isLeadingZero = index < maxLen - valueStr.length;

        if (isLeadingZero) return null;

        if (isChanging) {
          return (
            <AnimatedNumbers
              key={`${index}-animated`}
              animateToNumber={parseInt(digit)}
              fontStyle={{
                fontSize: 36,
                fontWeight: 700,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
              }}
              transitions={(idx) => ({
                type: "spring",
                duration: 0.6,
                bounce: 0
              })}
            />
          );
        }

        return (
          <span key={`${index}-static`} style={{
            fontSize: 36,
            fontWeight: 700,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
          }}>
            {digit}
          </span>
        );
      })}
    </span>
  );
}

export default function FocusFlightExperience(): ReactElement {
  const view = useFocusStore((state) => state.view);
  const userName = useFocusStore((state) => state.userName);
  const mapDot = useFocusStore((state) => state.mapDot);
  const hydrateSeed = useFocusStore((state) => state.hydrateSeed);
  const cities = useFocusStore((state) => state.cities);
  const flights = useFocusStore((state) => state.flights);
  const draftDuration = useFocusStore((state) => state.draftDuration);
  const selectedFlight = useFocusStore((state) => state.selectedFlight);
  const selectedSeat = useFocusStore((state) => state.selectedSeat);
  const selectedFocus = useFocusStore((state) => state.selectedFocus);
  const activeFlight = useFocusStore((state) => state.activeFlight);
  const history = useFocusStore((state) => state.history);
  const panels = useFocusStore((state) => state.panels);
  const trendsRange = useFocusStore((state) => state.trendsRange);

  const goTo = useFocusStore((state) => state.goTo);
  const togglePanel = useFocusStore((state) => state.togglePanel);
  const closePanels = useFocusStore((state) => state.closePanels);
  const selectFlight = useFocusStore((state) => state.selectFlight);
  const openSeatSelection = useFocusStore((state) => state.openSeatSelection);
  const updateDuration = useFocusStore((state) => state.updateDuration);
  const selectSeat = useFocusStore((state) => state.selectSeat);
  const openFocusSelection = useFocusStore((state) => state.openFocusSelection);
  const selectFocus = useFocusStore((state) => state.selectFocus);
  const openBoardingPass = useFocusStore((state) => state.openBoardingPass);
  const startBoarding = useFocusStore((state) => state.startBoarding);
  const launchFlight = useFocusStore((state) => state.launchFlight);
  const tick = useFocusStore((state) => state.tick);
  const landFlight = useFocusStore((state) => state.landFlight);
  const abortFlight = useFocusStore((state) => state.abortFlight);
  const completeLanding = useFocusStore((state) => state.completeLanding);
  const setTrendsRange = useFocusStore((state) => state.setTrendsRange);
  const setUserName = useFocusStore((state) => state.setUserName);

  const [boardingState, setBoardingState] = useState<"idle" | "checked" | "boarding">("idle");

  useEffect(() => {
    if (!cities.length || !flights.length) {
      hydrateSeed({
        cities: CITY_DATA,
        flights: FLIGHT_DATA,
        mapDot: {
          lat: randomBetween(-45, 45),
          lng: randomBetween(-160, 160)
        }
      });
    }
  }, [cities.length, flights.length, hydrateSeed]);

  useEffect(() => {
    if (activeFlight?.status !== "airborne") {
      return undefined;
    }
    const id = window.setInterval(() => tick(), 1000);
    return () => window.clearInterval(id);
  }, [activeFlight?.sessionId, activeFlight?.status, tick]);

  useEffect(() => {
    if (view === "BOARDING_PASS") {
      setBoardingState("idle");
    }
  }, [view]);

  const greeting = selectGreeting(userName);
  const remainingKm = computeRemainingKm(activeFlight);
  const planeProgress = computePlaneProgress(activeFlight);
  const landingEntry = useMemo(() => {
    if (!activeFlight) {
      return null;
    }
    return history.find((entry) => entry.id === activeFlight.sessionId) ?? null;
  }, [history, activeFlight?.sessionId]);
  const latestCompleted = history[history.length - 1] ?? null;

  // Get time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 21) return "Good Evening";
    return "Good Night";
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      {/* Full background Map - Always visible */}
      <div className="absolute inset-0 z-0">
        <AppleMapBackdrop activeFlight={activeFlight} planeProgress={planeProgress} />
      </div>

      {/* Main Menu - Home View */}
      {view === "HOME" && (
        <>
          {/* Greeting - Top Left Corner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute left-12 top-12 z-20"
          >
            <h2 className="text-3xl font-light text-gray-600" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}>
              {getTimeBasedGreeting()}
            </h2>
            <h1 className="mt-2 text-6xl font-bold text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}>
              {userName}.
            </h1>
          </motion.div>

          {/* Left side buttons */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute left-8 bottom-8 z-20 flex flex-col gap-4"
          >
            <button
              type="button"
              onClick={() => togglePanel("history")}
              className="rounded-3xl border border-gray-300/80 bg-white/95 px-8 py-3.5 text-sm font-semibold text-gray-700 shadow-xl backdrop-blur-xl transition-all hover:scale-105 hover:border-gray-400 hover:bg-white hover:shadow-2xl"
            >
              History
            </button>
            <button
              type="button"
              onClick={() => togglePanel("trends")}
              className="rounded-3xl border border-gray-300/80 bg-white/95 px-8 py-3.5 text-sm font-semibold text-gray-700 shadow-xl backdrop-blur-xl transition-all hover:scale-105 hover:border-gray-400 hover:bg-white hover:shadow-2xl"
            >
              Trends
            </button>
            <button
              type="button"
              onClick={() => togglePanel("settings")}
              className="rounded-3xl border border-gray-300/80 bg-white/95 px-8 py-3.5 text-sm font-semibold text-gray-700 shadow-xl backdrop-blur-xl transition-all hover:scale-105 hover:border-gray-400 hover:bg-white hover:shadow-2xl"
            >
              Settings
            </button>

            {/* Start Journey button */}
            <motion.button
              type="button"
              onClick={() => {
                closePanels();
                goTo("SELECT_FLIGHT");
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="mt-2 rounded-3xl bg-gray-900 px-8 py-4 text-sm font-bold text-white shadow-2xl transition-all hover:bg-black hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
            >
              Start Journey
            </motion.button>
          </motion.div>
        </>
      )}

      {/* In-Flight Status Bar - Time left, Distance right */}
      {view === "IN_FLIGHT" && activeFlight && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute bottom-8 left-0 right-0 z-20 flex items-center justify-between px-8"
        >
          {/* Time Remaining - Extreme Left */}
          <div className="flex flex-col items-start rounded-2xl bg-white/95 px-8 py-5 shadow-xl backdrop-blur-xl">
            <span className="text-xs font-medium text-gray-500">Time Remaining</span>
            <div className="mt-2 flex items-center gap-1" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif", fontSize: 36, fontWeight: 700 }}>
              <SmartAnimatedNumber value={Math.floor(Math.max(activeFlight.durationMinutes * 60 - activeFlight.elapsedSeconds, 0) / 60)} />
              <span>:</span>
              <span style={{ minWidth: '1.5em', display: 'inline-block', textAlign: 'right' }}>
                {Math.floor(Math.max(activeFlight.durationMinutes * 60 - activeFlight.elapsedSeconds, 0) % 60) < 10 && '0'}
                <SmartAnimatedNumber value={Math.floor(Math.max(activeFlight.durationMinutes * 60 - activeFlight.elapsedSeconds, 0) % 60)} />
              </span>
            </div>
          </div>

          {/* Distance Remaining - Extreme Right */}
          <div className="flex flex-col items-end rounded-2xl bg-white/95 px-8 py-5 shadow-xl backdrop-blur-xl">
            <span className="text-xs font-medium text-gray-500">Distance</span>
            <div className="mt-2 flex items-baseline">
              <SmartAnimatedNumber value={Math.round(remainingKm)} />
              <span className="ml-2 text-2xl font-semibold text-gray-600" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}>km</span>
            </div>
          </div>

          {/* Take Off button (when ready) - center */}
          {activeFlight.status === "ready" && (
            <motion.button
              type="button"
              onClick={launchFlight}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="absolute left-1/2 -translate-x-1/2 rounded-2xl bg-blue-500 px-10 py-5 text-lg font-semibold text-white shadow-2xl transition hover:bg-blue-600"
            >
              Take Off
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Side panels */}
      <AnimatePresence mode="wait">
        {panels.history && (
          <SlidingPanel key="history" title="Flight History" onClose={closePanels} side="right">
            <HistoryPanel entries={history} />
          </SlidingPanel>
        )}
        {panels.trends && (
          <SlidingPanel key="trends" title="Focus Trends" onClose={closePanels} side="right">
            <TrendsPanel history={history} range={trendsRange} onRangeChange={setTrendsRange} />
          </SlidingPanel>
        )}
        {panels.settings && (
          <SlidingPanel key="settings" title="Settings" onClose={closePanels} side="right">
            <SettingsPanel userName={userName} onNameChange={setUserName} />
          </SlidingPanel>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence mode="wait">
        {view === "SELECT_FLIGHT" && (
          <Modal key="flight" title="Choose Your Flight" onClose={() => goTo("HOME")}>
            <FlightSelector
              flights={flights}
              duration={draftDuration}
              selectedFlight={selectedFlight}
              onSelect={selectFlight}
              onDurationChange={updateDuration}
              onSubmit={openSeatSelection}
            />
          </Modal>
        )}
        {view === "SELECT_SEAT" && selectedFlight && (
          <Modal key="seat" title="Select Your Seat" onClose={() => goTo("HOME")}>
            <SeatSelector selectedSeat={selectedSeat} onSelect={selectSeat} onSubmit={openFocusSelection} />
          </Modal>
        )}
        {view === "CONFIRM_FOCUS" && selectedFlight && selectedSeat && (
          <Modal key="focus" title="What do you want to focus on?" onClose={() => goTo("HOME")}>
            <FocusPicker selected={selectedFocus} onSelect={selectFocus} onSubmit={openBoardingPass} />
          </Modal>
        )}
        {view === "BOARDING_PASS" && selectedFlight && selectedSeat && (
          <Modal key="boarding" title="Boarding Pass" onClose={() => goTo("HOME")} size="lg">
            <BoardingPassCard
              flight={selectedFlight}
              seat={selectedSeat}
              focusType={selectedFocus ?? "Work"}
              duration={draftDuration}
              originCity={cities.find((city) => city.code === selectedFlight.origin) ?? null}
              destinationCity={cities.find((city) => city.code === selectedFlight.dest) ?? null}
              boardingState={boardingState}
              onCheckIn={() => setBoardingState("checked")}
              onBoard={() => {
                setBoardingState("boarding");
                startBoarding();
              }}
            />
          </Modal>
        )}
        {view === "LANDING" && activeFlight && (
          <Modal key="landing" title={`Welcome to ${activeFlight.destinationCity.name}!`} onClose={completeLanding} size="lg">
            <LandingSummaryOverlay
              flight={activeFlight}
              entry={landingEntry}
              achievements={computeAchievements(history)}
              onDone={completeLanding}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Animated airplane marker component with smooth Google Maps-style following
function AnimatedPlane({ position, rotation }: { position: [number, number], rotation: number }) {
  const map = useMap();
  const animationRef = useRef<number | null>(null);
  const currentPosRef = useRef<[number, number]>(position);

  useEffect(() => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startPos = map.getCenter();
    const targetPos = L.latLng(position);
    const startTime = Date.now();
    const duration = 1000; // 1 second smooth animation

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);

      const lat = startPos.lat + (targetPos.lat - startPos.lat) * eased;
      const lng = startPos.lng + (targetPos.lng - startPos.lng) * eased;

      map.panTo([lat, lng], { animate: false, duration: 0, noMoveStart: true });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    currentPosRef.current = position;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [position, map]);

  const planeIcon = L.divIcon({
    html: `
      <div style="position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;">
        <!-- Outer pulsing ring (Google Maps style) -->
        <div style="position: absolute; width: 80px; height: 80px; border-radius: 50%; background: rgba(66, 133, 244, 0.2); animation: pulse-ring 2s ease-out infinite;"></div>

        <!-- Middle ring -->
        <div style="position: absolute; width: 50px; height: 50px; border-radius: 50%; background: rgba(66, 133, 244, 0.3);"></div>

        <!-- Direction indicator arrow (rotates) -->
        <div style="transform: rotate(${rotation}deg); position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <!-- Directional chevron -->
          <div style="width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-bottom: 20px solid rgba(66, 133, 244, 0.9); position: absolute; top: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></div>
        </div>

        <!-- Center blue dot (main cursor) -->
        <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #4285f4; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(66, 133, 244, 0.4);"></div>
      </div>
    `,
    className: 'google-maps-cursor',
    iconSize: [80, 80],
    iconAnchor: [40, 40],
  });

  return <Marker position={position} icon={planeIcon} zIndexOffset={1000} />;
}

function AppleMapBackdrop({
  activeFlight,
  planeProgress
}: {
  activeFlight: ActiveFlightState | null;
  planeProgress: number;
}) {
  const mapRef = useRef<L.Map | null>(null);

  if (!activeFlight) {
    // Default map view when no flight is active
    return (
      <div className="h-full w-full relative" style={{ background: 'linear-gradient(135deg, #e8f4f8 0%, #d4e8f0 50%, #c9dce5 100%)' }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%', background: 'transparent' }}
          zoomControl={false}
          attributionControl={false}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={1}
          />
        </MapContainer>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20 pointer-events-none" />
      </div>
    );
  }

  // Get city coordinates
  const originCity = CITY_DATA.find(c => c.code === activeFlight.flight.origin);
  const destCity = CITY_DATA.find(c => c.code === activeFlight.flight.dest);

  if (!originCity || !destCity) return null;

  const originCoords: [number, number] = [originCity.lat, originCity.lng];
  const destCoords: [number, number] = [destCity.lat, destCity.lng];

  // Calculate current plane position
  const currentLat = originCoords[0] + (destCoords[0] - originCoords[0]) * planeProgress;
  const currentLng = originCoords[1] + (destCoords[1] - originCoords[1]) * planeProgress;
  const planePosition: [number, number] = [currentLat, currentLng];

  // Calculate rotation angle - plane points towards destination
  const latDiff = destCoords[0] - originCoords[0];
  const lngDiff = destCoords[1] - originCoords[1];
  const rotation = Math.atan2(lngDiff, latDiff) * 180 / Math.PI;

  // Calculate center point and bounds
  const centerLat = (originCoords[0] + destCoords[0]) / 2;
  const centerLng = (originCoords[1] + destCoords[1]) / 2;
  const center: [number, number] = [centerLat, centerLng];

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={planePosition}
        zoom={17}
        style={{ height: '100%', width: '100%', background: '#f0f0f0' }}
        zoomControl={false}
        attributionControl={false}
        ref={mapRef}
        preferCanvas={true}
        renderer={L.canvas()}
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
      >
        {/* Standard street map with smooth rendering */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={1}
          updateWhenIdle={false}
          updateWhenZooming={false}
          updateInterval={100}
          keepBuffer={10}
        />

        {/* Flight path - Google Maps style: grey for covered, blue for remaining */}
        {/* Covered portion (grey) */}
        <Polyline
          positions={[originCoords, planePosition]}
          pathOptions={{
            color: '#9ca3af',
            weight: 6,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
          }}
        />

        {/* Remaining portion (blue) */}
        <Polyline
          positions={[planePosition, destCoords]}
          pathOptions={{
            color: '#4285f4',
            weight: 6,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }}
        />

        {/* Origin marker */}
        <Marker
          position={originCoords}
          icon={L.divIcon({
            html: `<div style="width: 18px; height: 18px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 8px rgba(59,130,246,0.5);"></div>`,
            className: 'origin-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })}
        />

        {/* Destination marker */}
        <Marker
          position={destCoords}
          icon={L.divIcon({
            html: `<div style="width: 18px; height: 18px; background: #10b981; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 8px rgba(16,185,129,0.5);"></div>`,
            className: 'dest-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })}
        />

        {/* Animated Google Maps style cursor */}
        {planeProgress > 0 && planeProgress < 1 && (
          <AnimatedPlane position={planePosition} rotation={rotation} />
        )}
      </MapContainer>

      {/* 3D Perspective Tilt Effect - Creates driving/navigation view */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          linear-gradient(180deg,
            rgba(0,0,0,0.4) 0%,
            rgba(0,0,0,0.2) 15%,
            transparent 35%,
            transparent 100%
          )
        `,
        transform: 'perspective(1000px) rotateX(0deg)',
      }} />

      {/* Bottom fade for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          linear-gradient(180deg,
            transparent 0%,
            transparent 60%,
            rgba(0,0,0,0.1) 85%,
            rgba(0,0,0,0.3) 100%
          )
        `
      }} />

      {/* Horizon line effect */}
      <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(240,240,240,0.8) 0%, transparent 100%)',
        transform: 'perspective(800px) rotateX(-2deg)',
        transformOrigin: 'top center',
      }} />

      {/* Vignette for focus on center */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.15) 100%)'
      }} />

      {/* 3D Road perspective lines (subtle guides) */}
      <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-32">
        <div className="relative w-full max-w-md h-64" style={{
          background: `
            linear-gradient(to bottom,
              transparent 0%,
              transparent 40%,
              rgba(66,133,244,0.05) 70%,
              rgba(66,133,244,0.1) 100%
            )
          `,
          clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
          transform: 'perspective(500px) rotateX(45deg)',
          transformOrigin: 'bottom center',
        }} />
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  size = "md"
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const widthClass = size === "lg" ? "max-w-4xl" : size === "sm" ? "max-w-md" : "max-w-2xl";
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={clsx("pointer-events-auto w-full px-6", widthClass)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-3xl border border-gray-200 bg-white px-10 py-8 shadow-2xl macos-card">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FlightSelector({
  flights,
  duration,
  selectedFlight,
  onSelect,
  onDurationChange,
  onSubmit
}: {
  flights: FakeFlight[];
  duration: number;
  selectedFlight: FakeFlight | null;
  onSelect: (flight: FakeFlight) => void;
  onDurationChange: (minutes: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto pr-1 scrollbar-invisible md:grid-cols-2">
        {flights.map((flight) => {
          const active = selectedFlight?.id === flight.id;
          return (
            <motion.button
              key={flight.id}
              type="button"
              onClick={() => onSelect(flight)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                "rounded-xl border p-4 text-left transition-all",
                active
                  ? "border-blue-400 bg-blue-50 shadow-lg"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
              )}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">{flight.airline}</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {flight.origin} <span className="text-gray-400">→</span> {flight.dest}
              </p>
              <p className="mt-1.5 text-xs font-medium text-gray-600">Flight {flight.flightNo}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">Departs {flight.departure}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Duration</span>
          <span className="text-sm font-bold text-gray-900">{duration} min</span>
        </div>
        <input
          type="range"
          min={5}
          max={180}
          value={duration}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>5 min</span>
          <span>3 hours</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Selected Route</p>
          <p className="mt-2 font-medium text-gray-900">
            {selectedFlight ? (
              <span>
                {selectedFlight.origin} <span className="text-gray-400">→</span> {selectedFlight.dest}
              </span>
            ) : (
              <span className="text-gray-500">Select a flight to continue.</span>
            )}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={!selectedFlight}
          whileHover={selectedFlight ? { scale: 1.05 } : {}}
          whileTap={selectedFlight ? { scale: 0.95 } : {}}
          className="rounded-full bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
        >
          Book Flight
        </motion.button>
      </div>
    </div>
  );
}

function SeatSelector({
  selectedSeat,
  onSelect,
  onSubmit
}: {
  selectedSeat: string | null;
  onSelect: (seat: string) => void;
  onSubmit: () => void;
}) {
  const seats = useMemo(() => buildSeatMap(SEAT_ROWS, SEAT_COLUMNS), []);

  // Airplane cabin layout: rows A-F, columns 1-30
  const rows = Array.from({ length: 30 }, (_, i) => i + 1);
  const leftSeats = ['A', 'B', 'C'];
  const rightSeats = ['D', 'E', 'F'];

  return (
    <div className="space-y-6">
      {/* Airplane top-down view */}
      <div className="relative rounded-3xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-8">
        {/* Cockpit */}
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-32 rounded-t-full border-2 border-gray-300 bg-gray-100 flex items-end justify-center pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cockpit</span>
          </div>
        </div>

        {/* Scrollable cabin */}
        <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300">
          <div className="space-y-3">
            {/* Seat labels */}
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex gap-2">
                {leftSeats.map(seat => (
                  <div key={seat} className="w-10 text-center text-[10px] font-bold text-gray-500">{seat}</div>
                ))}
              </div>
              <div className="w-8 text-center text-[10px] font-bold text-gray-400">AISLE</div>
              <div className="flex gap-2">
                {rightSeats.map(seat => (
                  <div key={seat} className="w-10 text-center text-[10px] font-bold text-gray-500">{seat}</div>
                ))}
              </div>
            </div>

            {/* Seat rows */}
            {rows.map((row) => (
              <div key={row} className="flex items-center justify-between px-4">
                {/* Left side seats (A, B, C) */}
                <div className="flex gap-2">
                  {leftSeats.map((letter) => {
                    const seatNum = `${row}${letter}`;
                    const active = seatNum === selectedSeat;
                    const isAvailable = seats.includes(seatNum);

                    return (
                      <motion.button
                        key={seatNum}
                        type="button"
                        onClick={() => isAvailable && onSelect(seatNum)}
                        disabled={!isAvailable}
                        whileHover={isAvailable ? { scale: 1.1 } : {}}
                        whileTap={isAvailable ? { scale: 0.95 } : {}}
                        className={clsx(
                          "w-10 h-12 rounded-lg border-2 transition-all relative",
                          active
                            ? "border-blue-500 bg-blue-100 shadow-lg"
                            : isAvailable
                            ? "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                            : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-50"
                        )}
                      >
                        <span className="text-[9px] font-bold text-gray-700">{row}{letter}</span>
                        {!isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">✕</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Row number in aisle */}
                <div className="w-8 text-center">
                  <span className="text-xs font-bold text-gray-400">{row}</span>
                </div>

                {/* Right side seats (D, E, F) */}
                <div className="flex gap-2">
                  {rightSeats.map((letter) => {
                    const seatNum = `${row}${letter}`;
                    const active = seatNum === selectedSeat;
                    const isAvailable = seats.includes(seatNum);

                    return (
                      <motion.button
                        key={seatNum}
                        type="button"
                        onClick={() => isAvailable && onSelect(seatNum)}
                        disabled={!isAvailable}
                        whileHover={isAvailable ? { scale: 1.1 } : {}}
                        whileTap={isAvailable ? { scale: 0.95 } : {}}
                        className={clsx(
                          "w-10 h-12 rounded-lg border-2 transition-all relative",
                          active
                            ? "border-blue-500 bg-blue-100 shadow-lg"
                            : isAvailable
                            ? "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                            : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-50"
                        )}
                      >
                        <span className="text-[9px] font-bold text-gray-700">{row}{letter}</span>
                        {!isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">✕</div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rear of plane */}
        <div className="mt-6 flex justify-center">
          <div className="h-12 w-48 rounded-b-xl border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Lavatory</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-[10px] text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border-2 border-gray-300 bg-white"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border-2 border-blue-500 bg-blue-100"></div>
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border-2 border-gray-200 bg-gray-100 opacity-50"></div>
          <span>Occupied</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-gray-300 bg-gray-50 px-5 py-4">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-600">
          {selectedSeat ? `Seat ${selectedSeat} selected.` : "Choose your seat."}
        </span>
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={!selectedSeat}
          whileHover={selectedSeat ? { scale: 1.05 } : {}}
          whileTap={selectedSeat ? { scale: 0.95 } : {}}
          className="rounded-full bg-blue-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
        >
          Confirm Seat
        </motion.button>
      </div>
    </div>
  );
}

function FocusPicker({
  selected,
  onSelect,
  onSubmit
}: {
  selected: FocusType | null;
  onSelect: (type: FocusType) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {FOCUS_TYPES.map((type) => {
          const active = type === selected;
          return (
            <motion.button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                "rounded-2xl border p-6 text-left transition-all",
                active
                  ? "border-blue-500 bg-blue-50 shadow-lg"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
              )}
            >
              <p className="text-lg font-bold text-gray-900">{type}</p>
              <p className="mt-2 text-xs text-gray-600">Lock in this mission for the flight ahead.</p>
            </motion.button>
          );
        })}
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-gray-300 bg-gray-50 px-5 py-4">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-600">
          {selected ? `${selected} mission armed` : "Select a mission"}
        </span>
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={!selected}
          whileHover={selected ? { scale: 1.05 } : {}}
          whileTap={selected ? { scale: 0.95 } : {}}
          className="rounded-full bg-blue-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
        >
          Confirm
        </motion.button>
      </div>
    </div>
  );
}

function BoardingPassCard({
  flight,
  seat,
  focusType,
  duration,
  originCity,
  destinationCity,
  boardingState,
  onCheckIn,
  onBoard
}: {
  flight: FakeFlight;
  seat: string;
  focusType: FocusType;
  duration: number;
  originCity: City | null;
  destinationCity: City | null;
  boardingState: "idle" | "checked" | "boarding";
  onCheckIn: () => void;
  onBoard: () => void;
}) {
  const distanceKm = originCity && destinationCity ? distanceBetween(originCity, destinationCity) : null;
  const boardingTime = formatBoardingTime(2);
  const [isTearing, setIsTearing] = useState(false);
  const [barcodeHidden, setBarcodeHidden] = useState(false);

  const handleCheckIn = () => {
    setIsTearing(true);
    setTimeout(() => {
      setBarcodeHidden(true);
      onCheckIn();
    }, 800);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Boarding Pass */}
      <div className="boarding-pass relative overflow-hidden">
        {/* Top section - Main boarding pass */}
        <div className="relative bg-gradient-to-br from-gray-50 to-white p-8">
          {/* Airline header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{flight.airline}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">Boarding Pass</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-400">Flight</p>
              <p className="text-2xl font-bold text-gray-900">{flight.flightNo}</p>
            </div>
          </div>

          {/* Route */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400">From</p>
              <p className="text-6xl font-bold text-gray-900">{flight.origin}</p>
              <p className="mt-2 text-base text-gray-600">{originCity?.name ?? "Origin"}</p>
            </div>
            <div className="flex flex-col items-center justify-center px-10">
              <div className="text-5xl text-gray-300">✈</div>
              <p className="mt-3 text-sm font-bold text-gray-400">{duration} MIN</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-400">To</p>
              <p className="text-6xl font-bold text-gray-900">{flight.dest}</p>
              <p className="mt-2 text-base text-gray-600">{destinationCity?.name ?? "Destination"}</p>
            </div>
          </div>

          {/* Flight details grid */}
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-400">Boarding Time</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{boardingTime}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Seat</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{seat}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Focus Type</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{focusType}</p>
            </div>
            {distanceKm !== null && (
              <div>
                <p className="text-xs font-medium text-gray-400">Distance</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{distanceKm} km</p>
              </div>
            )}
          </div>

          {/* Circular notches for tear effect */}
          {!barcodeHidden && (
            <>
              <div className="absolute -left-4 bottom-0 h-8 w-8 translate-y-1/2 rounded-full bg-white"></div>
              <div className="absolute -right-4 bottom-0 h-8 w-8 translate-y-1/2 rounded-full bg-white"></div>
            </>
          )}
        </div>

        {/* Perforation line with dashed border */}
        {!barcodeHidden && <div className="perforation"></div>}

        {/* Bottom section with barcode - disappears when checked in */}
        {!barcodeHidden && (
          <div className={clsx("barcode-section bg-gradient-to-br from-white to-gray-50 p-8", isTearing && "tearing")}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-400">Passenger Name</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">Focus Traveler</p>
                <p className="mt-6 text-xs font-medium text-gray-400">Confirmation Code</p>
                <p className="mt-2 font-mono text-lg font-bold text-gray-700">{flight.flightNo}{seat}</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <Barcode />
                <p className="text-xs font-medium text-gray-400">Scan at gate</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 p-6">
          <motion.button
            type="button"
            onClick={handleCheckIn}
            disabled={boardingState !== "idle"}
            whileHover={boardingState === "idle" ? { scale: 1.05 } : {}}
            whileTap={boardingState === "idle" ? { scale: 0.95 } : {}}
            className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {boardingState === "checked" ? "Checked In" : "Check In"}
          </motion.button>
          <motion.button
            type="button"
            onClick={onBoard}
            disabled={boardingState === "idle"}
            whileHover={boardingState !== "idle" ? { scale: 1.05 } : {}}
            whileTap={boardingState !== "idle" ? { scale: 0.95 } : {}}
            className="flex-1 rounded-xl bg-blue-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            {boardingState === "boarding" ? "Boarding..." : "Board Flight"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function LandingSummaryOverlay({
  flight,
  entry,
  achievements,
  onDone
}: {
  flight: ActiveFlightState;
  entry: CompletedFlightEntry | null;
  achievements: AchievementBadge[];
  onDone: () => void;
}) {
  const duration = entry?.durationMinutes ?? flight.durationMinutes;
  const distanceKm = entry?.distanceKm ?? flight.distanceKm;
  const miles = entry?.miles ?? Math.round(distanceKm * 0.621);
  const focus = entry?.focusType ?? flight.focusType;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Flight Complete!</p>
        <h3 className="mt-4 text-3xl font-bold text-white">Welcome to {flight.destinationCity.name}.</h3>
        <p className="mt-4 text-sm text-white/60">
          {duration} minute focus · {distanceKm} km ({miles} miles) · {focus}.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {achievements.map((achievement) => (
          <div
            key={achievement.key}
            className={clsx(
              "rounded-2xl border p-5",
              achievement.unlocked
                ? "border-blue-400/60 bg-blue-500/20 shadow-lg shadow-blue-500/10"
                : "border-white/10 bg-white/5 text-white/50"
            )}
          >
            <p className="text-sm font-bold">{achievement.title}</p>
            <p className="mt-2 text-xs text-white/50">{achievement.description}</p>
            {achievement.unlocked && (
              <p className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-white/50">Unlocked.</p>
            )}
          </div>
        ))}
      </div>
      <motion.button
        type="button"
        onClick={onDone}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-full bg-blue-500 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-500/40 transition hover:bg-blue-600"
      >
        Continue
      </motion.button>
    </div>
  );
}

function SlidingPanel({
  title,
  children,
  onClose,
  side
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  side: "left" | "right";
}) {
  return (
    <motion.aside
      className={clsx(
        "pointer-events-auto absolute inset-y-0 z-50 w-96 border-white/10 bg-black/40 p-8 backdrop-blur-2xl shadow-2xl",
        side === "left" ? "left-0 border-r" : "right-0 border-l"
      )}
      initial={{ x: side === "left" ? -400 : 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: side === "left" ? -400 : 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-white/80 transition hover:bg-white/20"
        >
          Close
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>{children}</div>
    </motion.aside>
  );
}

function HistoryPanel({ entries }: { entries: CompletedFlightEntry[] }) {
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm text-white/50">No flights logged yet.</p>
        <p className="mt-2 text-xs text-white/30">Start a journey to build your history.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {[...entries].reverse().map((entry) => (
        <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-white">
              {entry.flight.origin} <span className="text-blue-400">→</span> {entry.flight.dest}
            </p>
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
              {entry.durationMinutes}min
            </span>
          </div>
          <p className="mt-2 text-sm text-white/60">
            Seat {entry.seat} · {entry.focusType} · Flight {entry.flight.flightNo}
          </p>
          <p className="mt-2 text-xs text-white/40">{new Date(entry.startAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

function TrendsPanel({
  history,
  range,
  onRangeChange
}: {
  history: CompletedFlightEntry[];
  range: "week" | "month" | "year";
  onRangeChange: (range: "week" | "month" | "year") => void;
}) {
  const metrics = useMemo(() => {
    const uniqueAirports = new Set<string>();
    let distance = 0;
    let minutes = 0;
    for (const entry of history) {
      uniqueAirports.add(entry.flight.origin);
      uniqueAirports.add(entry.flight.dest);
      distance += entry.distanceKm;
      minutes += entry.durationMinutes;
    }
    return {
      flights: history.length,
      airports: uniqueAirports.size,
      distance,
      minutes
    };
  }, [history]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["week", "month", "year"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onRangeChange(option)}
            className={clsx(
              "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
              range === option
                ? "border-blue-400/60 bg-blue-500/20 text-white"
                : "border-white/10 bg-white/5 text-white/50 hover:border-blue-400/40 hover:text-white"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <MetricCard label="Flights" value={metrics.flights.toString()} />
        <MetricCard label="Airports" value={metrics.airports.toString()} />
        <MetricCard label="Distance" value={`${metrics.distance} km`} />
        <MetricCard label="Focus Time" value={`${metrics.minutes} min`} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function SettingsPanel({ userName, onNameChange }: { userName: string; onNameChange: (name: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Call Sign</label>
        <input
          value={userName}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/50"
        />
      </div>
      <button
        type="button"
        className="w-full rounded-full border border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wider text-white/40 transition hover:border-white/20"
      >
        Export Data (CSV)
      </button>
      <p className="text-[10px] text-white/30">Export feature coming soon.</p>
    </div>
  );
}

function Barcode() {
  // Generate realistic barcode pattern (Code 128 style)
  const barcodePattern = [
    3, 1, 1, 2, 2, 3, 1, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 3,
    2, 2, 1, 1, 3, 1, 2, 2, 1, 3, 2, 1, 1, 3, 2, 2, 1, 2, 3, 1,
    1, 2, 1, 3, 2, 1, 3, 1, 2, 2, 3, 1, 1, 2, 2, 3
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* macOS-style barcode */}
      <svg width="140" height="90" viewBox="0 0 140 90" className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <g>
          {barcodePattern.map((width, i) => {
            const x = barcodePattern.slice(0, i).reduce((sum, w) => sum + w, 0) * 1.8;
            return (
              <rect
                key={i}
                x={x}
                y={i % 3 === 0 ? 0 : i % 2 === 0 ? 3 : 0}
                width={width * 1.8}
                height={i % 3 === 0 ? 90 : i % 2 === 0 ? 84 : 90}
                fill="#1d1d1f"
              />
            );
          })}
        </g>
      </svg>
      <p className="font-mono text-xs font-medium tracking-widest text-gray-500">
        *FF{Math.random().toString(36).substring(2, 8).toUpperCase()}*
      </p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}

function buildSeatMap(rows: number, columns: number): string[] {
  const seats: string[] = [];
  const letters = "ABCDEF"; // Only first 6 letters for realistic airplane seating
  // Generate all possible seats (30 rows x 6 seats = 180 seats)
  for (let row = 1; row <= 30; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      seats.push(`${row}${letters[column]}`);
    }
  }
  return seats;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function distanceBetween(a: City, b: City): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
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

function formatBoardingTime(minutesFromNow: number): string {
  const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
}

function computeAchievements(history: CompletedFlightEntry[]): AchievementBadge[] {
  const totalMiles = history.reduce((sum, entry) => sum + entry.miles, 0);
  const flights = history.length;
  const uniqueCities = new Set<string>();
  history.forEach((entry) => {
    uniqueCities.add(entry.flight.origin);
    uniqueCities.add(entry.flight.dest);
  });
  const definitions: AchievementBadge[] = [
    {
      key: "first-flight",
      title: "First Flight",
      description: "Complete your very first journey.",
      unlocked: flights >= 1
    },
    {
      key: "hundred-miles",
      title: "100 Miles",
      description: "Log 100 cumulative miles.",
      unlocked: totalMiles >= 100
    },
    {
      key: "frequent-flyer",
      title: "Frequent Flyer",
      description: "Complete 5 flights.",
      unlocked: flights >= 5
    },
    {
      key: "world-hopper",
      title: "World Hopper",
      description: "Visit 10 unique airports.",
      unlocked: uniqueCities.size >= 10
    }
  ];
  return definitions;
}
