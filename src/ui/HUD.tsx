import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { WEATHER_CONFIGS, type WeatherType, type PetType } from '../game/core/constants';
import { selectCoins, selectEquippedPet, selectTotalProduceCount } from '../state/selectors';
import { audioManager } from '../game/audio/AudioManager';
import { useNetStore } from '../game/multiplayer/netStore';
import { useAuthStore } from '../features/auth/authStore';
import { isVerdantMode } from '../game/core/gameMode';

export interface HUDProps {
  className?: string;
}

interface CoinDelta {
  amount: number;
  id: number;
}

function getWeatherIcon(weather: WeatherType) {
  switch (weather) {
    case 'heavy_rain':
      return (
        <span role="img" aria-label="Heavy Rain">
          🌧️
        </span>
      );
    case 'heatwave':
      return (
        <span role="img" aria-label="Heatwave">
          🌡️
        </span>
      );
    case 'blood_moon':
      return (
        <span role="img" aria-label="Blood Moon">
          🩸
        </span>
      );
    case 'sunny':
    default:
      return (
        <span role="img" aria-label="Sunny">
          ☀️
        </span>
      );
  }
}

function getPetIcon(type: PetType) {
  switch (type) {
    case 'dog':
      return (
        <span role="img" aria-label="Dog">
          🐶
        </span>
      );
    case 'bee':
      return (
        <span role="img" aria-label="Bee">
          🐝
        </span>
      );
    case 'pig':
      return (
        <span role="img" aria-label="Pig">
          🐷
        </span>
      );
  }
}

function getPetPerkSummary(type: PetType): string {
  switch (type) {
    case 'dog':
      return 'Auto-Harvest';
    case 'bee':
      return '+15% Speed';
    case 'pig':
      return '+20% Mutation';
  }
}

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const HUD: React.FC<HUDProps> = ({ className = '' }) => {
  const coins = useGameStore(selectCoins);
  const weather = useGameStore((state) => state.weather);
  const equippedPet = useGameStore(selectEquippedPet);
  const totalProduceCount = useGameStore(selectTotalProduceCount);
  const activeModal = useUiStore((state) => state.activeModal);

  // Coin delta animation state
  const prevCoinsRef = useRef<number>(coins);
  const isInitialMountRef = useRef<boolean>(true);
  const [coinDelta, setCoinDelta] = useState<CoinDelta | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return Boolean(document.fullscreenElement);
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    audioManager.playSfx('ui_click');
    if (typeof document === 'undefined') return;

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevCoinsRef.current = coins;
      return;
    }

    const diff = coins - prevCoinsRef.current;
    prevCoinsRef.current = coins;

    if (diff !== 0) {
      const deltaItem: CoinDelta = { amount: diff, id: Date.now() };
      setCoinDelta(deltaItem);

      const timer = setTimeout(() => {
        setCoinDelta((current) => (current?.id === deltaItem.id ? null : current));
      }, 1800);

      return () => clearTimeout(timer);
    }
  }, [coins]);

  // Weather countdown ticker (sim-aware: follows fast-forwarded sim time)
  const lastSavedUtcMs = useGameStore((state) => state.lastSavedUtcMs);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const simNow = Math.max(now, lastSavedUtcMs || 0);
  const weatherDef = WEATHER_CONFIGS[weather.current] ?? WEATHER_CONFIGS.sunny;
  const remainingWeatherMs = Math.max(0, weather.endsAtUtcMs - simNow);
  const formattedTimer = useMemo(() => formatCountdown(remainingWeatherMs), [remainingWeatherMs]);

  // Inventory toggle
  const handleToggleInventory = useCallback(() => {
    audioManager.playSfx('ui_click');
    if (activeModal === 'inventory') {
      useUiStore.getState().closeModal();
    } else {
      useUiStore.getState().openModal('inventory');
    }
  }, [activeModal]);

  // Settings toggle
  const handleToggleSettings = useCallback(() => {
    audioManager.playSfx('ui_click');
    if (activeModal === 'settings') {
      useUiStore.getState().closeModal();
    } else {
      useUiStore.getState().openModal('settings');
    }
  }, [activeModal]);

  const netQuality = useNetStore((state) => state.quality);
  const authUsername = useAuthStore((state) => state.session?.username ?? null);
  const isVerdant = useMemo(() => isVerdantMode(), []);

  const handleOpenLeaderboard = useCallback(() => {
    audioManager.playSfx('ui_click');
    useUiStore.getState().openModal('leaderboard');
  }, []);

  return (
    <header
      data-testid="hud-container"
      className={`fixed top-0 left-0 right-0 pointer-events-none z-30 flex items-start justify-between gap-2 p-2 sm:p-3 md:p-4 select-none ${className}`}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* ========================================== */}
      {/* Left Region: Coins & Weather Widget        */}
      {/* ========================================== */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap pointer-events-none">
        {/* Connection-quality indicator: verdant-only, only when degraded (PRD §14.2) */}
        {isVerdant && netQuality !== 'connected' && (
          <div
            data-testid="hud-connection-indicator"
            role="status"
            className="px-2.5 py-1 rounded-xl bg-red-950/90 border border-red-400/50 text-red-200 font-bold text-[10px] sm:text-xs shadow-lg"
          >
            {netQuality === 'degraded' ? '⚠ Reconnecting…' : '⚠ Offline'}
          </div>
        )}
        {isVerdant && authUsername && (
          <div
            data-testid="hud-username-badge"
            className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-emerald-400/30 text-emerald-200 font-bold text-[10px] sm:text-xs shadow-lg"
          >
            👤 {authUsername}
          </div>
        )}

        {/* 1. Coin Counter & Animated Delta */}
        <div
          data-testid="hud-coin-counter"
          className="pointer-events-auto relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-amber-500/30 text-amber-300 font-mono font-bold text-xs sm:text-sm md:text-base shadow-lg"
          title="Coins"
        >
          <span className="text-base" role="img" aria-label="Coin">
            🪙
          </span>
          <span>{coins.toLocaleString()}</span>

          {/* Animated Delta Badge */}
          {coinDelta && (
            <span
              key={coinDelta.id}
              data-testid="hud-coin-delta"
              className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold font-mono px-1.5 py-0.5 rounded-md bg-slate-950/90 border shadow-md animate-in fade-in zoom-in-95 duration-200 ${
                coinDelta.amount > 0
                  ? 'text-emerald-400 border-emerald-500/40'
                  : 'text-rose-400 border-rose-500/40'
              }`}
            >
              {coinDelta.amount > 0 ? `+${coinDelta.amount}` : `${coinDelta.amount}`}
            </span>
          )}
        </div>

        {/* 2. Weather Widget */}
        <div
          data-testid="hud-weather-widget"
          className="pointer-events-auto flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/15 text-slate-100 text-xs sm:text-sm shadow-lg"
          title={`${weatherDef.name}: ${weatherDef.description}`}
        >
          <div className="text-base sm:text-lg flex items-center">
            {getWeatherIcon(weather.current)}
          </div>

          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-200 capitalize truncate max-w-[80px] sm:max-w-none">
                {weatherDef.name}
              </span>
              <span
                data-testid="hud-weather-timer"
                className="font-mono text-[11px] sm:text-xs text-amber-300 font-semibold"
              >
                {formattedTimer}
              </span>
            </div>

            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
              {weatherDef.mutationType !== 'none' && (
                <span className="text-amber-300/90 uppercase tracking-wider text-[9px]">
                  {weatherDef.mutationChance * 100}% {weatherDef.mutationType}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* 3. Equipped Pet Chip */}
        <div
          data-testid="hud-pet-chip"
          className="pointer-events-auto flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/15 text-slate-100 text-xs sm:text-sm shadow-lg"
        >
          {equippedPet ? (
            <>
              <div className="text-base sm:text-lg flex items-center">
                {getPetIcon(equippedPet.type)}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-slate-200 capitalize text-xs sm:text-sm">
                  {equippedPet.type}
                </span>
                <span
                  data-testid="hud-pet-perk"
                  className="text-[10px] text-emerald-400 font-medium truncate max-w-[70px] sm:max-w-none"
                >
                  {getPetPerkSummary(equippedPet.type)}
                </span>
              </div>
            </>
          ) : (
            <div
              data-testid="hud-no-pet"
              className="flex items-center gap-1.5 text-slate-400 text-xs font-medium"
            >
              <span className="text-sm">🐾</span>
              <span className="hidden sm:inline">No Pet</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* Center Region: Arcade Quick Navigation Bar */}
      {/* (SEEDS [Blue] | GARDEN [Green] | SELL [Red])*/}
      {/* ========================================== */}
      <div
        data-testid="hud-arcade-nav"
        className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 mx-auto"
      >
        <button
          type="button"
          data-testid="hud-nav-seeds"
          aria-label="Open Seed Shop"
          onClick={() => {
            audioManager.playSfx('ui_click');
            useUiStore.getState().openModal('shop', { initialTab: 'seeds' });
          }}
          className="px-3 sm:px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg border-2 border-blue-400 cursor-pointer transition-transform duration-100 flex items-center gap-1.5"
        >
          <span>🌱</span>
          <span>SEEDS</span>
        </button>

        <button
          type="button"
          data-testid="hud-nav-garden"
          aria-label="Close Modals / Focus Garden"
          onClick={() => {
            audioManager.playSfx('ui_click');
            useUiStore.getState().closeModal();
          }}
          className="px-3 sm:px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg border-2 border-emerald-400 cursor-pointer transition-transform duration-100 flex items-center gap-1.5"
        >
          <span>🏡</span>
          <span>GARDEN</span>
        </button>

        <button
          type="button"
          data-testid="hud-nav-sell"
          aria-label="Open Sell Market"
          onClick={() => {
            audioManager.playSfx('ui_click');
            useUiStore.getState().openModal('shop', { initialTab: 'sell' });
          }}
          className="px-3 sm:px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg border-2 border-rose-400 cursor-pointer transition-transform duration-100 flex items-center gap-1.5"
        >
          <span>💰</span>
          <span>SELL</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* Right Region: Inventory & Settings Buttons */}
      {/* ========================================== */}
      <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-none">
        {/* Inventory Toggle Button */}
        <button
          type="button"
          data-testid="hud-inventory-button"
          aria-label="Toggle Inventory"
          aria-pressed={activeModal === 'inventory'}
          onClick={handleToggleInventory}
          className={`pointer-events-auto min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5 border shadow-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer ${
            activeModal === 'inventory'
              ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200 ring-2 ring-emerald-400/30'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200 hover:text-white'
          }`}
        >
          <span className="text-base sm:text-lg" role="img" aria-label="Inventory">
            🎒
          </span>
          <span className="text-xs font-bold hidden md:inline">Inventory</span>

          {totalProduceCount > 0 && (
            <span
              data-testid="hud-produce-count-badge"
              className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-emerald-600 text-white shadow-sm"
            >
              {totalProduceCount}
            </span>
          )}
        </button>

        {/* Leaderboard Button (verdant-only; opens accessible Top 10 mirror) */}
        {isVerdant && (
          <button
            type="button"
            data-testid="hud-leaderboard-button"
            aria-label="Open Leaderboard"
            aria-pressed={activeModal === 'leaderboard'}
            onClick={handleOpenLeaderboard}
            className={`pointer-events-auto min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 border shadow-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
              activeModal === 'leaderboard'
                ? 'bg-amber-950/90 border-amber-400/60 text-amber-200 ring-2 ring-amber-400/30'
                : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200 hover:text-white'
            }`}
          >
            <span className="text-base sm:text-lg" role="img" aria-hidden="true">
              🏆
            </span>
            <span className="text-xs font-bold hidden lg:inline">Top 10</span>
          </button>
        )}

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          data-testid="hud-fullscreen-button"
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-pressed={isFullscreen}
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className={`pointer-events-auto min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 border shadow-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer ${
            isFullscreen
              ? 'bg-sky-950/90 border-sky-400/60 text-sky-200 ring-2 ring-sky-400/30'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200 hover:text-white'
          }`}
        >
          <span className="text-base sm:text-lg select-none" role="img" aria-hidden="true">
            {isFullscreen ? '🗗' : '⛶'}
          </span>
          <span className="text-xs font-bold hidden lg:inline">
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          data-testid="hud-settings-button"
          aria-label="Open Settings"
          aria-pressed={activeModal === 'settings'}
          onClick={handleToggleSettings}
          className={`pointer-events-auto min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5 border shadow-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
            activeModal === 'settings'
              ? 'bg-amber-950/90 border-amber-400/60 text-amber-200 ring-2 ring-amber-400/30'
              : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/15 text-slate-200 hover:text-white'
          }`}
        >
          <span className="text-base sm:text-lg" role="img" aria-label="Settings">
            ⚙️
          </span>
          <span className="text-xs font-bold hidden md:inline">Settings</span>
        </button>
      </div>
    </header>
  );
};
