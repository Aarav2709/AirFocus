declare module "react-simple-maps" {
  import type { FC, ReactNode } from "react";

  export interface ComposableMapProps {
    projectionConfig?: Record<string, unknown>;
    className?: string;
    children?: ReactNode;
  }
  export const ComposableMap: FC<ComposableMapProps>;

  export interface GeographyShape {
    rsmKey: string;
    [key: string]: unknown;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: GeographyShape[] }) => ReactNode;
  }
  export const Geographies: FC<GeographiesProps>;

  export interface GeographyProps {
    geography: GeographyShape | object;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }
  export const Geography: FC<GeographyProps>;

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }
  export const Marker: FC<MarkerProps>;

  export interface LineProps {
    coordinates: [[number, number], [number, number]];
    stroke?: string;
    strokeWidth?: number;
    strokeLinecap?: string;
  }
  export const Line: FC<LineProps>;
}
