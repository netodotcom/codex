// reader — gnosis inline distribution (migrated from components.jsx). When the
// gnosis layer is engaged, the panelData.gnosis entries are distributed as small
// inline cards spaced evenly between verses, so the reader becomes a meditative
// two-column experience: scripture + gnosis. Pure: maps verse/gnosis counts to
// "verseN → gnosis entry index".

export function gnosisInsertionPoints(verseCount: number, gnosisCount: number): Map<number, number> {
  const points = new Map<number, number>();
  if (!gnosisCount || !verseCount) return points;
  for (let i = 0; i < gnosisCount; i++) {
    const at = Math.max(1, Math.round((verseCount * (i + 1)) / (gnosisCount + 1)));
    points.set(at, i);
  }
  return points;
}
