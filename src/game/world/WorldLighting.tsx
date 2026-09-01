import React from 'react';
import { WeatherRenderer } from '../weather/WeatherRenderer';

/**
 * WorldLighting delegates to WeatherRenderer for 2-second crossfades,
 * atmospheric lights, soft shadows, and scene fog.
 */
export const WorldLighting: React.FC = () => {
  return <WeatherRenderer />;
};

