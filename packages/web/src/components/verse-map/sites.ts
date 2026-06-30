// verse-map — static site/route registries (Backlog 4.1, sub-slice 12).
//
// Extracted faithfully from verse-map.jsx (l.1703–1745). Pure data. The legacy
// assigned these to window.CODEX_BIBLE_SITES / _MANUSCRIPT_SITES / _PILGRIM_ROUTES
// (documented globals consumed by plugins); when main.ts swaps in the migrated
// verse-map, the bridge re-exposes them on window for back-compat.

export interface BibleSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  refs: string[];
  note: string;
}

export interface ManuscriptSite {
  name: string;
  lat: number;
  lng: number;
  note: string;
}

export interface PilgrimRoute {
  name: string;
  color: string;
  note: string;
  path: Array<[number, number]>;
}

export const BIBLE_SITES: BibleSite[] = [
  { id: "jerusalem-temple-mount", name: "Temple Mount", lat: 31.778, lng: 35.2354, refs: ["2chr.3.1", "matt.24.1"], note: "Site of Solomon's and Herod's Temples." },
  { id: "garden-of-gethsemane", name: "Gethsemane", lat: 31.7796, lng: 35.2398, refs: ["matt.26.36"], note: "Olive grove where Jesus prayed before his arrest." },
  { id: "via-dolorosa", name: "Via Dolorosa", lat: 31.779, lng: 35.233, refs: ["luke.23.26"], note: "Traditional route Jesus walked to crucifixion." },
  { id: "bethlehem", name: "Bethlehem", lat: 31.7054, lng: 35.2024, refs: ["luke.2.4"], note: "Birthplace of Jesus and King David." },
  { id: "nazareth", name: "Nazareth", lat: 32.7019, lng: 35.2972, refs: ["matt.2.23"], note: "Boyhood home of Jesus." },
  { id: "capernaum", name: "Capernaum", lat: 32.881, lng: 35.575, refs: ["matt.4.13"], note: "Jesus' Galilean ministry base." },
  { id: "sea-of-galilee", name: "Sea of Galilee", lat: 32.8333, lng: 35.59, refs: ["matt.4.18"], note: "Waters Jesus walked on; many miracles here." },
  { id: "mount-of-beatitudes", name: "Mt. of Beatitudes", lat: 32.8806, lng: 35.5536, refs: ["matt.5.1"], note: "Hill of the Sermon on the Mount." },
  { id: "jericho", name: "Jericho", lat: 31.8569, lng: 35.4442, refs: ["josh.6.20"], note: "Walls fell to Joshua; oldest continuously inhabited city." },
  { id: "jordan-river-baptism", name: "Qasr al-Yahud", lat: 31.8378, lng: 35.53, refs: ["matt.3.13"], note: "Traditional baptism site of Jesus." },
  { id: "qumran", name: "Qumran", lat: 31.7414, lng: 35.4592, refs: [], note: "Dead Sea Scrolls discovery site." },
  { id: "masada", name: "Masada", lat: 31.3158, lng: 35.3535, refs: [], note: "Herodian fortress; last Jewish stand against Rome 73 CE." },
  { id: "mount-sinai", name: "Mt. Sinai (Jebel Musa)", lat: 28.5392, lng: 33.975, refs: ["exod.19.20"], note: "Traditional site of the giving of the Law." },
  { id: "athens-areopagus", name: "Areopagus", lat: 37.9716, lng: 23.7233, refs: ["acts.17.22"], note: "Where Paul addressed the philosophers." },
  { id: "ephesus", name: "Ephesus", lat: 37.9395, lng: 27.3417, refs: ["acts.19.1"], note: "Major Pauline mission city; Temple of Artemis." },
  { id: "rome-mamertine", name: "Mamertine Prison", lat: 41.893, lng: 12.4845, refs: [], note: "Traditional site of Peter's and Paul's imprisonment." },
  { id: "patmos", name: "Patmos", lat: 37.3081, lng: 26.55, refs: ["rev.1.9"], note: "Where John received the Apocalypse." },
  { id: "antioch", name: "Antioch", lat: 36.2021, lng: 36.1604, refs: ["acts.11.26"], note: "Disciples first called Christians here." },
  { id: "damascus-straight-st", name: "Straight Street", lat: 33.5118, lng: 36.307, refs: ["acts.9.11"], note: "Paul's conversion led him here." },
  { id: "babylon-ruins", name: "Babylon", lat: 32.5424, lng: 44.4209, refs: ["dan.1.1"], note: "Nebuchadnezzar's capital; Jewish exile." },
  { id: "nineveh", name: "Nineveh", lat: 36.359, lng: 43.153, refs: ["jonah.3.3"], note: "Assyrian capital Jonah preached to." },
  { id: "ur", name: "Ur", lat: 30.9626, lng: 46.103, refs: ["gen.11.31"], note: "Abraham's birthplace." },
  { id: "mt-ararat", name: "Mt. Ararat", lat: 39.7019, lng: 44.2983, refs: ["gen.8.4"], note: "Traditional resting place of the Ark." },
  { id: "tabgha", name: "Tabgha", lat: 32.8731, lng: 35.5483, refs: ["john.21.9"], note: "Multiplication of loaves and fishes." },
  { id: "caesarea-maritima", name: "Caesarea Maritima", lat: 32.5018, lng: 34.892, refs: ["acts.10.1"], note: "Roman provincial capital; Cornelius converted." },
  { id: "hebron-machpelah", name: "Cave of Machpelah", lat: 31.5246, lng: 35.1108, refs: ["gen.23.19"], note: "Burial place of Abraham, Sarah, Isaac, Rebekah." },
];

export const MANUSCRIPT_SITES: ManuscriptSite[] = [
  { name: "Qumran (Dead Sea Scrolls)", lat: 31.7414, lng: 35.4592, note: "Scrolls found 1947–1956." },
  { name: "Nag Hammadi", lat: 26.05, lng: 32.24, note: "Gnostic codices found 1945." },
  { name: "St. Catherine's Monastery", lat: 28.5559, lng: 33.976, note: "Codex Sinaiticus discovered here 1844." },
  { name: "Cairo Geniza", lat: 30.005, lng: 31.233, note: "Vast medieval Jewish manuscript cache." },
  { name: "Oxyrhynchus", lat: 28.5333, lng: 30.65, note: "Greek papyri including early Gospel fragments." },
];

export const PILGRIM_ROUTES: PilgrimRoute[] = [
  { name: "Via Dolorosa", color: "#d1a45a", note: "Jerusalem — Stations of the Cross", path: [[31.7811, 35.2347], [31.7803, 35.2338], [31.779, 35.233], [31.7785, 35.232], [31.7783, 35.2304]] },
  { name: "Camino de Santiago", color: "#7cf", note: "Pyrenees → Santiago de Compostela", path: [[43.1626, -1.238], [42.8125, -1.6458], [42.552, -2.855], [42.546, -5.67], [42.88, -8.5448]] },
  { name: "Jesus Trail", color: "#9bd66b", note: "Nazareth → Capernaum (~65 km)", path: [[32.7019, 35.2972], [32.76, 35.35], [32.82, 35.45], [32.8731, 35.5483], [32.881, 35.575]] },
  { name: "Hajj approach", color: "#e29b6b", note: "Historical pilgrim route to Mecca (Damascus branch)", path: [[33.5118, 36.307], [31.95, 35.91], [29.532, 35.006], [25.2854, 39.09], [21.4225, 39.8262]] },
];
