import React, { useMemo, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesAtlas from 'world-atlas/countries-110m.json';

export type MapStyleMode = 'matrix' | 'hologram' | 'orbital';

interface WorldMapBackdropProps {
  className?: string;
  glow?: boolean;
  activePulse?: boolean;
  mode?: MapStyleMode;
  onModeChange?: (mode: MapStyleMode) => void;
  showHudControls?: boolean;
}

interface HubDefinition {
  id: string;
  name: string;
  coords: [number, number]; // [longitude, latitude]
}

const GLOBAL_HUBS: HubDefinition[] = [
  { id: 'paris', name: 'PARIS', coords: [2.3522, 48.8566] },
  { id: 'dakar', name: 'DAKAR', coords: [-17.4677, 14.7167] },
  { id: 'newyork', name: 'NEW YORK', coords: [-74.006, 40.7128] },
  { id: 'sanfrancisco', name: 'SAN FRANCISCO', coords: [-122.4194, 37.7749] },
  { id: 'saopaulo', name: 'SÃO PAULO', coords: [-46.6333, -23.5505] },
  { id: 'cairo', name: 'CAIRO', coords: [31.2357, 30.0444] },
  { id: 'dubai', name: 'DUBAI', coords: [55.2708, 25.2048] },
  { id: 'singapore', name: 'SINGAPORE', coords: [103.8198, 1.3521] },
  { id: 'tokyo', name: 'TOKYO', coords: [139.6917, 35.6895] },
  { id: 'sydney', name: 'SYDNEY', coords: [151.2093, -33.8688] },
];

const FLIGHT_ROUTES: Array<{ from: string; to: string; reverse?: boolean; width?: number }> = [
  { from: 'sanfrancisco', to: 'newyork', width: 1.4 },
  { from: 'newyork', to: 'paris', width: 1.8 },
  { from: 'paris', to: 'dakar', reverse: true, width: 1.6 },
  { from: 'paris', to: 'dubai', width: 1.5 },
  { from: 'dubai', to: 'singapore', width: 1.5 },
  { from: 'singapore', to: 'tokyo', width: 1.5 },
  { from: 'dakar', to: 'saopaulo', reverse: true, width: 1.4 },
  { from: 'singapore', to: 'sydney', width: 1.5 },
];

// 5 nuances cartographiques harmonisées pour distinguer chaque pays voisin
// sans surcharger l'arrière-plan derrière l'aigle
const COUNTRY_TONE_CLASSES = [
  'fill-sky-200/80 dark:fill-sky-900/55',
  'fill-slate-200/85 dark:fill-slate-800/75',
  'fill-cyan-100/85 dark:fill-cyan-950/70',
  'fill-blue-100/85 dark:fill-blue-950/65',
  'fill-indigo-100/80 dark:fill-slate-700/70',
];

const ANTARCTICA_NUMERIC_ID = '010';

interface CountryShape {
  key: string;
  id: string;
  name: string;
  d: string;
  toneClass: string;
}

interface ProjectedHub {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface ProjectedArc {
  id: string;
  d: string;
  reverse: boolean;
  width: number;
}

export const WorldMapBackdrop: React.FC<WorldMapBackdropProps> = ({
  className = '',
  glow = true,
  activePulse = false,
}) => {
  const [activeHub, setActiveHub] = useState<string>('paris');

  const mapData = useMemo(() => {
    const topology = countriesAtlas as unknown as Topology<{
      countries: GeometryCollection<{ name?: string }>;
      land: GeometryCollection;
    }>;

    const rawCountriesObj = topology.objects.countries;
    const filteredGeometries = rawCountriesObj.geometries.filter(
      (geom) => String(geom.id ?? '') !== ANTARCTICA_NUMERIC_ID
    );

    const inhabitedCountriesObj: GeometryCollection<{ name?: string }> = {
      type: 'GeometryCollection',
      geometries: filteredGeometries,
    };

    const countriesCollection = feature(topology, inhabitedCountriesObj);

    // Projection Natural Earth 1 calibrée proprement dans le viewBox 1000x500
    const projection = geoNaturalEarth1().fitExtent(
      [
        [18, 16],
        [982, 484],
      ],
      countriesCollection
    );

    const pathGenerator = geoPath(projection);

    // Coloration de graphe gloutonne : aucun pays adjacent ne partage la même nuance
    const countryNeighbors = neighbors(filteredGeometries);
    const assignedColors = new Array<number>(filteredGeometries.length).fill(-1);

    for (let i = 0; i < filteredGeometries.length; i++) {
      const usedByNeighbors = new Set<number>();
      for (const nIdx of countryNeighbors[i] || []) {
        if (assignedColors[nIdx] !== -1) {
          usedByNeighbors.add(assignedColors[nIdx]);
        }
      }
      let colorIndex = 0;
      while (usedByNeighbors.has(colorIndex) && colorIndex < COUNTRY_TONE_CLASSES.length - 1) {
        colorIndex++;
      }
      if (usedByNeighbors.has(colorIndex)) {
        colorIndex = i % COUNTRY_TONE_CLASSES.length;
      }
      assignedColors[i] = colorIndex;
    }

    const countryShapes: CountryShape[] = countriesCollection.features
      .map((feat, idx) => {
        const d = pathGenerator(feat);
        if (!d) return null;
        const countryId = String(feat.id ?? idx);
        const countryName = String(feat.properties?.name ?? '');
        return {
          key: `${countryId}-${idx}`,
          id: countryId,
          name: countryName,
          d,
          toneClass: COUNTRY_TONE_CLASSES[assignedColors[idx] ?? 0],
        };
      })
      .filter((item): item is CountryShape => item !== null);

    // Frontières internes nettes entre pays distincts
    const internalBordersPath =
      pathGenerator(mesh(topology, inhabitedCountriesObj, (a, b) => a !== b)) ?? '';

    // Contours côtiers extérieurs nets (littoraux et îles)
    const coastlinesPath =
      pathGenerator(mesh(topology, inhabitedCountriesObj, (a, b) => a === b)) ?? '';

    const graticulePath = pathGenerator(geoGraticule10()) ?? '';
    const spherePath = pathGenerator({ type: 'Sphere' }) ?? '';

    const projectedHubMap = new Map<string, ProjectedHub>();
    const projectedHubs: ProjectedHub[] = [];

    for (const hub of GLOBAL_HUBS) {
      const point = projection(hub.coords);
      if (point) {
        const projected: ProjectedHub = {
          id: hub.id,
          name: hub.name,
          x: Number(point[0].toFixed(2)),
          y: Number(point[1].toFixed(2)),
        };
        projectedHubMap.set(hub.id, projected);
        projectedHubs.push(projected);
      }
    }

    const projectedArcs: ProjectedArc[] = FLIGHT_ROUTES.map((route) => {
      const start = projectedHubMap.get(route.from);
      const end = projectedHubMap.get(route.to);
      if (!start || !end) return null;

      const midX = (start.x + end.x) / 2;
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      const arcLift = Math.min(72, Math.max(18, dist * 0.22));
      const ctrlY = Math.min(start.y, end.y) - arcLift;

      return {
        id: `${route.from}-${route.to}`,
        d: `M ${start.x} ${start.y} Q ${midX.toFixed(2)} ${ctrlY.toFixed(2)}, ${end.x} ${end.y}`,
        reverse: Boolean(route.reverse),
        width: route.width ?? 1.5,
      };
    }).filter((arc): arc is ProjectedArc => arc !== null);

    return {
      countryShapes,
      internalBordersPath,
      coastlinesPath,
      graticulePath,
      spherePath,
      projectedHubs,
      projectedArcs,
    };
  }, []);

  return (
    <div className={`absolute inset-0 pointer-events-none select-none overflow-hidden ${className}`}>
      <style>{`
        @keyframes dash-travel-fast {
          0% {
            stroke-dashoffset: 400;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        .flight-arc-travel {
          stroke-dasharray: 7, 11;
          animation: dash-travel-fast 14s linear infinite;
        }

        .flight-arc-travel-reverse {
          stroke-dasharray: 6, 12;
          animation: dash-travel-fast 11s linear infinite reverse;
        }
      `}</style>

      {/* Halo atmosphérique discret derrière le globe */}
      {glow && (
        <div className="absolute inset-0 flex items-center justify-center -z-10">
          <div className="w-[540px] sm:w-[740px] h-[290px] rounded-full bg-gradient-to-r from-sky-500/10 via-cyan-400/12 to-indigo-500/10 blur-3xl" />
        </div>
      )}

      <svg
        viewBox="0 0 1000 500"
        className="w-full h-full object-contain opacity-90 dark:opacity-95"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="modernFlightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#00D2FF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.28" />
          </linearGradient>

          <filter id="hubGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Contour sphérique du globe et grille méridiens / parallèles */}
        {mapData.spherePath && (
          <path
            d={mapData.spherePath}
            className="fill-sky-50/35 dark:fill-[#0B1322]/45 stroke-sky-300/45 dark:stroke-cyan-500/20"
            strokeWidth="0.9"
          />
        )}

        {mapData.graticulePath && (
          <path
            d={mapData.graticulePath}
            fill="none"
            className="stroke-sky-400/20 dark:stroke-cyan-400/12"
            strokeWidth="0.45"
          />
        )}

        {/* Onde discrète au centre lors du cri de l'aigle */}
        {activePulse && (
          <circle
            cx="500"
            cy="250"
            r="195"
            fill="none"
            stroke="#00D2FF"
            strokeWidth="1.6"
            className="animate-ping"
            strokeOpacity="0.55"
          />
        )}

        {/* COUCHE 1 : PAYS DISTINCTS (Chaque pays tracé individuellement avec sa nuance) */}
        <g>
          {mapData.countryShapes.map((country) => (
            <path
              key={country.key}
              d={country.d}
              className={`${country.toneClass} transition-colors duration-300`}
              stroke="none"
            />
          ))}
        </g>

        {/* COUCHE 2 : FRONTIÈRES NETTES ENTRE LES PAYS */}
        {mapData.internalBordersPath && (
          <path
            d={mapData.internalBordersPath}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-white/95 dark:stroke-cyan-300/40"
            strokeWidth="0.72"
          />
        )}

        {/* COUCHE 3 : LITTORAUX ET CONTOURS EXTÉRIEURS TRANCHÉS */}
        {mapData.coastlinesPath && (
          <path
            d={mapData.coastlinesPath}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-sky-600/55 dark:stroke-sky-400/65"
            strokeWidth="0.85"
          />
        )}

        {/* COUCHE 4 : CORRIDORS DE VOL RELIANT LES VÉRITABLES COORDONNÉES */}
        <g fill="none">
          {mapData.projectedArcs.map((arc) => (
            <path
              key={arc.id}
              d={arc.d}
              stroke="url(#modernFlightGrad)"
              strokeWidth={arc.width}
              strokeOpacity="0.75"
              className={arc.reverse ? 'flight-arc-travel-reverse' : 'flight-arc-travel'}
            />
          ))}
        </g>

        {/* COUCHE 5 : BALISES DES GRANDES VILLES CALÉES SUR LA PROJECTION */}
        <g filter="url(#hubGlow)">
          {mapData.projectedHubs.map((hub) => {
            const isTarget = activeHub === hub.id;
            return (
              <g key={hub.id} onClick={() => setActiveHub(hub.id)}>
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={isTarget ? 6.5 : 5}
                  fill="none"
                  className="stroke-sky-500/75 dark:stroke-cyan-300/80 animate-ping"
                  strokeWidth="1"
                  style={{ animationDuration: hub.id === 'paris' || hub.id === 'dakar' ? '2.2s' : '3.4s' }}
                />
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={isTarget ? 3.2 : 2.3}
                  className="fill-sky-600 dark:fill-cyan-300"
                />
                <circle cx={hub.x} cy={hub.y} r="1" fill="#FFFFFF" />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
