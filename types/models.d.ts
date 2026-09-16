export interface Refinery {
  id: string;
  name: string;
  coordinates: [number, number];
  country: string | null;
  capacity: number | null;
  capacityBpd: number | null;
  owner: string | null;
  status: "Active" | "Closed" | "Modernization" | "Unknown";
  age: number | null;
  validCoordinates: boolean;
  raw: Record<string, unknown>;
  method: string;
}
export interface Country {
  id: string;
  name: string;
  nameRu: string;
  center: [number, number];
  bounds: [number, number, number, number];
  values: Record<string, number | null>;
  years: Record<string, number | null>;
  raw: Record<string, unknown>;
  priceUnit: string | null;
  priceDate: string | null;
}
