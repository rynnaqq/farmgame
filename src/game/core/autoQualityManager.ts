export type EffectiveQualityLevel = 'low' | 'medium' | 'high';
export type QualityPreset = 'auto' | EffectiveQualityLevel;

export interface AutoQualityConfig {
  fpsStepDownThreshold: number; // 45 FPS
  fpsStepUpThreshold: number; // 58 FPS
  stepDownDurationSec: number; // 5 seconds
  stepUpDurationSec: number; // 30 seconds
  cooldownDurationSec: number; // 10 seconds
}

export const DEFAULT_AUTO_QUALITY_CONFIG: AutoQualityConfig = {
  fpsStepDownThreshold: 45,
  fpsStepUpThreshold: 58,
  stepDownDurationSec: 5,
  stepUpDurationSec: 30,
  cooldownDurationSec: 10,
};

export interface QualityStepResult {
  stepped: boolean;
  direction?: 'up' | 'down';
  previousQuality: EffectiveQualityLevel;
  newQuality: EffectiveQualityLevel;
  currentFps: number;
  averageFps: number;
  underThresholdSeconds: number;
  overThresholdSeconds: number;
  cooldownRemainingSeconds: number;
}

/**
 * Steps quality up or down by one discrete step.
 * 'high' -> 'medium' -> 'low' (down)
 * 'low' -> 'medium' -> 'high' (up)
 */
export function stepQualityLevel(
  current: EffectiveQualityLevel,
  direction: 'up' | 'down'
): EffectiveQualityLevel {
  if (direction === 'down') {
    switch (current) {
      case 'high':
        return 'medium';
      case 'medium':
        return 'low';
      case 'low':
      default:
        return 'low';
    }
  } else {
    switch (current) {
      case 'low':
        return 'medium';
      case 'medium':
        return 'high';
      case 'high':
      default:
        return 'high';
    }
  }
}

/**
 * Checks if the development diagnostics panel is enabled via URL param (?debug=1, ?debug=true)
 * or via window.__DEBUG__ flag.
 */
export function isDiagnosticsEnabled(
  searchOrUrl?: string,
  globalWindow?: { __DEBUG__?: boolean; location?: { search?: string } }
): boolean {
  // 1. Check explicit search / url string if provided
  if (typeof searchOrUrl === 'string' && searchOrUrl.length > 0) {
    try {
      const queryString = searchOrUrl.includes('?')
        ? searchOrUrl.slice(searchOrUrl.indexOf('?'))
        : searchOrUrl.includes('=')
          ? `?${searchOrUrl}`
          : searchOrUrl;

      const params = new URLSearchParams(queryString);
      for (const [key, value] of params.entries()) {
        if (key.toLowerCase() === 'debug') {
          const val = value.toLowerCase();
          if (val === '1' || val === 'true') {
            return true;
          }
        }
      }
    } catch {
      // Fallback regex
    }

    if (/[?&]debug=(1|true)/i.test(searchOrUrl)) {
      return true;
    }
  }

  // 2. Check provided globalWindow or window
  const win =
    globalWindow ??
    (typeof window !== 'undefined'
      ? (window as unknown as { __DEBUG__?: boolean; location?: { search?: string } })
      : null);
  if (win) {
    if (win.__DEBUG__ === true) {
      return true;
    }
    if (win.location && typeof win.location.search === 'string') {
      const search = win.location.search;
      if (/[?&]debug=(1|true)/i.test(search)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * AutoQualityManager monitors rolling frame rates and manages hysteresis timers
 * to automatically step effective quality down (<45 FPS for 5s) or up (>58 FPS for 30s),
 * with a mandatory 10-second cooldown between transitions.
 */
export class AutoQualityManager {
  private config: AutoQualityConfig;
  private currentFps: number = 60;
  private averageFps: number = 60;
  private underThresholdSec: number = 0;
  private overThresholdSec: number = 0;
  private cooldownRemainingSec: number = 0;

  constructor(config: Partial<AutoQualityConfig> = {}) {
    this.config = { ...DEFAULT_AUTO_QUALITY_CONFIG, ...config };
    this.reset();
  }

  /**
   * Resets all internal timers and rolling averages.
   */
  public reset(): void {
    this.currentFps = 60;
    this.averageFps = 60;
    this.underThresholdSec = 0;
    this.overThresholdSec = 0;
    this.cooldownRemainingSec = 0;
  }

  /**
   * Records a frame step and evaluates if quality level should transition.
   */
  public update(
    deltaSec: number,
    qualityPreset: QualityPreset,
    currentEffective: EffectiveQualityLevel
  ): QualityStepResult {
    const clampedDelta = Math.max(deltaSec, 0.0001);
    this.currentFps = 1.0 / clampedDelta;

    // Exponential moving average (weight 0.1 for new frame, 0.9 for history)
    if (this.averageFps === 0) {
      this.averageFps = this.currentFps;
    } else {
      this.averageFps = this.averageFps * 0.9 + this.currentFps * 0.1;
    }

    // Tick down cooldown timer
    if (this.cooldownRemainingSec > 0) {
      this.cooldownRemainingSec = Math.max(0, this.cooldownRemainingSec - deltaSec);
    }

    // If preset is not 'auto', skip auto-stepping and reset timers
    if (qualityPreset !== 'auto') {
      this.underThresholdSec = 0;
      this.overThresholdSec = 0;
      return {
        stepped: false,
        previousQuality: currentEffective,
        newQuality: currentEffective,
        currentFps: this.currentFps,
        averageFps: this.averageFps,
        underThresholdSeconds: this.underThresholdSec,
        overThresholdSeconds: this.overThresholdSec,
        cooldownRemainingSeconds: this.cooldownRemainingSec,
      };
    }

    // Step-Down check: average FPS < 45 for >= 5 consecutive seconds.
    // Uses the EMA (not the instantaneous frame) so single hitches from
    // shader compiles or GC pauses cannot yank the quality down.
    if (this.averageFps < this.config.fpsStepDownThreshold) {
      this.underThresholdSec += deltaSec;
      this.overThresholdSec = 0;

      if (
        this.underThresholdSec >= this.config.stepDownDurationSec &&
        this.cooldownRemainingSec <= 0 &&
        currentEffective !== 'low'
      ) {
        const newQuality = stepQualityLevel(currentEffective, 'down');
        this.cooldownRemainingSec = this.config.cooldownDurationSec;
        this.underThresholdSec = 0;
        return {
          stepped: true,
          direction: 'down',
          previousQuality: currentEffective,
          newQuality,
          currentFps: this.currentFps,
          averageFps: this.averageFps,
          underThresholdSeconds: this.underThresholdSec,
          overThresholdSeconds: this.overThresholdSec,
          cooldownRemainingSeconds: this.cooldownRemainingSec,
        };
      }
    }
    // Step-Up check: average FPS > 58 for >= 30 consecutive seconds
    else if (this.averageFps > this.config.fpsStepUpThreshold) {
      this.overThresholdSec += deltaSec;
      this.underThresholdSec = 0;

      if (
        this.overThresholdSec >= this.config.stepUpDurationSec &&
        this.cooldownRemainingSec <= 0 &&
        currentEffective !== 'high'
      ) {
        const newQuality = stepQualityLevel(currentEffective, 'up');
        this.cooldownRemainingSec = this.config.cooldownDurationSec;
        this.overThresholdSec = 0;
        return {
          stepped: true,
          direction: 'up',
          previousQuality: currentEffective,
          newQuality,
          currentFps: this.currentFps,
          averageFps: this.averageFps,
          underThresholdSeconds: this.underThresholdSec,
          overThresholdSeconds: this.overThresholdSec,
          cooldownRemainingSeconds: this.cooldownRemainingSec,
        };
      }
    } else {
      // Within stable 45 - 58 FPS range; reset consecutive timers
      this.underThresholdSec = 0;
      this.overThresholdSec = 0;
    }

    return {
      stepped: false,
      previousQuality: currentEffective,
      newQuality: currentEffective,
      currentFps: this.currentFps,
      averageFps: this.averageFps,
      underThresholdSeconds: this.underThresholdSec,
      overThresholdSeconds: this.overThresholdSec,
      cooldownRemainingSeconds: this.cooldownRemainingSec,
    };
  }

  /**
   * Returns current internal metrics for diagnostics.
   */
  public getMetrics(): {
    currentFps: number;
    averageFps: number;
    underSec: number;
    overSec: number;
    cooldownRemainingSec: number;
  } {
    return {
      currentFps: this.currentFps,
      averageFps: this.averageFps,
      underSec: this.underThresholdSec,
      overSec: this.overThresholdSec,
      cooldownRemainingSec: this.cooldownRemainingSec,
    };
  }
}

export const autoQualityManager = new AutoQualityManager();
