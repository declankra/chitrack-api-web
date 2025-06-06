import React from 'react';
import { Card } from '@/components/ui/card';
import { MapPin, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import RouteIndicator from '@/components/shared/RouteIndicator';
import { filterStaleArrivals } from '@/lib/utilities/timeUtils';
import { useTime } from '@/lib/providers/TimeProvider';
import type { Station, StationStop, Arrival } from '@/lib/types/cta';
import ArrivalTimeDisplay from '@/components/shared/ArrivalTimeDisplay';

interface FavoriteStopCardProps {
  station: Station;
  stop: StationStop;
  arrivals?: Arrival[];
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}

/**
 * FavoriteStopCard component - displays a favorite stop with arrivals
 */
export const FavoriteStopCard: React.FC<FavoriteStopCardProps> = ({
  station,
  stop,
  arrivals,
  isLoading,
  isError,
  className
}) => {
  // Use the centralized time provider instead of a local timer
  const { currentTime } = useTime();
  
  // Filter stale arrivals
  const filteredArrivals = React.useMemo(() => {
    if (!arrivals) return [];
    return filterStaleArrivals(arrivals, 2, currentTime);
  }, [arrivals, currentTime]);
  
  // --- Derive Display Info from Arrivals (or fallback) ---
  const displayInfo = React.useMemo(() => {
    if (filteredArrivals && filteredArrivals.length > 0) {
      // Use the first arrival's data as representative
      const firstArrival = filteredArrivals[0];
      return {
        stationName: firstArrival.staNm,
        directionName: firstArrival.stpDe || 'Direction Info Unavailable' // Use stpDe
      };
    } else {
      // Fallback to static props if no current arrivals
      return {
        stationName: station.stationName,
        directionName: stop.directionName || 'Direction Info Unavailable' // Use GTFS directionName
      };
    }
  }, [filteredArrivals, station, stop]);
  // --- End Derive Display Info ---
  
  return (
    <Card className={cn('p-4 rounded-lg', className)}>
      {/* Favorite stop header - Updated to use derived displayInfo */}
      <div className="flex items-center mb-3">
        <div className="flex items-center gap-2 min-w-0"> {/* Added min-w-0 */} 
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-grow">
            <h3 className="font-semibold truncate" title={displayInfo.stationName}>{displayInfo.stationName}</h3>
            <p className="text-xs text-muted-foreground truncate" title={displayInfo.directionName}>{displayInfo.directionName}</p>
          </div>
        </div>
      </div>
      
      {/* Arrivals content */}
      {isLoading ? (
        <div className="flex justify-center py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-2 px-3 bg-destructive/10 text-destructive rounded-md">
          <AlertCircle className="h-4 w-4 mr-2" />
          <p className="text-sm">Failed to load arrivals</p>
        </div>
      ) : !filteredArrivals.length ? (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">No upcoming arrivals</p>
          <p className="text-xs text-muted-foreground mt-1">
            {arrivals && arrivals.length > 0 
              ? "Next trains are not arriving soon" 
              : "No trains currently scheduled"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredArrivals.slice(0, 2).map((arrival, idx) => (
            <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2">
                <RouteIndicator route={arrival.rt} size="sm" />
                <div>
                  <p className="font-medium text-sm">{arrival.destNm}</p>
                </div>
              </div>
              <ArrivalTimeDisplay arrival={arrival} currentTime={currentTime} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default FavoriteStopCard;