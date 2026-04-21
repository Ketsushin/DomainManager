/**
 * engine-logic.js
 * Reine Berechnungsschicht – kein UI, kein direktes Speichern.
 * Alle Funktionen sind synchron und geben neue State-Objekte zurück
 * (immutable-Stil); das Speichern übernimmt der Aufrufer (domain-app.js).
 */

import {
  PROFESSIONS,
  SEASONS,
  BUILDING_TYPES,
  AGE_THRESHOLDS,
  WORK_EFFICIENCY,
  FOOD_CONSUMPTION_PER_SETTLER
} from "./constants.js";

export class EngineLogic {

  static _toMapById(collection) {
    return new Map((collection ?? []).map(entry => [entry.id, entry]));
  }

  // ---------------------------------------------------------------------------
  // Siedler-Hilfsfunktionen
  // ---------------------------------------------------------------------------

  /**
   * Ermittelt den effektiven Status eines Siedlers (Alter hat Vorrang vor manuellem Status).
   * @param {object} settler
   * @returns {"active"|"child"|"elder"|"sick"}
   */
  static getEffectiveStatus(settler) {
    if (settler.status === "sick") return "sick";
    if (settler.age < AGE_THRESHOLDS.childMax) return "child";
    if (settler.age >= AGE_THRESHOLDS.elderMin) return "elder";
    return "active";
  }

  /**
   * Gibt den Arbeits-Effizienz-Multiplikator zurück (0–1).
   * @param {object} settler
   * @returns {number}
   */
  static getEfficiency(settler) {
    const status = EngineLogic.getEffectiveStatus(settler);
    return WORK_EFFICIENCY[status] ?? 1.0;
  }

  // ---------------------------------------------------------------------------
  // Kapazitäts-Berechnung
  // ---------------------------------------------------------------------------

  /**
   * Berechnet, wie viele Siedler die aktuelle Infrastruktur versorgen kann.
   * @param {object} state
   * @returns {number}
   */
  static calculateCapacity(state) {
    const completedBuildings = (state.buildings ?? []).filter(b => b.status === "complete");
    let capacity = state.baseCapacity ?? 10;
    for (const building of completedBuildings) {
      const type = BUILDING_TYPES[building.typeKey];
      if (type?.capacityBonus) capacity += type.capacityBonus;
    }
    return capacity;
  }

  /**
   * Gibt true zurück, wenn noch Platz für einen weiteren Siedler ist.
   * @param {object[]} settlers
   * @param {object} state
   * @returns {boolean}
   */
  static canAcceptNewSettler(settlers, state) {
    return settlers.length < EngineLogic.calculateCapacity(state);
  }

  static calculateHousingSlots(state) {
    const completedBuildings = (state.buildings ?? []).filter(b => b.status === "complete");
    let slots = 0;
    for (const building of completedBuildings) {
      const type = BUILDING_TYPES[building.typeKey];
      slots += type?.householdSlots ?? 0;
    }
    return slots;
  }

  static evaluateIntake(settlers, state, incomingCount) {
    const incoming = Math.max(0, Number(incomingCount) || 0);
    const capacity = EngineLogic.calculateCapacity(state);
    const housingSlots = EngineLogic.calculateHousingSlots(state);
    const projectedPopulation = settlers.length + incoming;
    const weekly = EngineLogic.calculateWeeklyProduction(settlers, state);
    const projectedConsumption = projectedPopulation * FOOD_CONSUMPTION_PER_SETTLER;
    const projectedNetFood = weekly.production.food - projectedConsumption;
    const projectedFoodAfterWeek = state.resources.food + projectedNetFood;

    return {
      incoming,
      projectedPopulation,
      capacity,
      housingSlots,
      fitsCapacity: projectedPopulation <= capacity,
      fitsHousing: housingSlots === 0 ? true : projectedPopulation <= housingSlots,
      projectedNetFood,
      projectedFoodAfterWeek,
      fitsFood: projectedFoodAfterWeek >= 0,
      canTakeAll:
        projectedPopulation <= capacity &&
        (housingSlots === 0 ? true : projectedPopulation <= housingSlots) &&
        projectedFoodAfterWeek >= 0
    };
  }

  // ---------------------------------------------------------------------------
  // Wochen-Produktion
  // ---------------------------------------------------------------------------

  /**
   * Berechnet die voraussichtliche Wochenproduktion (ohne State zu verändern).
   * Kann für die Vorschau-Anzeige im Dashboard verwendet werden.
   *
   * @param {object[]} settlers
   * @param {object}   state
   * @returns {{ production: object, consumption: number, netFood: number }}
   */
  static calculateWeeklyProduction(settlers, state) {
    const season    = SEASONS[state.season] ?? SEASONS.spring;
    const completed = (state.buildings ?? []).filter(b => b.status === "complete");
    const settlerMap = EngineLogic._toMapById(settlers);

    const production = { food: 0, wood: 0, stone: 0, gold: 0 };

    // Siedler-Produktion
    for (const settler of settlers) {
      const efficiency = EngineLogic.getEfficiency(settler);
      if (efficiency <= 0) continue;
      const prof = PROFESSIONS[settler.profession] ?? PROFESSIONS.none;
      production.food  += prof.foodProd  * efficiency;
      production.wood  += prof.woodProd  * efficiency;
      production.stone += prof.stoneProd * efficiency;
      production.gold  += prof.goldProd  * efficiency;
    }

    // Saison-Multiplikatoren auf Rohproduktion anwenden
    production.food  = Math.floor(production.food  * season.foodBonus);
    production.wood  = Math.floor(production.wood  * season.woodBonus);
    production.stone = Math.floor(production.stone * season.stoneBonus);
    production.gold  = Math.floor(production.gold);

    // Gebäude-Boni addieren (werden nicht von Saisonbonus beeinflusst)
    for (const building of completed) {
      const type = BUILDING_TYPES[building.typeKey];
      if (!type?.productionBonus) continue;
      production.food  += type.productionBonus.food  ?? 0;
      production.wood  += type.productionBonus.wood  ?? 0;
      production.stone += type.productionBonus.stone ?? 0;
      production.gold  += type.productionBonus.gold  ?? 0;

      if (type.staffPerWorkerBonus && Array.isArray(building.assignedSettlerIds)) {
        let validWorkers = 0;
        const maxWorkers = type.maxWorkers ?? Infinity;
        for (const settlerId of building.assignedSettlerIds.slice(0, maxWorkers)) {
          const settler = settlerMap.get(settlerId);
          if (!settler) continue;
          if (type.allowedProfessions?.length && !type.allowedProfessions.includes(settler.profession)) continue;
          if (EngineLogic.getEfficiency(settler) <= 0) continue;
          validWorkers += 1;
        }
        production.food  += (type.staffPerWorkerBonus.food ?? 0) * validWorkers;
        production.wood  += (type.staffPerWorkerBonus.wood ?? 0) * validWorkers;
        production.stone += (type.staffPerWorkerBonus.stone ?? 0) * validWorkers;
        production.gold  += (type.staffPerWorkerBonus.gold ?? 0) * validWorkers;
      }
    }

    const consumption = settlers.length * FOOD_CONSUMPTION_PER_SETTLER;
    const netFood     = production.food - consumption;

    return { production, consumption, netFood };
  }

  // ---------------------------------------------------------------------------
  // Wochen-Tick
  // ---------------------------------------------------------------------------

  /**
   * Führt einen Wochenabschluss durch.
   * Gibt den neuen State, die neuen Siedler und eine Liste von Ereignis-Nachrichten zurück.
   *
   * @param {object[]} settlers
   * @param {object}   state
   * @returns {{ newState: object, newSettlers: object[], messages: string[] }}
   */
  static processWeek(settlers, state) {
    const messages = [];
    const { production, consumption, netFood } = EngineLogic.calculateWeeklyProduction(settlers, state);

    // Ressourcen anwenden
    const newResources = {
      food:  Math.max(0, state.resources.food  + netFood),
      wood:  state.resources.wood  + production.wood,
      stone: state.resources.stone + production.stone,
      gold:  state.resources.gold  + production.gold
    };

    if (netFood < 0) {
      messages.push(`⚠️ Nahrungsknappheit! Netto-Nahrung diese Woche: ${netFood}.`);
    }

    if (newResources.food === 0 && netFood < 0) {
      messages.push("🔴 Keine Nahrungsreserven mehr – Hungersnot droht!");
    }

    // Baufortschritt
    const newBuildings = (state.buildings ?? []).map(b => {
      if (b.status !== "under_construction") return { ...b };
      const type = BUILDING_TYPES[b.typeKey];
      if (!type) return { ...b };

      const newSpent = b.workerWeeksSpent + (b.assignedWorkers ?? 0);
      if (newSpent >= type.workerWeeksRequired) {
        messages.push(`🏗️ Gebäude "${type.label}" wurde fertiggestellt!`);
        return { ...b, workerWeeksSpent: type.workerWeeksRequired, status: "complete", assignedWorkers: 0 };
      }
      return { ...b, workerWeeksSpent: newSpent };
    });

    messages.push(
      `📅 Woche ${state.week} abgeschlossen | ` +
      `+${production.food}🍞 +${production.wood}🪵 +${production.stone}⛏️ +${production.gold}💰 | ` +
      `Verbrauch: −${consumption}🍞 | Lager: ${newResources.food}🍞`
    );

    const newState = {
      ...state,
      resources: newResources,
      buildings: newBuildings,
      week: state.week + 1
    };

    return { newState, newSettlers: settlers.map(s => ({ ...s })), messages };
  }

  // ---------------------------------------------------------------------------
  // Jahres-Tick
  // ---------------------------------------------------------------------------

  /**
   * Führt einen Jahresabschluss durch: Alterung, Sterbecheck, Geburtsprüfung.
   *
   * @param {object[]} settlers
   * @param {object}   state
   * @returns {{ newState: object, newSettlers: object[], messages: string[] }}
   */
  static processYear(settlers, state) {
    const messages      = [];
    const hasHealerHut  = (state.buildings ?? []).some(
      b => b.status === "complete" && b.typeKey === "healer_hut"
    );
    const deathDifficulty = state.deathDifficulty ?? 15;
    const deathChance     = hasHealerHut
      ? Math.max(0, deathDifficulty - 5)
      : deathDifficulty;

    // Alle Siedler ein Jahr älter machen
    let aged = settlers.map(s => ({ ...s, age: s.age + 1 }));

    // Status automatisch aktualisieren (außer "sick" – das bleibt manuell)
    aged = aged.map(s => {
      if (s.status === "sick") return s;
      if (s.age < AGE_THRESHOLDS.childMax)  return { ...s, status: "child" };
      if (s.age >= AGE_THRESHOLDS.elderMin) return { ...s, status: "elder" };
      return { ...s, status: "active" };
    });

    // Sterbe-Checks für Siedler oberhalb des Risiko-Alters
    const surviving = [];
    for (const settler of aged) {
      if (settler.age > AGE_THRESHOLDS.deathRiskMin) {
        const extraRisk  = (settler.age - AGE_THRESHOLDS.deathRiskMin) * 2;
        const totalChance = Math.min(95, deathChance + extraRisk);
        const roll        = Math.floor(Math.random() * 100) + 1;

        if (roll <= totalChance) {
          messages.push(
            `💀 ${settler.name} ist im ${settler.age}. Lebensjahr friedlich eingeschlafen. ` +
            `(Würfel: ${roll} ≤ ${totalChance}%)`
          );
          continue; // Siedler stirbt – nicht in surviving aufnehmen
        }
      }
      surviving.push(settler);
    }

    // Bestehende Beziehungen auf überlebende Siedler bereinigen
    const survivorIds = new Set(surviving.map(s => s.id));
    const normalized = surviving.map(settler => {
      if (!settler.partnerId) return settler;
      if (!survivorIds.has(settler.partnerId)) {
        return { ...settler, partnerId: null };
      }
      return settler;
    });

    // Geburts-Check (nur über Paare)
    const capacity     = EngineLogic.calculateCapacity(state);
    const hasCapacity  = normalized.length < capacity;
    const hasFoodStock = state.resources.food >= normalized.length * 4;
    const fertileAdults = normalized.filter(s => {
      const status = EngineLogic.getEffectiveStatus(s);
      return status === "active" && s.age >= AGE_THRESHOLDS.childMax && s.age <= 45;
    });

    const fertileMap = EngineLogic._toMapById(fertileAdults);
    const couples = [];
    const seenPairKeys = new Set();
    for (const settler of fertileAdults) {
      if (!settler.partnerId) continue;
      const partner = fertileMap.get(settler.partnerId);
      if (!partner || partner.partnerId !== settler.id) continue;
      const pairKey = [settler.id, partner.id].sort().join("::");
      if (seenPairKeys.has(pairKey)) continue;
      seenPairKeys.add(pairKey);
      couples.push([settler, partner]);
    }

    const newSettlers = [...normalized];
    const housingSlots = EngineLogic.calculateHousingSlots(state);

    if (hasCapacity && hasFoodStock && couples.length > 0) {
      for (const [parentA, parentB] of couples) {
        if (newSettlers.length >= capacity) break;
        const birthChance = 35;
        const birthRoll = Math.floor(Math.random() * 100) + 1;
        if (birthRoll > birthChance) continue;

        const isFemale = Math.random() < 0.5;
        const hasHousing = housingSlots === 0 || newSettlers.length < housingSlots;
        const assignedHouseId = parentA.houseId && hasHousing ? parentA.houseId : null;
        const newborn = {
          id:         foundry.utils.randomID(),
          name:       `Kind von ${parentA.name}`,
          age:        0,
          gender:     isFemale ? "female" : "male",
          status:     "child",
          profession: "none",
          partnerId:  null,
          houseId:    assignedHouseId,
          notes:      `Geboren in Jahr ${state.year + 1}.`
        };
        newSettlers.push(newborn);
        messages.push(
          `🍼 ${parentA.name} und ${parentB.name} haben ${isFemale ? "eine Tochter" : "einen Sohn"} bekommen! ` +
          `(Würfel: ${birthRoll} ≤ ${birthChance}%)`
        );
      }
      if (!messages.some(msg => msg.includes("haben"))) {
        messages.push("ℹ️ Dieses Jahr gab es trotz bestehender Paare keine Geburten.");
      }
    } else if (!hasCapacity) {
      messages.push("ℹ️ Kein Bevölkerungswachstum – Versorgungslimit erreicht.");
    } else if (!hasFoodStock) {
      messages.push("ℹ️ Kein Bevölkerungswachstum – zu wenig Nahrungsreserven.");
    } else if (couples.length === 0) {
      messages.push("ℹ️ Kein Bevölkerungswachstum – keine registrierten Paare vorhanden.");
    }

    messages.push(
      `🎆 Jahr ${state.year} abgeschlossen. Siedler: ${newSettlers.length}/${capacity}.`
    );

    const newState = {
      ...state,
      week: 1,
      year: state.year + 1
    };

    return { newState, newSettlers, messages };
  }
}
