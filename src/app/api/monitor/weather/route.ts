// src/app/api/monitor/weather/route.ts
import { NextResponse } from 'next/server';
import type {
  WeatherData,
  WeatherCondition,
  WeatherAlert,
  HourlyForecast,
  WeatherResponse,
} from '@/lib/types/monitor';

export const dynamic = 'force-dynamic';

// Chicago coordinates
const CHICAGO_LAT = 41.8781;
const CHICAGO_LON = -87.6298;

// Weather.gov API endpoints
const WEATHER_GOV_POINTS = `https://api.weather.gov/points/${CHICAGO_LAT},${CHICAGO_LON}`;

interface WeatherGovPointsResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
    observationStations: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
  };
}

interface WeatherGovForecastResponse {
  properties: {
    periods: Array<{
      number: number;
      name: string;
      startTime: string;
      endTime: string;
      isDaytime: boolean;
      temperature: number;
      temperatureUnit: string;
      windSpeed: string;
      windDirection: string;
      icon: string;
      shortForecast: string;
      detailedForecast: string;
    }>;
  };
}

interface WeatherGovObservationResponse {
  properties: {
    timestamp: string;
    textDescription: string;
    icon: string;
    temperature: {
      value: number | null;
      unitCode: string;
    };
    dewpoint: {
      value: number | null;
      unitCode: string;
    };
    windDirection: {
      value: number | null;
    };
    windSpeed: {
      value: number | null;
      unitCode: string;
    };
    windGust: {
      value: number | null;
      unitCode: string;
    };
    barometricPressure: {
      value: number | null;
      unitCode: string;
    };
    visibility: {
      value: number | null;
      unitCode: string;
    };
    relativeHumidity: {
      value: number | null;
    };
    heatIndex: {
      value: number | null;
    };
    windChill: {
      value: number | null;
    };
  };
}

interface WeatherGovAlertsResponse {
  features: Array<{
    properties: {
      id: string;
      event: string;
      headline: string;
      description: string;
      severity: string;
      urgency: string;
      certainty: string;
      effective: string;
      expires: string;
      senderName: string;
    };
  }>;
}

// Convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

// Convert m/s to mph
function msToMph(ms: number): number {
  return Math.round(ms * 2.237);
}

// Convert meters to miles
function metersToMiles(meters: number): number {
  return Math.round(meters / 1609.34 * 10) / 10;
}

// Map Weather.gov conditions to our types
function mapCondition(description: string): WeatherCondition {
  const desc = description.toLowerCase();
  if (desc.includes('clear') || desc.includes('sunny')) return 'clear';
  if (desc.includes('partly cloudy') || desc.includes('partly sunny')) return 'partly-cloudy';
  if (desc.includes('mostly cloudy')) return 'cloudy';
  if (desc.includes('overcast')) return 'overcast';
  if (desc.includes('thunderstorm')) return 'thunderstorm';
  if (desc.includes('heavy rain') || desc.includes('heavy shower')) return 'heavy-rain';
  if (desc.includes('rain') || desc.includes('shower') || desc.includes('drizzle')) return 'rain';
  if (desc.includes('blizzard')) return 'blizzard';
  if (desc.includes('heavy snow')) return 'heavy-snow';
  if (desc.includes('snow') || desc.includes('flurries')) return 'snow';
  if (desc.includes('fog')) return 'fog';
  if (desc.includes('mist')) return 'mist';
  if (desc.includes('haze') || desc.includes('hazy')) return 'haze';
  if (desc.includes('wind')) return 'windy';
  return 'cloudy';
}

// Get cardinal direction from degrees
function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Map severity
function mapAlertSeverity(severity: string): 'minor' | 'moderate' | 'severe' | 'extreme' {
  switch (severity.toLowerCase()) {
    case 'extreme':
      return 'extreme';
    case 'severe':
      return 'severe';
    case 'moderate':
      return 'moderate';
    default:
      return 'minor';
  }
}

// Map urgency
function mapAlertUrgency(urgency: string): 'immediate' | 'expected' | 'future' | 'past' | 'unknown' {
  switch (urgency.toLowerCase()) {
    case 'immediate':
      return 'immediate';
    case 'expected':
      return 'expected';
    case 'future':
      return 'future';
    case 'past':
      return 'past';
    default:
      return 'unknown';
  }
}

// Map certainty
function mapAlertCertainty(certainty: string): 'observed' | 'likely' | 'possible' | 'unlikely' | 'unknown' {
  switch (certainty.toLowerCase()) {
    case 'observed':
      return 'observed';
    case 'likely':
      return 'likely';
    case 'possible':
      return 'possible';
    case 'unlikely':
      return 'unlikely';
    default:
      return 'unknown';
  }
}

export async function GET() {
  try {
    // Fetch Weather.gov points data to get API endpoints
    const pointsResponse = await fetch(WEATHER_GOV_POINTS, {
      headers: {
        'User-Agent': 'ChiTrack (chitrack.app)',
        'Accept': 'application/geo+json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!pointsResponse.ok) {
      throw new Error(`Failed to fetch weather points: ${pointsResponse.status}`);
    }

    const pointsData: WeatherGovPointsResponse = await pointsResponse.json();

    // Fetch current observation and forecasts in parallel
    const [observationRes, forecastRes, alertsRes] = await Promise.all([
      // Get observation stations then fetch latest observation
      fetch(pointsData.properties.observationStations, {
        headers: { 'User-Agent': 'ChiTrack (chitrack.app)' },
      })
        .then((res) => res.json())
        .then((data) => {
          const stationUrl = data.features?.[0]?.id;
          if (!stationUrl) throw new Error('No observation station found');
          return fetch(`${stationUrl}/observations/latest`, {
            headers: { 'User-Agent': 'ChiTrack (chitrack.app)' },
            next: { revalidate: 300 }, // 5 minutes
          });
        }),

      // Fetch forecast
      fetch(pointsData.properties.forecast, {
        headers: { 'User-Agent': 'ChiTrack (chitrack.app)' },
        next: { revalidate: 1800 }, // 30 minutes
      }),

      // Fetch alerts
      fetch(`https://api.weather.gov/alerts/active?point=${CHICAGO_LAT},${CHICAGO_LON}`, {
        headers: { 'User-Agent': 'ChiTrack (chitrack.app)' },
        next: { revalidate: 300 }, // 5 minutes
      }),
    ]);

    const observationData: WeatherGovObservationResponse = await observationRes.json();
    const forecastData: WeatherGovForecastResponse = await forecastRes.json();
    const alertsData: WeatherGovAlertsResponse = await alertsRes.json();

    const obs = observationData.properties;

    // Build current weather data
    const tempCelsius = obs.temperature?.value ?? 20;
    const temperature = celsiusToFahrenheit(tempCelsius);

    const feelsLikeCelsius = obs.heatIndex?.value ?? obs.windChill?.value ?? tempCelsius;
    const feelsLike = celsiusToFahrenheit(feelsLikeCelsius);

    const windSpeedMs = obs.windSpeed?.value ?? 0;
    const windSpeed = msToMph(windSpeedMs);

    const windGustMs = obs.windGust?.value;
    const windGust = windGustMs ? msToMph(windGustMs) : undefined;

    const visibilityMeters = obs.visibility?.value ?? 16000;
    const visibility = metersToMiles(visibilityMeters);

    const windDirection = obs.windDirection?.value ?? 0;

    // Get sunrise/sunset (approximate for Chicago)
    const now = new Date();
    const sunriseHour = 5 + Math.floor((now.getMonth() - 6) ** 2 / 10);
    const sunsetHour = 20 - Math.floor((now.getMonth() - 6) ** 2 / 10);
    const sunrise = `${sunriseHour}:30 AM`;
    const sunset = `${sunsetHour - 12}:30 PM`;

    const current: WeatherData = {
      temperature,
      feelsLike,
      condition: mapCondition(obs.textDescription || 'clear'),
      conditionDescription: obs.textDescription || 'Clear',
      icon: obs.icon || '',
      humidity: obs.relativeHumidity?.value ?? 50,
      pressure: obs.barometricPressure?.value
        ? Math.round(obs.barometricPressure.value / 100) // Convert Pa to hPa
        : 1013,
      windSpeed,
      windGust,
      windDirection,
      windDirectionCardinal: getCardinalDirection(windDirection),
      visibility,
      cloudCover: 0, // Not available from observations
      uvIndex: 0, // Not available from observations
      dewPoint: obs.dewpoint?.value ? celsiusToFahrenheit(obs.dewpoint.value) : 50,
      precipitation: {
        probability: 0, // Would need forecast data
        type: 'none',
        amount: 0,
      },
      sunrise,
      sunset,
    };

    // Build hourly forecast from forecast periods
    const forecast: HourlyForecast[] = forecastData.properties.periods.slice(0, 12).map((period) => ({
      time: period.startTime,
      temperature: period.temperature,
      condition: mapCondition(period.shortForecast),
      icon: period.icon,
      precipProbability: 0, // Not directly available
      windSpeed: parseInt(period.windSpeed.split(' ')[0]) || 0,
    }));

    // Build alerts
    const alerts: WeatherAlert[] = alertsData.features.map((feature) => ({
      id: feature.properties.id,
      event: feature.properties.event,
      headline: feature.properties.headline,
      description: feature.properties.description,
      severity: mapAlertSeverity(feature.properties.severity),
      urgency: mapAlertUrgency(feature.properties.urgency),
      certainty: mapAlertCertainty(feature.properties.certainty),
      start: feature.properties.effective,
      end: feature.properties.expires,
      senderName: feature.properties.senderName,
    }));

    const response: WeatherResponse = {
      current,
      forecast,
      alerts,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
