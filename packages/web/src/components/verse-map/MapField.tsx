// verse-map — MapField presentational component (Backlog 4.1, sub-slice 3:
// first real .tsx component migration of the most-complex feature).
// Migrated faithfully from verse-map.jsx (l.1493). Pure: label + body in a row.
import React from "react";

export interface MapFieldProps {
  label: React.ReactNode;
  body: React.ReactNode;
}

export function MapField({ label, body }: MapFieldProps): React.ReactElement {
  return (
    <div className="cx-map-field-row">
      <span className="cx-map-field-lbl">{label}</span>
      <span className="cx-map-field-bd">{body}</span>
    </div>
  );
}
