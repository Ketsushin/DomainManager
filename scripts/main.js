/**
 * main.js
 * Einstiegspunkt des Moduls.
 * Registriert Settings, prelädt Templates, bindet das Modul in die Foundry-UI ein
 * und stellt die App global unter `game.domainManager` bereit.
 */

import { DomainApp }  from "./domain-app.js";
import { DomainData } from "./domain-data.js";

// ---------------------------------------------------------------------------
// Initialisierung
// ---------------------------------------------------------------------------

Hooks.once("init", () => {
  console.log("Domain Manager | Initialisierung…");

  // Settings registrieren – scope: "world" damit alle Änderungen servergespeichert werden
  game.settings.register("domain-manager", "domainState", {
    name:   "Domain State",
    hint:   "Interner Zustand des Domain Managers (Ressourcen, Gebäude, Zeit…).",
    scope:  "world",
    config: false,
    type:   Object,
    default: DomainData.getDefaultDomainState()
  });

  game.settings.register("domain-manager", "settlers", {
    name:   "Settlers",
    hint:   "Array aller Siedler-Datensätze.",
    scope:  "world",
    config: false,
    type:   Array,
    default: []
  });

  // Templates vorladen (werden damit auch als Handlebars-Partials registriert)
  loadTemplates([
    "modules/domain-manager/templates/main-dashboard.hbs",
    "modules/domain-manager/templates/settler-directory.hbs",
    "modules/domain-manager/templates/building-planer.hbs",
    "modules/domain-manager/templates/gm-settings.hbs"
  ]);

  // Tastenkürzel: Alt + D öffnet den Domain Manager
  game.keybindings.register("domain-manager", "openApp", {
    name:    "Domain Manager öffnen",
    hint:    "Öffnet das Domain Manager Fenster (nur GM).",
    editable: [{ key: "KeyD", modifiers: ["Alt"] }],
    onDown: () => {
      if (game.user.isGM) _openOrFocus();
    }
  });
});

// ---------------------------------------------------------------------------
// Ready
// ---------------------------------------------------------------------------

Hooks.once("ready", () => {
  if (!game.user.isGM) return;

  // Globaler Zugriff für Makros: game.domainManager.open()
  game.domainManager = {
    open: _openOrFocus,
    DomainApp,
    DomainData
  };

  console.log(
    "Domain Manager | Bereit. Öffne mit Alt+D oder game.domainManager.open()."
  );
});

// ---------------------------------------------------------------------------
// Szenen-Toolbar-Button (erscheint in der linken Toolbox unter "Token-Controls")
// ---------------------------------------------------------------------------

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  // Button an die Token-Steuerliste anhängen
  const tokenControls = controls.find(c => c.name === "token");
  if (tokenControls) {
    tokenControls.tools.push({
      name:    "domain-manager",
      title:   "Domain Manager öffnen",
      icon:    "fas fa-fort-awesome",
      onClick: _openOrFocus,
      button:  true
    });
  }
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

let _appInstance = null;

function _openOrFocus() {
  if (_appInstance?.rendered) {
    _appInstance.bringToTop();
  } else {
    _appInstance = new DomainApp();
    _appInstance.render(true);
  }
}
