/**
 * domain-app.js
 * Haupt-Interface des Domain Managers.
 */

import { DomainData } from "./domain-data.js";
import { EngineLogic } from "./engine-logic.js";
import { PROFESSIONS, SEASONS, BUILDING_TYPES, SETTLER_SPECIES } from "./constants.js";

export class DomainApp extends FormApplication {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "domain-manager-app",
      title: "Domain Manager",
      template: "modules/domain-manager/templates/main-dashboard.hbs",
      width: 980,
      height: 700,
      resizable: true,
      classes: ["domain-manager"],
      closeOnSubmit: false,
      submitOnChange: false,
      tabs: [{
        navSelector: ".domain-tabs",
        contentSelector: ".tab-body",
        initial: "dashboard"
      }]
    });
  }

  static _statusLabel(status) {
    return { active: "Aktiv", sick: "Krank", child: "Kind", elder: "Greis" }[status] ?? status;
  }

  static _genderLabel(gender) {
    return { male: "Männlich", female: "Weiblich" }[gender] ?? "Unbekannt";
  }

  static _speciesLabel(species) {
    return SETTLER_SPECIES[species]?.label ?? SETTLER_SPECIES.human.label;
  }

  static _buildingStatusLabel(status) {
    return { planned: "Geplant", under_construction: "Im Bau", complete: "Fertig" }[status] ?? status;
  }

  getData(options = {}) {
    const state = DomainData.getDomainState();
    const rawSettlers = DomainData.getSettlers();
    const settlerMap = new Map(rawSettlers.map(s => [s.id, s]));
    const capacity = EngineLogic.calculateCapacity(state);
    const housingSlots = EngineLogic.calculateHousingSlots(state);
    const { production, consumption, netFood } = EngineLogic.calculateWeeklyProduction(rawSettlers, state);

    const houseBuildings = (state.buildings ?? []).filter(b => {
      if (b.status !== "complete") return false;
      const type = BUILDING_TYPES[b.typeKey];
      return (type?.householdSlots ?? 0) > 0;
    });

    const houseUsage = new Map();
    for (const settler of rawSettlers) {
      if (!settler.houseId) continue;
      houseUsage.set(settler.houseId, (houseUsage.get(settler.houseId) ?? 0) + 1);
    }

    const houses = houseBuildings.map(house => {
      const type = BUILDING_TYPES[house.typeKey];
      const slots = type?.householdSlots ?? 0;
      const used = houseUsage.get(house.id) ?? 0;
      const baseLabel = type?.label ?? house.typeKey;
      const number = house.number ? ` #${house.number}` : "";
      const displayLabel = house.customName
        ? house.customName
        : `${baseLabel}${number}`;
      return {
        id: house.id,
        label: displayLabel,
        baseLabel,
        slots,
        used,
        free: Math.max(0, slots - used)
      };
    });

    const settlers = rawSettlers.map(s => {
      const partner = s.partnerId ? settlerMap.get(s.partnerId) : null;
      const house = s.houseId ? houses.find(h => h.id === s.houseId) : null;
      return {
        ...s,
        species: s.species ?? "human",
        effectiveStatus: EngineLogic.getEffectiveStatus(s),
        efficiencyPct: Math.round(EngineLogic.getEfficiency(s) * 100),
        professionLabel: PROFESSIONS[s.profession]?.label ?? "Keine",
        statusLabel: DomainApp._statusLabel(EngineLogic.getEffectiveStatus(s)),
        speciesLabel: DomainApp._speciesLabel(s.species ?? "human"),
        genderLabel: DomainApp._genderLabel(s.gender),
        partnerName: partner?.name ?? "-",
        houseLabel: house ? `${house.label} (${house.used}/${house.slots})` : "-"
      };
    });

    const typeCounts = {};
    const buildings = (state.buildings ?? []).map(b => {
      const type = BUILDING_TYPES[b.typeKey] ?? {};
      const required = type.workerWeeksRequired ?? 1;
      const progress = b.status === "complete"
        ? 100
        : b.status === "under_construction"
          ? Math.floor((b.workerWeeksSpent / required) * 100)
          : 0;

      const assignedSettlerIds = b.assignedSettlerIds ?? [];
      const maxWorkers = type.maxWorkers ?? 0;
      const canAssignStaff = b.status === "complete" && maxWorkers > 0;
      const eligibleSettlers = canAssignStaff
        ? settlers.filter(s => type.allowedProfessions?.includes(s.profession))
        : [];

      const assignableSettlers = eligibleSettlers.map(s => ({
        id: s.id,
        name: `${s.name} (${PROFESSIONS[s.profession]?.label ?? "?"})`,
        selected: assignedSettlerIds.includes(s.id)
      }));

      const baseLabel = type.label ?? b.typeKey;
      typeCounts[b.typeKey] = (typeCounts[b.typeKey] ?? 0) + 1;
      const number = b.number || typeCounts[b.typeKey];
      const displayLabel = b.customName
        ? b.customName
        : `${baseLabel} #${number}`;

      return {
        ...b,
        typeLabel: displayLabel,
        baseTypeLabel: baseLabel,
        description: type.description ?? "",
        workerWeeksRequired: required,
        statusLabel: DomainApp._buildingStatusLabel(b.status),
        isPlanned: b.status === "planned",
        isUnderConstruction: b.status === "under_construction",
        isComplete: b.status === "complete",
        progress,
        maxWorkers,
        assignedStaffCount: assignedSettlerIds.length,
        canAssignStaff,
        assignableSettlers,
        allowedProfessionLabels: (type.allowedProfessions ?? []).map(p => PROFESSIONS[p]?.label ?? p).join(", ")
      };
    });

    const seasons = Object.entries(SEASONS).map(([key, val]) => ({
      key,
      label: val.label,
      selected: key === state.season
    }));

    const professions = Object.entries(PROFESSIONS).map(([key, val]) => ({
      key,
      label: val.label,
      foodProd: val.foodProd,
      woodProd: val.woodProd,
      stoneProd: val.stoneProd,
      goldProd: val.goldProd
    }));

    const species = Object.entries(SETTLER_SPECIES).map(([key, val]) => ({
      key,
      label: val.label
    }));

    const buildingTypes = Object.entries(BUILDING_TYPES).map(([key, val]) => ({
      key,
      label: val.label,
      description: val.description,
      workerWeeksRequired: val.workerWeeksRequired,
      costWood: val.cost.wood,
      costStone: val.cost.stone,
      costGold: val.cost.gold,
      capacityBonus: val.capacityBonus ?? 0,
      householdSlots: val.householdSlots ?? 0,
      prodFood: val.productionBonus?.food ?? 0,
      prodWood: val.productionBonus?.wood ?? 0,
      prodStone: val.productionBonus?.stone ?? 0,
      prodGold: val.productionBonus?.gold ?? 0
    }));

    const intakeInput = Math.max(0, Number(state.intakeCheckInput) || 0);
    const intakeCheck = EngineLogic.evaluateIntake(rawSettlers, state, intakeInput);

    return {
      state,
      settlers,
      settlerCount: rawSettlers.length,
      capacity,
      housingSlots,
      houses,
      resources: state.resources,
      buildings,
      seasons,
      seasonLabel: SEASONS[state.season]?.label ?? "Frühling",
      week: state.week,
      year: state.year,
      worldTension: state.worldTension,
      deathDifficulty: state.deathDifficulty,
      baseCapacity: state.baseCapacity,
      weeklyProduction: production,
      weeklyConsumption: consumption,
      weeklyNetFood: netFood,
      netFoodPositive: netFood >= 0,
      professions,
      species,
      buildingTypes,
      log: (state.log ?? []).slice(0, 25),
      isGM: game.user.isGM,
      foodWarning: state.resources.food < rawSettlers.length * 2,
      capacityWarning: rawSettlers.length >= capacity,
      intakeInput,
      intakeCheck
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!game.user.isGM) return;

    html.find(".btn-week-end").on("click", this._onWeekEnd.bind(this));
    html.find(".btn-year-end").on("click", this._onYearEnd.bind(this));
    html.find(".season-select").on("change", this._onSeasonChange.bind(this));

    html.find(".btn-add-settler").on("click", this._onAddSettler.bind(this));
    html.find(".btn-edit-settler").on("click", this._onEditSettler.bind(this));
    html.find(".btn-delete-settler").on("click", this._onDeleteSettler.bind(this));
    html.find(".btn-create-pair").on("click", this._onCreatePair.bind(this));
    html.find(".btn-break-pair").on("click", this._onBreakPair.bind(this));
    html.find(".btn-assign-house").on("click", this._onAssignHouse.bind(this));

    html.find(".btn-rename-building").on("click", this._onRenameBuilding.bind(this));
    html.find(".btn-add-building").on("click", this._onAddBuilding.bind(this));
    html.find(".btn-start-construction").on("click", this._onStartConstruction.bind(this));
    html.find(".btn-delete-building").on("click", this._onDeleteBuilding.bind(this));
    html.find(".building-workers").on("change", this._onBuildingWorkersChange.bind(this));
    html.find(".building-staff-checkbox").on("change", this._onBuildingStaffAssignmentChange.bind(this));

    html.find(".btn-save-gm-settings").on("click", this._onSaveGMSettings.bind(this));
    html.find(".btn-set-resources").on("click", this._onSetResources.bind(this));
    html.find(".btn-clear-log").on("click", this._onClearLog.bind(this));
    html.find(".btn-check-intake").on("click", this._onCheckIntake.bind(this));
  }

  async _onWeekEnd(event) {
    event.preventDefault();
    const state = DomainData.getDomainState();
    const settlers = DomainData.getSettlers();

    const { newState, newSettlers, messages } = EngineLogic.processWeek(settlers, state);
    const stateWithLog = DomainData.appendLog(messages, newState);

    await DomainData.saveDomainState(stateWithLog);
    await DomainData.saveSettlers(newSettlers);

    DomainApp._postToGMChat(`📅 Woche ${state.week}, Jahr ${state.year} abgeschlossen`, messages);
    this.render(false);
  }

  async _onYearEnd(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title: "Jahr abschließen",
      content: "<p>Bist du sicher? Alle Siedler altern um ein Jahr. Sterblichkeits- und Geburts-Würfe werden ausgeführt.</p>",
      yes: () => true,
      no: () => false
    });
    if (!confirmed) return;

    const state = DomainData.getDomainState();
    const settlers = DomainData.getSettlers();

    const { newState, newSettlers, messages } = EngineLogic.processYear(settlers, state);
    const stateWithLog = DomainData.appendLog(messages, newState);

    await DomainData.saveDomainState(stateWithLog);
    await DomainData.saveSettlers(newSettlers);

    DomainApp._postToGMChat(`🎆 Jahr ${state.year} abgeschlossen`, messages);
    this.render(false);
  }

  async _onSeasonChange(event) {
    const state = DomainData.getDomainState();
    state.season = event.target.value;
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _onAddSettler(event) {
    event.preventDefault();
    await this._openSettlerDialog(null);
  }

  async _onEditSettler(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const settler = DomainData.getSettlers().find(s => s.id === id);
    if (settler) await this._openSettlerDialog(settler);
  }

  async _openSettlerDialog(settler) {
    const isNew = !settler;
    const settlers = DomainData.getSettlers();
    const state = DomainData.getDomainState();
    const houses = (state.buildings ?? []).filter(b => {
      const type = BUILDING_TYPES[b.typeKey];
      return b.status === "complete" && (type?.householdSlots ?? 0) > 0;
    });

    const professionOptions = Object.entries(PROFESSIONS)
      .map(([key, val]) => `<option value="${key}" ${settler?.profession === key ? "selected" : ""}>${val.label}</option>`)
      .join("");

    const speciesOptions = Object.entries(SETTLER_SPECIES)
      .map(([key, val]) => `<option value="${key}" ${(settler?.species ?? "human") === key ? "selected" : ""}>${val.label}</option>`)
      .join("");

    const partnerOptions = ["<option value=''>Kein Partner</option>"]
      .concat(settlers
        .filter(s => !settler || s.id !== settler.id)
        .map(s => `<option value="${s.id}" ${settler?.partnerId === s.id ? "selected" : ""}>${s.name}</option>`)
      )
      .join("");

    const houseOptions = ["<option value=''>Kein Wohnhaus</option>"]
      .concat(houses.map(h => `<option value="${h.id}" ${settler?.houseId === h.id ? "selected" : ""}>${h.label}</option>`))
      .join("");

    const content = `
      <form class="dm-dialog-form">
        <div class="form-group"><label>Name</label><input type="text" name="name" value="${settler?.name ?? ""}" /></div>
        <div class="form-group"><label>Alter</label><input type="number" name="age" value="${settler?.age ?? 25}" min="0" /></div>
        <div class="form-group"><label>Spezies</label><select name="species">${speciesOptions}</select></div>
        <div class="form-group">
          <label>Geschlecht</label>
          <select name="gender">
            <option value="male" ${settler?.gender === "male" ? "selected" : ""}>Männlich</option>
            <option value="female" ${settler?.gender === "female" ? "selected" : ""}>Weiblich</option>
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            <option value="active" ${settler?.status === "active" ? "selected" : ""}>Aktiv</option>
            <option value="sick" ${settler?.status === "sick" ? "selected" : ""}>Krank</option>
          </select>
        </div>
        <div class="form-group"><label>Beruf</label><select name="profession">${professionOptions}</select></div>
        <div class="form-group"><label>Partner</label><select name="partnerId">${partnerOptions}</select></div>
        <div class="form-group"><label>Wohnhaus</label><select name="houseId">${houseOptions}</select></div>
        <div class="form-group"><label>Notizen</label><textarea name="notes" rows="3">${settler?.notes ?? ""}</textarea></div>
      </form>`;

    new Dialog({
      title: isNew ? "Neuen Siedler hinzufügen" : `${settler.name} bearbeiten`,
      content,
      buttons: {
        save: {
          icon: "<i class='fas fa-save'></i>",
          label: "Speichern",
          callback: async (html) => {
            const fd = new FormDataExtended(html.find("form")[0]);
            const data = fd.object;

            data.name = String(data.name ?? "").trim() || "Unbekannt";
            data.age = Math.max(0, parseInt(data.age) || 0);
            if (!SETTLER_SPECIES[data.species]) data.species = "human";
            if (data.gender !== "male" && data.gender !== "female") data.gender = "male";
            data.partnerId = data.partnerId || null;
            data.houseId = data.houseId || null;

            const allSettlers = DomainData.getSettlers();
            let editedId = null;
            if (isNew) {
              const newSettler = DomainData.createSettler(data);
              editedId = newSettler.id;
              allSettlers.push(newSettler);
            } else {
              const idx = allSettlers.findIndex(s => s.id === settler.id);
              if (idx >= 0) {
                allSettlers[idx] = { ...settler, ...data };
                editedId = settler.id;
              }
            }

            if (data.partnerId && editedId) {
              const partnerIdx = allSettlers.findIndex(s => s.id === data.partnerId);
              if (partnerIdx >= 0) {
                allSettlers[partnerIdx] = { ...allSettlers[partnerIdx], partnerId: editedId };
              }
            }

            await DomainData.saveSettlers(allSettlers);
            this.render(false);
          }
        },
        cancel: { icon: "<i class='fas fa-times'></i>", label: "Abbrechen" }
      },
      default: "save"
    }).render(true);
  }

  async _onCreatePair(event) {
    event.preventDefault();
    const settlers = DomainData.getSettlers();
    const adults = settlers.filter(s => EngineLogic.getEffectiveStatus(s) === "active");
    if (adults.length < 2) {
      ui.notifications.warn("Mindestens zwei aktive Erwachsene werden benötigt.");
      return;
    }

    const state = DomainData.getDomainState();
    const houses = (state.buildings ?? []).filter(b => {
      const type = BUILDING_TYPES[b.typeKey];
      return b.status === "complete" && (type?.householdSlots ?? 0) > 0;
    });

    const settlerOptions = adults.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    const houseOptions = ["<option value=''>Kein Wohnhaus zuweisen</option>"]
      .concat(houses.map(h => `<option value="${h.id}">${h.label}</option>`))
      .join("");

    const content = `
      <form class="dm-dialog-form">
        <div class="form-group"><label>Partner A</label><select name="aId">${settlerOptions}</select></div>
        <div class="form-group"><label>Partner B</label><select name="bId">${settlerOptions}</select></div>
        <div class="form-group"><label>Gemeinsames Wohnhaus</label><select name="houseId">${houseOptions}</select></div>
      </form>`;

    new Dialog({
      title: "Paar bilden",
      content,
      buttons: {
        save: {
          label: "Speichern",
          callback: async (html) => {
            const fd = new FormDataExtended(html.find("form")[0]);
            const aId = fd.object.aId;
            const bId = fd.object.bId;
            const houseId = fd.object.houseId || null;
            if (!aId || !bId || aId === bId) {
              ui.notifications.error("Bitte zwei unterschiedliche Siedler wählen.");
              return;
            }

            const all = DomainData.getSettlers();
            const idxA = all.findIndex(s => s.id === aId);
            const idxB = all.findIndex(s => s.id === bId);
            if (idxA < 0 || idxB < 0) return;

            all[idxA] = { ...all[idxA], partnerId: bId, houseId };
            all[idxB] = { ...all[idxB], partnerId: aId, houseId };
            await DomainData.saveSettlers(all);
            this.render(false);
          }
        },
        cancel: { label: "Abbrechen" }
      }
    }).render(true);
  }

  async _onBreakPair(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const settlers = DomainData.getSettlers();
    const idx = settlers.findIndex(s => s.id === id);
    if (idx < 0) return;

    const partnerId = settlers[idx].partnerId;
    settlers[idx] = { ...settlers[idx], partnerId: null };
    if (partnerId) {
      const pIdx = settlers.findIndex(s => s.id === partnerId);
      if (pIdx >= 0) settlers[pIdx] = { ...settlers[pIdx], partnerId: null };
    }
    await DomainData.saveSettlers(settlers);
    this.render(false);
  }

  async _onAssignHouse(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const settlers = DomainData.getSettlers();
    const settler = settlers.find(s => s.id === id);
    if (!settler) return;

    const state = DomainData.getDomainState();
    const houses = (state.buildings ?? []).filter(b => {
      const type = BUILDING_TYPES[b.typeKey];
      return b.status === "complete" && (type?.householdSlots ?? 0) > 0;
    });

    const houseOptions = ["<option value=''>Kein Wohnhaus</option>"]
      .concat(houses.map(h => {
        const type = BUILDING_TYPES[h.typeKey];
        const base = type?.label ?? h.typeKey;
        const num = h.number ? ` #${h.number}` : "";
        const lbl = h.customName || `${base}${num}`;
        return `<option value="${h.id}" ${settler.houseId === h.id ? "selected" : ""}>${lbl}</option>`;
      }))
      .join("");

    new Dialog({
      title: `${settler.name} Wohnhaus zuweisen`,
      content: `<form class="dm-dialog-form"><div class="form-group"><label>Wohnhaus</label><select name="houseId">${houseOptions}</select></div></form>`,
      buttons: {
        save: {
          label: "Speichern",
          callback: async (html) => {
            const fd = new FormDataExtended(html.find("form")[0]);
            const houseId = fd.object.houseId || null;
            const all = DomainData.getSettlers();
            const idx = all.findIndex(s => s.id === id);
            if (idx < 0) return;
            all[idx] = { ...all[idx], houseId };

            const partnerId = all[idx].partnerId;
            if (partnerId) {
              const pIdx = all.findIndex(s => s.id === partnerId);
              if (pIdx >= 0) all[pIdx] = { ...all[pIdx], houseId };
            }

            await DomainData.saveSettlers(all);
            this.render(false);
          }
        },
        cancel: { label: "Abbrechen" }
      }
    }).render(true);
  }

  async _onDeleteSettler(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const settlers = DomainData.getSettlers();
    const settler = settlers.find(s => s.id === id);
    if (!settler) return;

    const confirmed = await Dialog.confirm({
      title: "Siedler entfernen",
      content: `<p>Siedler <strong>${settler.name}</strong> wirklich entfernen?</p>`
    });
    if (!confirmed) return;

    const filtered = settlers.filter(s => s.id !== id).map(s => {
      if (s.partnerId === id) return { ...s, partnerId: null };
      return s;
    });

    const state = DomainData.getDomainState();
    state.buildings = (state.buildings ?? []).map(b => ({
      ...b,
      assignedSettlerIds: (b.assignedSettlerIds ?? []).filter(settlerId => settlerId !== id)
    }));

    await DomainData.saveDomainState(state);
    await DomainData.saveSettlers(filtered);
    this.render(false);
  }

  async _onRenameBuilding(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const state = DomainData.getDomainState();
    const bldg = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    const type = BUILDING_TYPES[bldg.typeKey];
    const baseLabel = type?.label ?? bldg.typeKey;
    const number = bldg.number || 1;
    const currentName = bldg.customName || `${baseLabel} #${number}`;

    new Dialog({
      title: "Gebäude umbenennen",
      content: `<form class="dm-dialog-form">
        <div class="form-group">
          <label>Anzeigename</label>
          <input type="text" name="customName" value="${currentName}" placeholder="z.B. Haus der Familie Mayer" style="width:100%" />
          <small>Leer lassen um Standardname zu verwenden.</small>
        </div>
      </form>`,
      buttons: {
        save: {
          icon: "<i class='fas fa-save'></i>",
          label: "Speichern",
          callback: async (html) => {
            const fd = new FormDataExtended(html.find("form")[0]);
            const newName = String(fd.object.customName ?? "").trim();
            bldg.customName = newName;
            await DomainData.saveDomainState(state);
            this.render(false);
          }
        },
        reset: {
          icon: "<i class='fas fa-undo'></i>",
          label: "Standardname",
          callback: async () => {
            bldg.customName = "";
            await DomainData.saveDomainState(state);
            this.render(false);
          }
        },
        cancel: { label: "Abbrechen" }
      },
      default: "save"
    }).render(true);
  }

  async _onAddBuilding(event) {
    event.preventDefault();

    const typeOptions = Object.entries(BUILDING_TYPES)
      .map(([key, val]) => `<option value="${key}">${val.label} (${val.workerWeeksRequired} AW | 🪵${val.cost.wood} ⛏️${val.cost.stone} 💰${val.cost.gold})</option>`)
      .join("");

    new Dialog({
      title: "Bauprojekt planen",
      content: `<form class="dm-dialog-form"><div class="form-group"><label>Gebäudetyp</label><select name="typeKey">${typeOptions}</select></div></form>`,
      buttons: {
        add: {
          icon: "<i class='fas fa-plus'></i>",
          label: "Planen",
          callback: async (html) => {
            const typeKey = html.find("[name='typeKey']").val();
            const state = DomainData.getDomainState();
            state.buildings = state.buildings ?? [];
            const sameType = (state.buildings ?? []).filter(b => b.typeKey === typeKey);
            const nextNumber = sameType.length + 1;
            state.buildings.push(DomainData.createBuilding(typeKey, { number: nextNumber }));
            await DomainData.saveDomainState(state);
            this.render(false);
          }
        },
        cancel: { label: "Abbrechen" }
      }
    }).render(true);
  }

  async _onStartConstruction(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const state = DomainData.getDomainState();
    const bldg = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    bldg.status = "under_construction";
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _onDeleteBuilding(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    const state = DomainData.getDomainState();
    const bldg = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    const typeLabel = BUILDING_TYPES[bldg.typeKey]?.label ?? bldg.typeKey;
    const confirmed = await Dialog.confirm({
      title: "Gebäude entfernen",
      content: `<p>Gebäude <strong>${typeLabel}</strong> wirklich entfernen?</p>`
    });
    if (!confirmed) return;

    state.buildings = state.buildings.filter(b => b.id !== id);
    const settlers = DomainData.getSettlers().map(s => (s.houseId === id ? { ...s, houseId: null } : s));
    await DomainData.saveSettlers(settlers);
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _onBuildingWorkersChange(event) {
    const id = event.currentTarget.dataset.id;
    const workers = Math.max(0, parseInt(event.currentTarget.value) || 0);
    const state = DomainData.getDomainState();
    const bldg = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    bldg.assignedWorkers = workers;
    await DomainData.saveDomainState(state);
  }

  async _onBuildingStaffAssignmentChange(event) {
    const buildingId = event.currentTarget.dataset.buildingId;
    const settlerId = event.currentTarget.dataset.settlerId;
    const checked = event.currentTarget.checked;
    const state = DomainData.getDomainState();
    const bldg = state.buildings?.find(b => b.id === buildingId);
    if (!bldg) return;

    const type = BUILDING_TYPES[bldg.typeKey] ?? {};
    const maxWorkers = type.maxWorkers ?? 0;
    const assigned = new Set(bldg.assignedSettlerIds ?? []);

    if (checked) assigned.add(settlerId);
    else assigned.delete(settlerId);

    if (maxWorkers > 0 && assigned.size > maxWorkers) {
      ui.notifications.warn(`Maximal ${maxWorkers} Personen für ${type.label} möglich.`);
      event.currentTarget.checked = false;
      return;
    }

    bldg.assignedSettlerIds = [...assigned];
    await DomainData.saveDomainState(state);
  }

  async _onSaveGMSettings(event) {
    event.preventDefault();
    const html = this.element;
    const state = DomainData.getDomainState();

    state.worldTension = Math.max(0, Math.min(100, parseInt(html.find("[name='worldTension']").val()) || 0));
    state.deathDifficulty = Math.max(0, Math.min(95, parseInt(html.find("[name='deathDifficulty']").val()) || 15));
    state.baseCapacity = Math.max(1, parseInt(html.find("[name='baseCapacity']").val()) || 10);

    await DomainData.saveDomainState(state);
    ui.notifications.info("Domain Manager: GM-Einstellungen gespeichert.");
    this.render(false);
  }

  async _onSetResources(event) {
    event.preventDefault();
    const html = this.element;
    const state = DomainData.getDomainState();

    state.resources = {
      food: Math.max(0, parseInt(html.find("[name='res-food']").val()) || 0),
      wood: Math.max(0, parseInt(html.find("[name='res-wood']").val()) || 0),
      stone: Math.max(0, parseInt(html.find("[name='res-stone']").val()) || 0),
      gold: Math.max(0, parseInt(html.find("[name='res-gold']").val()) || 0)
    };

    await DomainData.saveDomainState(state);
    ui.notifications.info("Domain Manager: Ressourcen aktualisiert.");
    this.render(false);
  }

  async _onCheckIntake(event) {
    event.preventDefault();
    const html = this.element;
    const state = DomainData.getDomainState();
    state.intakeCheckInput = Math.max(0, parseInt(html.find("[name='intakeCheckInput']").val()) || 0);
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _onClearLog(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title: "Ereignislog leeren",
      content: "<p>Alle Log-Einträge unwiderruflich löschen?</p>"
    });
    if (!confirmed) return;

    const state = DomainData.getDomainState();
    state.log = [];
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _updateObject(_event, _formData) {
    // Speicherung erfolgt direkt in den Handlern.
  }

  static _postToGMChat(title, messages) {
    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
    ChatMessage.create({
      content: `<div class="domain-chat-card"><h3 class="domain-chat-title">${title}</h3><ul class="domain-chat-list">${messages.map(m => `<li>${m}</li>`).join("")}</ul></div>`,
      speaker: { alias: "Domain Manager" },
      whisper: gmIds
    });
  }
}
