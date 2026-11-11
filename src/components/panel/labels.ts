import type { StationKind, Zone } from "../../lib/types";

export const ZONE_LABEL: Record<Zone, string> = {
  urban: "Urban",
  dense: "Dense old city",
  industrial: "Industrial belt",
  hill: "Hill / hard rock",
  periurban: "Growing outskirts",
  coastal: "Coastal",
};

export const KIND_LABEL: Record<StationKind, string> = {
  piezometer: "Piezometer",
  borewell: "Borewell",
  openwell: "Open well",
};
