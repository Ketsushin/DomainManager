/**
 * constants.js
 * Alle Regelwerte des Domain Managers.
 * Hier lassen sich Berufe, Gebäude, Sterberaten und Schwellenwerte anpassen,
 * ohne andere Skripte anfassen zu müssen.
 */

// ---------------------------------------------------------------------------
// Jahreszeiten und ihre Produktionsmultiplikatoren
// ---------------------------------------------------------------------------
export const SEASONS = {
  spring: { label: "Frühling", foodBonus: 1.2, woodBonus: 1.0, stoneBonus: 1.0 },
  summer: { label: "Sommer",   foodBonus: 1.5, woodBonus: 1.0, stoneBonus: 1.1 },
  autumn: { label: "Herbst",   foodBonus: 1.3, woodBonus: 1.2, stoneBonus: 1.0 },
  winter: { label: "Winter",   foodBonus: 0.5, woodBonus: 0.8, stoneBonus: 0.7 }
};

// ---------------------------------------------------------------------------
// Berufe – Wochenproduktion pro Siedler (bei 100 % Effizienz)
// ---------------------------------------------------------------------------
export const PROFESSIONS = {
  none:       { label: "Keine / Unzugewiesen", foodProd: 0, woodProd: 0, stoneProd: 0, goldProd: 0 },
  farmer:     { label: "Bauer",               foodProd: 3, woodProd: 0, stoneProd: 0, goldProd: 0 },
  hunter:     { label: "Jäger",               foodProd: 2, woodProd: 0, stoneProd: 0, goldProd: 0 },
  lumberjack: { label: "Holzfäller",          foodProd: 0, woodProd: 2, stoneProd: 0, goldProd: 0 },
  miner:      { label: "Bergmann",            foodProd: 0, woodProd: 0, stoneProd: 2, goldProd: 0 },
  merchant:   { label: "Händler",             foodProd: 0, woodProd: 0, stoneProd: 0, goldProd: 2 },
  guard:      { label: "Wächter",             foodProd: 0, woodProd: 0, stoneProd: 0, goldProd: 0 },
  builder:    { label: "Baumeister",          foodProd: 0, woodProd: 0, stoneProd: 0, goldProd: 0 },
  healer:     { label: "Heiler",              foodProd: 0, woodProd: 0, stoneProd: 0, goldProd: 0 }
};

// ---------------------------------------------------------------------------
// Gebäudetypen
// workerWeeksRequired: Wie viele Arbeiter-Wochen nötig sind
// cost:               Ressourcenkosten beim Start des Projekts (optional, zur Anzeige)
// capacityBonus:      Wie viele Siedler zusätzlich ernährt/beherbergt werden können
// productionBonus:    Wöchentlicher Bonus, wenn Gebäude fertig ist
// ---------------------------------------------------------------------------
export const BUILDING_TYPES = {
  farm: {
    label: "Gehöft",
    description: "Erweiterte Anbaufläche – erhöht Nahrungskapazität und -produktion.",
    workerWeeksRequired: 4,
    cost: { food: 0, wood: 10, stone: 5, gold: 0 },
    capacityBonus: 5,
    productionBonus: { food: 2, wood: 0, stone: 0, gold: 0 }
  },
  hunting_grounds: {
    label: "Jagdrevier",
    description: "Erschlossene Jagdgründe steigern Fleischversorgung.",
    workerWeeksRequired: 2,
    cost: { food: 0, wood: 5, stone: 0, gold: 0 },
    capacityBonus: 3,
    productionBonus: { food: 1, wood: 0, stone: 0, gold: 0 }
  },
  sawmill: {
    label: "Sägewerk",
    description: "Mechanisierte Holzverarbeitung steigert Holzproduktion.",
    workerWeeksRequired: 6,
    cost: { food: 0, wood: 5, stone: 10, gold: 5 },
    capacityBonus: 0,
    productionBonus: { food: 0, wood: 3, stone: 0, gold: 0 }
  },
  quarry: {
    label: "Steinbruch",
    description: "Erschließt ergiebige Steinvorkommen.",
    workerWeeksRequired: 8,
    cost: { food: 0, wood: 10, stone: 0, gold: 5 },
    capacityBonus: 0,
    productionBonus: { food: 0, wood: 0, stone: 3, gold: 0 }
  },
  house: {
    label: "Wohnhaus",
    description: "Mehr Wohnraum erhöht die maximale Siedlerzahl.",
    workerWeeksRequired: 3,
    cost: { food: 0, wood: 8, stone: 4, gold: 0 },
    capacityBonus: 4,
    productionBonus: { food: 0, wood: 0, stone: 0, gold: 0 }
  },
  tavern: {
    label: "Taverne",
    description: "Treffpunkt und Handelsknoten – steigert Goldeinnahmen.",
    workerWeeksRequired: 5,
    cost: { food: 5, wood: 10, stone: 5, gold: 10 },
    capacityBonus: 0,
    productionBonus: { food: 0, wood: 0, stone: 0, gold: 3 }
  },
  healer_hut: {
    label: "Heilerhaus",
    description: "Verbessert Überlebenswürfe bei Krankheit und Alter (–5 % Sterberisiko).",
    workerWeeksRequired: 4,
    cost: { food: 0, wood: 6, stone: 2, gold: 5 },
    capacityBonus: 0,
    productionBonus: { food: 0, wood: 0, stone: 0, gold: 0 },
    healerBonus: true
  },
  watchtower: {
    label: "Wachturm",
    description: "Schützt vor Übergriffen und dämpft Weltspannungseffekte.",
    workerWeeksRequired: 5,
    cost: { food: 0, wood: 5, stone: 10, gold: 0 },
    capacityBonus: 0,
    productionBonus: { food: 0, wood: 0, stone: 0, gold: 0 }
  },
  well: {
    label: "Brunnen",
    description: "Verbessert die Wasserversorgung – senkt Krankheitsrate.",
    workerWeeksRequired: 2,
    cost: { food: 0, wood: 2, stone: 6, gold: 0 },
    capacityBonus: 2,
    productionBonus: { food: 0, wood: 0, stone: 0, gold: 0 }
  }
};

// ---------------------------------------------------------------------------
// Alterschwellenwerte
// ---------------------------------------------------------------------------
export const AGE_THRESHOLDS = {
  childMax: 12,     // Unter diesem Alter: Kind (kein Arbeitsertrag)
  elderMin: 70,     // Ab diesem Alter: Greis (halber Arbeitsertrag)
  deathRiskMin: 60  // Ab diesem Alter: Sterblichkeitswurf beim Jahreswechsel
};

// ---------------------------------------------------------------------------
// Arbeitseffizienz nach Status (Multiplikator 0–1)
// ---------------------------------------------------------------------------
export const WORK_EFFICIENCY = {
  child:  0.0,
  elder:  0.5,
  sick:   0.0,
  active: 1.0
};

// ---------------------------------------------------------------------------
// Standard-Sterbewahrscheinlichkeit in % (überschreibbar durch GM)
// ---------------------------------------------------------------------------
export const DEFAULT_DEATH_DIFFICULTY = 15;

// ---------------------------------------------------------------------------
// Nahrungsverbrauch pro Siedler und Woche
// ---------------------------------------------------------------------------
export const FOOD_CONSUMPTION_PER_SETTLER = 1;

// ---------------------------------------------------------------------------
// Grundkapazität der Siedlung (bevor Gebäude gebaut werden)
// ---------------------------------------------------------------------------
export const BASE_CAPACITY = 10;
