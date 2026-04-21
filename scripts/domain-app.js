/**
 * domain-app.js
 * Haupt-Interface des Domain Managers.
 * Steuert alle Tabs, verknüpft UI-Events mit der engine-logic.js
 * und aktualisiert die Anzeige nach jeder Aktion.
 */

import { DomainData }  from "./domain-data.js";
import { EngineLogic } from "./engine-logic.js";
import { PROFESSIONS, SEASONS, BUILDING_TYPES } from "./constants.js";

export class DomainApp extends FormApplication {

  // ---------------------------------------------------------------------------
  // Konfiguration
  // ---------------------------------------------------------------------------

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:              "domain-manager-app",
      title:           "Domain Manager",
      template:        "modules/domain-manager/templates/main-dashboard.hbs",
      width:           860,
      height:          640,
      resizable:       true,
      classes:         ["domain-manager"],
      closeOnSubmit:   false,
      submitOnChange:  false,
      tabs: [{
        navSelector:     ".domain-tabs",
        contentSelector: ".tab-body",
        initial:         "dashboard"
      }]
    });
  }

  // ---------------------------------------------------------------------------
  // Daten für Templates aufbereiten
  // ---------------------------------------------------------------------------

  getData(options = {}) {
    const state      = DomainData.getDomainState();
    const rawSettlers = DomainData.getSettlers();
    const capacity   = EngineLogic.calculateCapacity(state);
    const { production, consumption, netFood } =
      EngineLogic.calculateWeeklyProduction(rawSettlers, state);

    // Siedler anreichern
    const settlers = rawSettlers.map(s => ({
      ...s,
      effectiveStatus:  EngineLogic.getEffectiveStatus(s),
      efficiencyPct:    Math.round(EngineLogic.getEfficiency(s) * 100),
      professionLabel:  PROFESSIONS[s.profession]?.label ?? "Keine",
      statusLabel:      DomainApp._statusLabel(EngineLogic.getEffectiveStatus(s)),
      genderLabel:      DomainApp._genderLabel(s.gender)
    }));

    // Gebäude anreichern
    const buildings = (state.buildings ?? []).map(b => {
      const type      = BUILDING_TYPES[b.typeKey] ?? {};
      const required  = type.workerWeeksRequired ?? 1;
      const progress  = b.status === "complete"          ? 100
                      : b.status === "under_construction" ? Math.floor((b.workerWeeksSpent / required) * 100)
                      : 0;
      return {
        ...b,
        typeLabel:            type.label ?? b.typeKey,
        description:          type.description ?? "",
        workerWeeksRequired:  required,
        statusLabel:          DomainApp._buildingStatusLabel(b.status),
        isPlanned:            b.status === "planned",
        isUnderConstruction:  b.status === "under_construction",
        isComplete:           b.status === "complete",
        progress
      };
    });

    // Dropdown-Optionen
    const seasons = Object.entries(SEASONS).map(([key, val]) => ({
      key,
      label:    val.label,
      selected: key === state.season
    }));

    const professions = Object.entries(PROFESSIONS).map(([key, val]) => ({
      key,
      label: val.label
    }));

    const buildingTypes = Object.entries(BUILDING_TYPES).map(([key, val]) => ({
      key,
      label:                val.label,
      description:          val.description,
      workerWeeksRequired:  val.workerWeeksRequired,
      costWood:             val.cost.wood,
      costStone:            val.cost.stone,
      costGold:             val.cost.gold
    }));

    return {
      state,
      settlers,
      settlerCount:      rawSettlers.length,
      capacity,
      resources:         state.resources,
      buildings,
      seasons,
      season:            state.season,
      seasonLabel:       SEASONS[state.season]?.label ?? "Frühling",
      week:              state.week,
      year:              state.year,
      worldTension:      state.worldTension,
      deathDifficulty:   state.deathDifficulty,
      baseCapacity:      state.baseCapacity,
      weeklyProduction:  production,
      weeklyConsumption: consumption,
      weeklyNetFood:     netFood,
      netFoodPositive:   netFood >= 0,
      professions,
      buildingTypes,
      log:               (state.log ?? []).slice(0, 25),
      isGM:              game.user.isGM,
      foodWarning:       state.resources.food < rawSettlers.length * 2,
      capacityWarning:   rawSettlers.length >= capacity
    };
  }

  // ---------------------------------------------------------------------------
  // Label-Hilfsfunktionen
  // ---------------------------------------------------------------------------

  static _statusLabel(status) {
    return { active: "Aktiv", sick: "Krank", child: "Kind", elder: "Greis" }[status] ?? status;
  }

  static _genderLabel(gender) {
    return { male: "Männlich", female: "Weiblich", other: "Divers" }[gender] ?? gender;
  }

  static _buildingStatusLabel(status) {
    return { planned: "Geplant", under_construction: "Im Bau", complete: "Fertig" }[status] ?? status;
  }

  // ---------------------------------------------------------------------------
  // Event-Listener
  // ---------------------------------------------------------------------------

  activateListeners(html) {
    super.activateListeners(html);
    if (!game.user.isGM) return;

    // Zeitsteuerung
    html.find(".btn-week-end").on("click",  this._onWeekEnd.bind(this));
    html.find(".btn-year-end").on("click",  this._onYearEnd.bind(this));
    html.find(".season-select").on("change", this._onSeasonChange.bind(this));

    // Siedler
    html.find(".btn-add-settler").on("click",    this._onAddSettler.bind(this));
    html.find(".btn-edit-settler").on("click",   this._onEditSettler.bind(this));
    html.find(".btn-delete-settler").on("click", this._onDeleteSettler.bind(this));

    // Gebäude
    html.find(".btn-add-building").on("click",       this._onAddBuilding.bind(this));
    html.find(".btn-start-construction").on("click", this._onStartConstruction.bind(this));
    html.find(".btn-delete-building").on("click",    this._onDeleteBuilding.bind(this));
    html.find(".building-workers").on("change",      this._onBuildingWorkersChange.bind(this));

    // GM-Einstellungen
    html.find(".btn-save-gm-settings").on("click", this._onSaveGMSettings.bind(this));
    html.find(".btn-set-resources").on("click",    this._onSetResources.bind(this));
    html.find(".btn-clear-log").on("click",        this._onClearLog.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Zeitsteuerung ("The Time Engine")
  // ---------------------------------------------------------------------------

  async _onWeekEnd(event) {
    event.preventDefault();
    const state    = DomainData.getDomainState();
    const settlers = DomainData.getSettlers();

    const { newState, newSettlers, messages } = EngineLogic.processWeek(settlers, state);
    const stateWithLog = DomainData.appendLog(messages, newState);

    await DomainData.saveDomainState(stateWithLog);
    await DomainData.saveSettlers(newSettlers);

    DomainApp._postToGMChat(
      `📅 Woche ${state.week}, Jahr ${state.year} abgeschlossen`,
      messages
    );
    this.render(false);
  }

  async _onYearEnd(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title:   "Jahr abschließen",
      content: "<p>Bist du sicher? Alle Siedler altern um ein Jahr. Sterblichkeits- und Geburts-Würfe werden ausgeführt.</p>",
      yes:     () => true,
      no:      () => false
    });
    if (!confirmed) return;

    const state    = DomainData.getDomainState();
    const settlers = DomainData.getSettlers();

    const { newState, newSettlers, messages } = EngineLogic.processYear(settlers, state);
    const stateWithLog = DomainData.appendLog(messages, newState);

    await DomainData.saveDomainState(stateWithLog);
    await DomainData.saveSettlers(newSettlers);

    DomainApp._postToGMChat(
      `🎆 Jahr ${state.year} abgeschlossen`,
      messages
    );
    this.render(false);
  }

  async _onSeasonChange(event) {
    const newSeason = event.target.value;
    const state     = DomainData.getDomainState();
    state.season    = newSeason;
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  // ---------------------------------------------------------------------------
  // Siedler-Verwaltung
  // ---------------------------------------------------------------------------

  async _onAddSettler(event) {
    event.preventDefault();
    await this._openSettlerDialog(null);
  }

  async _onEditSettler(event) {
    event.preventDefault();
    const id       = event.currentTarget.dataset.id;
    const settlers = DomainData.getSettlers();
    const settler  = settlers.find(s => s.id === id);
    if (settler) await this._openSettlerDialog(settler);
  }

  async _openSettlerDialog(settler) {
    const isNew = !settler;

    const professionOptions = Object.entries(PROFESSIONS)
      .map(([key, val]) =>
        `<option value="${key}" ${settler?.profession === key ? "selected" : ""}>${val.label}</option>`
      ).join("");

    const content = `
      <form class="dm-dialog-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${settler?.name ?? ""}" placeholder="z.B. Alwin der Bauer" />
        </div>
        <div class="form-group">
          <label>Alter</label>
          <input type="number" name="age" value="${settler?.age ?? 25}" min="0" max="120" />
        </div>
        <div class="form-group">
          <label>Geschlecht</label>
          <select name="gender">
            <option value="male"   ${settler?.gender === "male"   ? "selected" : ""}>Männlich</option>
            <option value="female" ${settler?.gender === "female" ? "selected" : ""}>Weiblich</option>
            <option value="other"  ${settler?.gender === "other"  ? "selected" : ""}>Divers</option>
          </select>
        </div>
        <div class="form-group">
          <label>Status <small>(manuelle Überschreibung – Alter hat Vorrang)</small></label>
          <select name="status">
            <option value="active" ${settler?.status === "active" ? "selected" : ""}>Aktiv</option>
            <option value="sick"   ${settler?.status === "sick"   ? "selected" : ""}>Krank</option>
          </select>
        </div>
        <div class="form-group">
          <label>Beruf</label>
          <select name="profession">${professionOptions}</select>
        </div>
        <div class="form-group">
          <label>Notizen</label>
          <textarea name="notes" rows="3" style="width:100%">${settler?.notes ?? ""}</textarea>
        </div>
      </form>`;

    new Dialog({
      title:   isNew ? "Neuen Siedler hinzufügen" : `${settler.name} bearbeiten`,
      content,
      buttons: {
        save: {
          icon:     "<i class='fas fa-save'></i>",
          label:    "Speichern",
          callback: async (html) => {
            const fd   = new FormDataExtended(html.find("form")[0]);
            const data = fd.object;

            // Eingabe bereinigen
            data.name = String(data.name ?? "").trim() || "Unbekannt";
            data.age  = Math.max(0, Math.min(120, parseInt(data.age) || 0));

            const settlers = DomainData.getSettlers();
            if (isNew) {
              settlers.push(DomainData.createSettler(data));
            } else {
              const idx = settlers.findIndex(s => s.id === settler.id);
              if (idx >= 0) settlers[idx] = { ...settler, ...data };
            }
            await DomainData.saveSettlers(settlers);
            this.render(false);
          }
        },
        cancel: {
          icon:  "<i class='fas fa-times'></i>",
          label: "Abbrechen"
        }
      },
      default: "save"
    }).render(true);
  }

  async _onDeleteSettler(event) {
    event.preventDefault();
    const id       = event.currentTarget.dataset.id;
    const settlers = DomainData.getSettlers();
    const settler  = settlers.find(s => s.id === id);
    if (!settler) return;

    const confirmed = await Dialog.confirm({
      title:   "Siedler entfernen",
      content: `<p>Siedler <strong>${settler.name}</strong> wirklich entfernen? (Kann nicht rückgängig gemacht werden.)</p>`
    });
    if (!confirmed) return;

    await DomainData.saveSettlers(settlers.filter(s => s.id !== id));
    this.render(false);
  }

  // ---------------------------------------------------------------------------
  // Gebäude-Verwaltung
  // ---------------------------------------------------------------------------

  async _onAddBuilding(event) {
    event.preventDefault();

    const typeOptions = Object.entries(BUILDING_TYPES).map(([key, val]) =>
      `<option value="${key}">${val.label} (${val.workerWeeksRequired} AW | 🪵${val.cost.wood} ⛏️${val.cost.stone} 💰${val.cost.gold})</option>`
    ).join("");

    new Dialog({
      title:   "Bauprojekt planen",
      content: `<form class="dm-dialog-form">
        <div class="form-group">
          <label>Gebäudetyp</label>
          <select name="typeKey">${typeOptions}</select>
        </div>
      </form>`,
      buttons: {
        add: {
          icon:     "<i class='fas fa-plus'></i>",
          label:    "Planen",
          callback: async (html) => {
            const typeKey = html.find("[name='typeKey']").val();
            const state   = DomainData.getDomainState();
            state.buildings = state.buildings ?? [];
            state.buildings.push(DomainData.createBuilding(typeKey));
            await DomainData.saveDomainState(state);
            this.render(false);
          }
        },
        cancel: { label: "Abbrechen" }
      },
      default: "add"
    }).render(true);
  }

  async _onStartConstruction(event) {
    event.preventDefault();
    const id    = event.currentTarget.dataset.id;
    const state = DomainData.getDomainState();
    const bldg  = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    bldg.status = "under_construction";
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _onDeleteBuilding(event) {
    event.preventDefault();
    const id    = event.currentTarget.dataset.id;
    const state = DomainData.getDomainState();
    const bldg  = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    const typeLabel = BUILDING_TYPES[bldg.typeKey]?.label ?? bldg.typeKey;
    const confirmed = await Dialog.confirm({
      title:   "Gebäude entfernen",
      content: `<p>Gebäude <strong>${typeLabel}</strong> wirklich entfernen?</p>`
    });
    if (!confirmed) return;

    state.buildings = state.buildings.filter(b => b.id !== id);
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  async _onBuildingWorkersChange(event) {
    const id      = event.currentTarget.dataset.id;
    const workers = Math.max(0, parseInt(event.currentTarget.value) || 0);
    const state   = DomainData.getDomainState();
    const bldg    = state.buildings?.find(b => b.id === id);
    if (!bldg) return;

    bldg.assignedWorkers = workers;
    await DomainData.saveDomainState(state);
    // Kein vollständiges Re-render bei jedem Tastendruck
  }

  // ---------------------------------------------------------------------------
  // GM-Einstellungen
  // ---------------------------------------------------------------------------

  async _onSaveGMSettings(event) {
    event.preventDefault();
    const html  = this.element;
    const state = DomainData.getDomainState();

    state.worldTension    = Math.max(0, Math.min(100, parseInt(html.find("[name='worldTension']").val())    || 0));
    state.deathDifficulty = Math.max(0, Math.min(95,  parseInt(html.find("[name='deathDifficulty']").val()) || 15));
    state.baseCapacity    = Math.max(1,               parseInt(html.find("[name='baseCapacity']").val())    || 10);

    await DomainData.saveDomainState(state);
    ui.notifications.info("Domain Manager: GM-Einstellungen gespeichert.");
    this.render(false);
  }

  async _onSetResources(event) {
    event.preventDefault();
    const html  = this.element;
    const state = DomainData.getDomainState();

    state.resources = {
      food:  Math.max(0, parseInt(html.find("[name='res-food']").val())  || 0),
      wood:  Math.max(0, parseInt(html.find("[name='res-wood']").val())  || 0),
      stone: Math.max(0, parseInt(html.find("[name='res-stone']").val()) || 0),
      gold:  Math.max(0, parseInt(html.find("[name='res-gold']").val())  || 0)
    };

    await DomainData.saveDomainState(state);
    ui.notifications.info("Domain Manager: Ressourcen aktualisiert.");
    this.render(false);
  }

  async _onClearLog(event) {
    event.preventDefault();
    const confirmed = await Dialog.confirm({
      title:   "Ereignislog leeren",
      content: "<p>Alle Log-Einträge unwiderruflich löschen?</p>"
    });
    if (!confirmed) return;

    const state = DomainData.getDomainState();
    state.log   = [];
    await DomainData.saveDomainState(state);
    this.render(false);
  }

  // ---------------------------------------------------------------------------
  // FormApplication-Pflicht
  // ---------------------------------------------------------------------------

  async _updateObject(_event, _formData) {
    // Alle Speicheroperationen erfolgen direkt in den Handler-Methoden.
  }

  // ---------------------------------------------------------------------------
  // Chat-Helfer (nur für GMs sichtbar)
  // ---------------------------------------------------------------------------

  static _postToGMChat(title, messages) {
    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
    ChatMessage.create({
      content: `<div class="domain-chat-card">
        <h3 class="domain-chat-title">${title}</h3>
        <ul class="domain-chat-list">
          ${messages.map(m => `<li>${m}</li>`).join("")}
        </ul>
      </div>`,
      speaker: { alias: "Domain Manager" },
      whisper: gmIds
    });
  }
}
