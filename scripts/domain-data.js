/**
 * domain-data.js
 * Zuständig für das Speichern und Laden aller Domänen-Daten über Foundry Settings.
 * Stellt sicher, dass Änderungen an Siedlern, Ressourcen und Weltspannung
 * sofort persistent in der Datenbank landen.
 */

import { BASE_CAPACITY, DEFAULT_DEATH_DIFFICULTY } from "./constants.js";

const SETTING_DOMAIN    = "domainState";
const SETTING_SETTLERS  = "settlers";

export class DomainData {

  // ---------------------------------------------------------------------------
  // Standard-Zustände
  // ---------------------------------------------------------------------------

  static getDefaultDomainState() {
    return {
      resources: { food: 50, wood: 20, stone: 10, gold: 5 },
      buildings: [],
      season: "spring",
      week: 1,
      year: 1,
      worldTension: 20,
      deathDifficulty: DEFAULT_DEATH_DIFFICULTY,
      baseCapacity: BASE_CAPACITY,
      log: []
    };
  }

  // ---------------------------------------------------------------------------
  // Domain-Zustand (Ressourcen, Gebäude, Zeit …)
  // ---------------------------------------------------------------------------

  static getDomainState() {
    try {
      const raw = game.settings.get("domain-manager", SETTING_DOMAIN);
      return foundry.utils.mergeObject(
        DomainData.getDefaultDomainState(),
        raw ?? {},
        { insertKeys: true, inplace: false }
      );
    } catch {
      return DomainData.getDefaultDomainState();
    }
  }

  static async saveDomainState(state) {
    await game.settings.set("domain-manager", SETTING_DOMAIN, state);
  }

  // ---------------------------------------------------------------------------
  // Siedler-Array
  // ---------------------------------------------------------------------------

  static getSettlers() {
    try {
      return game.settings.get("domain-manager", SETTING_SETTLERS) ?? [];
    } catch {
      return [];
    }
  }

  static async saveSettlers(settlers) {
    await game.settings.set("domain-manager", SETTING_SETTLERS, settlers);
  }

  // ---------------------------------------------------------------------------
  // Fabrik-Methoden
  // ---------------------------------------------------------------------------

  /**
   * Erzeugt einen neuen Siedler-Datensatz mit sinnvollen Defaults.
   * @param {object} overrides - Überschreibende Felder
   * @returns {object}
   */
  static createSettler(overrides = {}) {
    return foundry.utils.mergeObject(
      {
        id:         foundry.utils.randomID(),
        name:       "Unbekannt",
        age:        25,
        gender:     "male",
        status:     "active",
        profession: "none",
        notes:      ""
      },
      overrides,
      { inplace: false }
    );
  }

  /**
   * Erzeugt einen neuen Gebäude-Instanz-Datensatz.
   * @param {string} typeKey - Schlüssel aus BUILDING_TYPES
   * @param {object} overrides
   * @returns {object}
   */
  static createBuilding(typeKey, overrides = {}) {
    return foundry.utils.mergeObject(
      {
        id:                foundry.utils.randomID(),
        typeKey,
        status:            "planned",        // planned | under_construction | complete
        workerWeeksSpent:  0,
        assignedWorkers:   0
      },
      overrides,
      { inplace: false }
    );
  }

  // ---------------------------------------------------------------------------
  // Log-Hilfsmethoden
  // ---------------------------------------------------------------------------

  /**
   * Fügt dem Domain-Log Einträge hinzu und kürzt ihn auf max. 100 Zeilen.
   * @param {string[]} messages
   * @param {object} state - Bestehender State (wird NICHT gespeichert – Aufgabe des Callers)
   * @returns {object} Neuer State mit aktualisiertem Log
   */
  static appendLog(messages, state) {
    const entries = messages.map(message => ({
      message,
      week:      state.week,
      year:      state.year,
      timestamp: Date.now()
    }));
    const log = [...entries, ...(state.log ?? [])].slice(0, 100);
    return { ...state, log };
  }
}
