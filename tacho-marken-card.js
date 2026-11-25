/*
 * Tacho mit Marken – Lovelace-Karte: Tacho wie die eingebaute Gauge-Karte (Bereiche, Zeiger),
 * zusätzlich Markierungsstriche für weitere Werte derselben Einheit, z. B. die PV-Prognose.
 * Beispiel: PV-Erzeugung heute mit der Tagesprognose (Strich) und dem aktuell erwarteten Wert (Dreieck).
 *
 * Konfiguration:
 *   type: custom:tacho-marken-card
 *   entity: sensor.pv_erzeugung_heute
 *   name: PV-Erzeugung heute
 *   min: 0
 *   max: 75
 *   needle: true                      # Zeiger (sonst gefüllter Bogen)
 *   segments:                         # wie bei der Gauge-Karte
 *     - {from: 0, color: "#ffcc80"}
 *   marken:                           # die erste Marke liegt oben
 *     - entity: sensor.pv_prognose_heute
 *       name: Prognose
 *       attribut_stand: stand         # optional: Attribut mit der Uhrzeit, erscheint als „(Stand 07:30)“
 *     - entity: sensor.pv_heute_erwartet
 *       name: Aktuell erwartet
 *       form: dreieck                 # Dreieck außen am Bogen statt Strich (bleibt auch dicht neben einem Strich erkennbar)
 *       farbe: "#2a78d6"              # optional, sonst Blau
 *   Striche können mit „gestrichelt: true“ gestrichelt werden.
 * Alle Einstellungen gehen auch im Bearbeiten-Dialog der Karte (seit 1.3.0).
 *
 * Quelle: https://github.com/bryce2071/tacho-marken-card (MIT-Lizenz)
 */
const TMK_VERSION = "1.3.0";

const R = 40; // Radius der Bogenmitte
const B = 15; // Bogenbreite
const TEXT_MAX = 44; // größte Breite des Werts (Einheiten), damit er den Zeiger nicht berührt
const SCHRIFT_MAX = 12;

export function zahlWert(st) {
  const n = st ? parseFloat(st.state) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Winkel 0 (min, links) … 180 (max, rechts)
export function winkel(wert, min, max) {
  if (!(max > min) || wert === null) return 0;
  return ((Math.min(Math.max(wert, min), max) - min) / (max - min)) * 180;
}

// Punkt auf dem Kreis um (0,0): Winkel 0 = links, 90 = oben, 180 = rechts (SVG-y nach unten)
export function punkt(r, w) {
  const rad = (w * Math.PI) / 180;
  return [-r * Math.cos(rad), -r * Math.sin(rad)];
}

export function bogen(r, w0, w1) {
  const [x0, y0] = punkt(r, w0);
  const [x1, y1] = punkt(r, w1);
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

// ungefähre Textbreite in em (Roboto-ähnlich), für die Schriftgröße des Werts
export function breiteEm(s) {
  let w = 0;
  for (const ch of String(s)) {
    if (/[0-9]/.test(ch)) w += 0.56;
    else if (/[.,:;'!|il]/.test(ch)) w += 0.26;
    else if (/\s/.test(ch)) w += 0.25;
    else if (/[mwMW]/.test(ch)) w += 0.86;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else w += 0.55;
  }
  return w;
}

export function schriftGroesse(text) {
  return Math.min(SCHRIFT_MAX, TEXT_MAX / Math.max(breiteEm(text), 0.5));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function zustandText(hass, st) {
  if (!st) return "–";
  if (["unknown", "unavailable"].includes(st.state)) return "–";
  if (hass && typeof hass.formatEntityState === "function") return hass.formatEntityState(st);
  const n = zahlWert(st);
  const e = (st.attributes && st.attributes.unit_of_measurement) || "";
  return n === null ? st.state : `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })}${e ? " " + e : ""}`;
}

// SVG des Tachos; die Marken ragen etwas über den Bogen hinaus
export function tachoSvg(m) {
  const segs = (m.segments || []).filter((s) => Number.isFinite(Number(s.from))).sort((a, b) => a.from - b.from);
  let html = `<path class="grund" d="${bogen(R, 0, 180)}"></path>`;
  if (m.needle) {
    for (const s of segs) {
      const w0 = winkel(Number(s.from), m.min, m.max);
      html += `<path class="stufe" style="stroke:${esc(s.color)}" d="${bogen(R, w0, 180)}"></path>`;
    }
  } else {
    const farbe = segs.filter((s) => m.wert !== null && m.wert >= s.from).map((s) => s.color).pop() || "var(--primary-color)";
    if (m.wert !== null && m.wert > m.min) html += `<path class="stufe" style="stroke:${esc(farbe)}" d="${bogen(R, 0, Math.max(winkel(m.wert, m.min, m.max), 0.5))}"></path>`;
  }
  // Marken: Striche quer über den Bogen (etwas über den Rand hinaus), Dreiecke außen am Bogen.
  // Erst alle Ränder, dann alle Striche, damit dicht beieinander liegende Striche sich nicht verdecken;
  // die erste Marke liegt oben.
  const sichtbar = m.marken.filter((mk) => mk.wert !== null).reverse();
  const linien = sichtbar.filter((mk) => mk.form !== "dreieck").map((mk) => {
    const w = winkel(mk.wert, m.min, m.max);
    const [xa, ya] = punkt(R - B / 2 - 2, w);
    const [xb, yb] = punkt(R + B / 2 + 3, w);
    return { mk, a: `x1="${xa.toFixed(2)}" y1="${ya.toFixed(2)}" x2="${xb.toFixed(2)}" y2="${yb.toFixed(2)}"` };
  });
  const dreiecke = sichtbar.filter((mk) => mk.form === "dreieck");
  if (sichtbar.length) {
    html += `<g class="marken">`;
    html += linien.map((l) => `<line class="halo" ${l.a}></line>`).join("");
    html += linien.map((l) => `<line class="strich${l.mk.gestrichelt ? " gestrichelt" : ""}" style="stroke:${esc(l.mk.farbe)}" ${l.a}><title>${esc(l.mk.titel)}</title></line>`).join("");
    html += dreiecke
      .map((mk) => `<path class="dreieck" style="fill:${esc(mk.farbe)}" d="M ${-(R + B / 2 + 1.2)} 0 L -54.9 -2.1 L -54.9 2.1 z" transform="rotate(${winkel(mk.wert, m.min, m.max).toFixed(2)})"><title>${esc(mk.titel)}</title></path>`)
      .join("");
    html += `</g>`;
  }
  if (m.needle && m.wert !== null) {
    html += `<path class="zeiger" d="M -25 -2.5 L -47.5 0 L -25 2.5 z" transform="rotate(${winkel(m.wert, m.min, m.max).toFixed(2)})"></path>`;
  }
  html += `<text class="wert" x="0" y="-0.8" font-size="${schriftGroesse(m.wertText).toFixed(2)}">${esc(m.wertText)}</text>`;
  return `<svg class="tacho" viewBox="-56 -56 112 58" role="img" aria-label="${esc(m.label)}">${html}</svg>`;
}

export function karteHtml(m) {
  const legende = m.marken.length
    ? `<div class="legende">${m.marken
        .map(
          (mk) =>
            `<span class="eintrag" title="${esc(mk.titel)}"><svg class="muster" viewBox="0 0 14 14" aria-hidden="true">${mk.form === "dreieck" ? `<path d="M 7 13 L 3 2.5 L 11 2.5 z" style="fill:${esc(mk.farbe)}"></path>` : `<line x1="7" y1="1" x2="7" y2="13" class="${mk.gestrichelt ? "gestrichelt" : ""}" style="stroke:${esc(mk.farbe)}"></line>`}</svg>${esc(mk.name)} <b>${esc(mk.text)}</b>${mk.stand ? ` <span class="stand">(Stand ${esc(mk.stand)})</span>` : ""}</span>`
        )
        .join("")}</div>`
    : "";
  return `<ha-card tabindex="0"><div class="innen">
  <div class="rahmen">${tachoSvg(m)}</div>
  <div class="name">${esc(m.name)}</div>
  ${legende}
</div></ha-card>`;
}

const CSS = `
:host { display: block; height: 100%; --tmk-blau: #2a78d6; }
:host(.dunkel) { --tmk-blau: #3987e5; }
ha-card { height: 100%; box-sizing: border-box; overflow: hidden; }
.innen { height: 100%; box-sizing: border-box; padding: 16px 16px 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; }
.rahmen { width: 100%; max-width: 400px; }
.tacho { display: block; width: 100%; overflow: visible; }
.grund { fill: none; stroke: var(--primary-background-color); stroke-width: ${B}; }
.stufe { fill: none; stroke-width: ${B}; }
.zeiger { fill: var(--primary-text-color); stroke: var(--card-background-color, var(--ha-card-background, #fff)); stroke-width: 1; stroke-linejoin: round; }
.marken line { stroke-linecap: round; }
.halo { stroke: var(--card-background-color, var(--ha-card-background, #fff)); stroke-width: 3.8; }
.dreieck { stroke: var(--card-background-color, var(--ha-card-background, #fff)); stroke-width: 1.2; stroke-linejoin: round; paint-order: stroke; }
.strich { stroke-width: 1.9; }
.strich.gestrichelt { stroke-width: 1.5; stroke-dasharray: 2.4 1.7; stroke-linecap: butt; }
.wert { fill: var(--primary-text-color); text-anchor: middle; direction: ltr; }
.name { margin-top: 10px; text-align: center; font-size: 15px; line-height: 1.3; color: var(--primary-text-color); }
.legende { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 16px; margin-top: 6px; font-size: 13px; line-height: 1.5; color: var(--secondary-text-color); }
.legende b { color: var(--primary-text-color); font-weight: 500; }
.eintrag { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.muster { width: 14px; height: 14px; flex: none; }
.muster line { stroke-width: 2.6; stroke-linecap: round; }
.muster line.gestrichelt { stroke-width: 2.2; stroke-dasharray: 3 2; stroke-linecap: butt; }
.stand { font-size: 12px; }
`;

if (typeof HTMLElement !== "undefined" && typeof customElements !== "undefined" && !customElements.get("tacho-marken-card")) {
  class TachoMarkenCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", () => this._mehrInfo());
      this.shadowRoot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._mehrInfo();
        }
      });
    }

    static getConfigElement() {
      return document.createElement("tacho-marken-card-editor");
    }

    static getStubConfig(hass) {
      const states = (hass && hass.states) || {};
      const id = Object.keys(states).find(
        (e) => e.startsWith("sensor.") && zahlWert(states[e]) !== null && states[e].attributes && states[e].attributes.unit_of_measurement
      );
      return { entity: id || "", min: 0, max: 100, needle: true, marken: [] };
    }

    setConfig(config) {
      if (!config || !config.entity) throw new Error("Bitte eine Entität angeben (entity: sensor.…)");
      const min = Number(config.min ?? 0);
      const max = Number(config.max ?? 100);
      if (!(max > min)) throw new Error("max muss größer als min sein");
      this._cfg = { ...config, min, max, needle: config.needle !== false, marken: Array.isArray(config.marken) ? config.marken : [] };
      this._alt = null;
      if (this._hass) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._cfg) return;
      // nur neu zeichnen, wenn sich ein beteiligter Zustand oder das Farbschema geändert hat
      const objs = [this._cfg.entity, ...this._cfg.marken.map((m) => m.entity)].map((id) => hass.states[id]);
      objs.push(!!(hass.themes && hass.themes.darkMode));
      if (this._alt && this._alt.length === objs.length && this._alt.every((o, i) => o === objs[i])) return;
      this._alt = objs;
      this._render();
    }

    connectedCallback() {
      requestAnimationFrame(() => this._einpassen());
    }

    getCardSize() {
      return 5;
    }

    getGridOptions() {
      return { columns: 6, rows: "auto", min_columns: 4 };
    }

    _mehrInfo() {
      if (!this._cfg) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this._cfg.entity }, bubbles: true, composed: true }));
    }

    // Schätzung der Schriftgröße nachmessen (nur möglich, wenn die Karte sichtbar ist)
    _einpassen() {
      const t = this.shadowRoot.querySelector("text.wert");
      if (!t || !this.isConnected) return;
      let w = 0;
      try {
        w = t.getComputedTextLength();
      } catch (e) {
        return;
      }
      if (w > TEXT_MAX + 0.5) t.setAttribute("font-size", ((parseFloat(t.getAttribute("font-size")) * TEXT_MAX) / w).toFixed(2));
    }

    _render() {
      const c = this._cfg;
      const h = this._hass;
      const st = h.states[c.entity];
      const wert = zahlWert(st);
      const marken = c.marken.map((mk) => {
        const ms = h.states[mk.entity];
        const v = zahlWert(ms);
        const stand = v !== null && mk.attribut_stand && ms && ms.attributes ? ms.attributes[mk.attribut_stand] || "" : "";
        const name = mk.name || (ms && ms.attributes && ms.attributes.friendly_name) || mk.entity;
        const text = zustandText(h, ms);
        return { wert: v, name, text, stand, form: mk.form === "dreieck" ? "dreieck" : "strich", gestrichelt: !!mk.gestrichelt, farbe: mk.farbe || "var(--tmk-blau)", titel: `${name}: ${text}${stand ? " (Stand " + stand + ")" : ""}` };
      });
      const name = c.name || (st && st.attributes && st.attributes.friendly_name) || c.entity;
      const wertText = zustandText(h, st);
      const m = {
        min: c.min,
        max: c.max,
        needle: c.needle,
        segments: c.segments,
        wert,
        wertText,
        name,
        marken,
        label: `${name}: ${wertText}` + marken.map((mk) => `, ${mk.name}: ${mk.text}`).join(""),
      };
      this.classList.toggle("dunkel", !!(h.themes && h.themes.darkMode));
      this.shadowRoot.innerHTML = `<style>${CSS}</style>${karteHtml(m)}`;
      this._einpassen();
    }
  }

  // ---------- Bearbeiten-Dialog ----------

  // HA lädt seine Formular-Bausteine (ha-form, Auswahlfelder) erst mit einem Editor –
  // notfalls einmal den Editor der Entitäten-Karte laden, dann sind sie da.
  let formVersprechen = null;
  const haFormLaden = () => {
    if (!formVersprechen) {
      formVersprechen = (async () => {
        try {
          if (!customElements.get("ha-form") && window.loadCardHelpers) {
            const helpers = await window.loadCardHelpers();
            const c = await helpers.createCardElement({ type: "entities", entities: [] });
            if (c && c.constructor && c.constructor.getConfigElement) await c.constructor.getConfigElement();
          }
        } catch (e) {
          /* dann bleibt der Code-Editor */
        }
      })();
    }
    return formVersprechen.then(() => customElements.whenDefined("ha-form"));
  };

  const hexZuRgb = (s) => {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(s || "").trim());
    if (!m) return undefined;
    const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const rgbZuHex = (rgb) =>
    Array.isArray(rgb) && rgb.length === 3
      ? "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, "0")).join("")
      : undefined;
  // Farbe aus dem Farbwähler übernehmen: Standard nicht festschreiben, eigene CSS-Farben (var(--…)) behalten
  const farbeAus = (rgb, alt, standard) => {
    const hex = rgbZuHex(rgb);
    if (hex) return alt || hex !== standard ? hex : undefined;
    return alt && !hexZuRgb(alt) ? alt : undefined;
  };

  const MARKE_BLAU = "#2a78d6";
  const STUFEN_FARBEN = ["#43a047", "#ffa726", "#db4437", "#2a78d6", "#8e5bd0"];

  const ED_STYLE = `
    :host { display: block; }
    .ed { display: flex; flex-direction: column; gap: 8px; }
    h3 { margin: 16px 0 0; font-size: 1em; font-weight: 500; color: var(--primary-color); }
    .hinweis { font-size: .85em; color: var(--secondary-text-color); margin: -4px 2px 2px; line-height: 1.4; }
    .liste { display: flex; flex-direction: column; gap: 8px; }
    .eintrag { border: 1px solid var(--divider-color, rgba(127, 127, 127, .3)); border-radius: 10px; padding: 4px 8px 6px; }
    .leiste { display: flex; align-items: center; gap: 2px; }
    .leiste .nr { flex: 1; min-width: 0; font-size: .9em; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .punkt { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
    .kn { border: 0; background: none; color: var(--secondary-text-color); padding: 4px; border-radius: 50%; cursor: pointer; display: inline-flex; }
    .kn:hover { background: rgba(127, 127, 127, .15); }
    .kn[disabled] { opacity: .35; cursor: default; background: none; }
    .kn.rot { color: var(--error-color, #db4437); }
    .kn ha-icon { --mdc-icon-size: 20px; }
    .tk { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--divider-color, rgba(127, 127, 127, .3));
      border-radius: 18px; padding: 5px 12px 5px 8px; background: none; color: var(--primary-color); font: inherit; font-size: .92em; cursor: pointer; }
    .tk ha-icon { --mdc-icon-size: 18px; }
    .neu { display: block; border: 1px dashed var(--divider-color, rgba(127, 127, 127, .4)); border-radius: 10px; padding: 6px 8px 2px; }
  `;

  const knopf = (icon, titel, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kn" + (cls ? ` ${cls}` : "");
    b.title = titel;
    b.setAttribute("aria-label", titel);
    b.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;
    return b;
  };
  const textKnopf = (icon, text) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tk";
    b.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span>${esc(text)}</span>`;
    return b;
  };

  const ED_LABEL = {
    entity: "Entität",
    name: "Name",
    min: "Minimum",
    max: "Maximum",
    needle: "Zeiger",
    from: "ab Wert",
    color: "Farbe",
    form: "Form",
    farbe: "Farbe",
    gestrichelt: "Gestrichelt",
    attribut_stand: "Attribut mit der Uhrzeit (optional)",
    neu: "Marke hinzufügen",
  };
  const ED_HILFE = {
    name: "Leer = Name der Entität.",
    needle: "Aus = gefüllter Bogen statt Zeiger.",
    gestrichelt: "Nur bei Strichen.",
    attribut_stand: "Erscheint in der Legende als „(Stand 07:30)“.",
    neu: "Entität mit einem Wert derselben Einheit auswählen.",
  };
  const KOPF_SCHEMA = [
    { name: "entity", required: true, selector: { entity: {} } },
    { name: "name", selector: { text: {} } },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "min", selector: { number: { mode: "box", step: "any" } } },
        { name: "max", selector: { number: { mode: "box", step: "any" } } },
      ],
    },
    { name: "needle", selector: { boolean: {} } },
  ];
  const STUFE_SCHEMA = [
    {
      name: "",
      type: "grid",
      schema: [
        { name: "from", selector: { number: { mode: "box", step: "any" } } },
        { name: "color", selector: { color_rgb: {} } },
      ],
    },
  ];
  const MARKE_SCHEMA = [
    { name: "entity", required: true, selector: { entity: {} } },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "name", selector: { text: {} } },
        {
          name: "form",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "strich", label: "Strich quer über den Bogen" },
                { value: "dreieck", label: "Dreieck außen am Bogen" },
              ],
            },
          },
        },
      ],
    },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "farbe", selector: { color_rgb: {} } },
        { name: "gestrichelt", selector: { boolean: {} } },
      ],
    },
    { name: "attribut_stand", selector: { attribute: {} }, context: { filter_entity: "entity" } },
  ];
  const NEU_SCHEMA = [{ name: "neu", selector: { entity: {} } }];
  const ORDNUNG = ["type", "entity", "name", "min", "max", "needle", "segments", "marken"];

  class TachoMarkenCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._cfg = {};
    }

    set hass(hass) {
      this._hass = hass;
      this.shadowRoot.querySelectorAll("ha-form").forEach((f) => {
        f.hass = hass;
      });
    }

    setConfig(config) {
      this._cfg = { ...(config || {}) };
      this._zeichnen();
    }

    connectedCallback() {
      if (this._gestartet) return;
      this._gestartet = true;
      haFormLaden().then(() => {
        this._bereit = true;
        this._zeichnen();
      });
    }

    _liste(k) {
      return (Array.isArray(this._cfg[k]) ? this._cfg[k] : []).map((x) => ({ ...(x || {}) }));
    }

    _form(schema, onChange) {
      const f = document.createElement("ha-form");
      f.computeLabel = (s) => ED_LABEL[s.name] || s.name;
      f.computeHelper = (s) => ED_HILFE[s.name] || "";
      f.hass = this._hass;
      f.schema = schema;
      f.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        onChange({ ...((ev.detail && ev.detail.value) || {}) });
      });
      return f;
    }

    _daten(f, d) {
      if (f && JSON.stringify(f.data) !== JSON.stringify(d)) f.data = d;
    }

    // Aufbau nur, wenn sich die Zahl der Farbbereiche oder Marken ändert – sonst nur neue Daten
    // (so bleibt beim Tippen der Fokus im Feld)
    _zeichnen() {
      if (!this._bereit) return;
      const c = this._cfg;
      const stufen = this._liste("segments");
      const marken = this._liste("marken");
      const bau = `${stufen.length}|${marken.length}`;
      if (bau !== this._bau) {
        this._bau = bau;
        this._aufbauen(stufen.length, marken.length);
      }
      this._daten(this._kopf, {
        entity: c.entity || "",
        name: c.name || "",
        min: c.min === undefined || c.min === "" ? 0 : Number(c.min),
        max: c.max === undefined || c.max === "" ? 100 : Number(c.max),
        needle: c.needle !== false,
      });
      stufen.forEach((s, i) => {
        this._daten(this._stufenFormen[i], { from: Number.isFinite(Number(s.from)) ? Number(s.from) : undefined, color: hexZuRgb(s.color) });
        this._stufenKoepfe[i].innerHTML = `<span class="punkt" style="background:${esc(s.color || "transparent")}"></span>Farbbereich ${i + 1}`;
      });
      marken.forEach((mk, i) => {
        const farbe = mk.farbe || MARKE_BLAU;
        this._daten(this._markenFormen[i], {
          entity: mk.entity || "",
          name: mk.name || "",
          form: mk.form === "dreieck" ? "dreieck" : "strich",
          farbe: hexZuRgb(farbe),
          gestrichelt: !!mk.gestrichelt,
          attribut_stand: mk.attribut_stand || "",
        });
        const st = mk.entity && this._hass ? this._hass.states[mk.entity] : null;
        const name = mk.name || (st && st.attributes.friendly_name) || mk.entity || "";
        this._markenKoepfe[i].innerHTML = `<span class="punkt" style="background:${esc(farbe)}"></span>Marke ${i + 1}${name ? ` · ${esc(name)}` : ""}`;
      });
    }

    _eintrag(liste, titel, i, n, mitPfeilen, onChange, schema, art) {
      const box = document.createElement("div");
      box.className = "eintrag";
      box.dataset[art] = String(i);
      const leiste = document.createElement("div");
      leiste.className = "leiste";
      const nr = document.createElement("span");
      nr.className = "nr";
      leiste.appendChild(nr);
      if (mitPfeilen) {
        const hoch = knopf("mdi:arrow-up", "nach oben");
        const runter = knopf("mdi:arrow-down", "nach unten");
        hoch.disabled = i === 0;
        runter.disabled = i === n - 1;
        hoch.addEventListener("click", () => this._verschieben(art, i, -1));
        runter.addEventListener("click", () => this._verschieben(art, i, 1));
        leiste.append(hoch, runter);
      }
      const weg = knopf("mdi:delete-outline", titel, "rot");
      weg.addEventListener("click", () => this._entfernen(art, i));
      leiste.appendChild(weg);
      const f = this._form(schema, onChange);
      box.append(leiste, f);
      liste.appendChild(box);
      return { f, nr };
    }

    _aufbauen(nStufen, nMarken) {
      const root = this.shadowRoot;
      root.innerHTML = `<style>${ED_STYLE}</style><div class="ed"></div>`;
      const ed = root.querySelector(".ed");
      this._kopf = this._form(KOPF_SCHEMA, (v) => this._kopfGeaendert(v));
      ed.appendChild(this._kopf);

      const h1 = document.createElement("h3");
      h1.textContent = "Farbbereiche";
      const t1 = document.createElement("div");
      t1.className = "hinweis";
      t1.textContent = "Wie bei der Tacho-Karte: ab welchem Wert welche Farbe gilt. Mit Zeiger ist der ganze Bogen eingefärbt, ohne Zeiger der Bogen bis zum Wert.";
      const l1 = document.createElement("div");
      l1.className = "liste";
      ed.append(h1, t1, l1);
      this._stufenFormen = [];
      this._stufenKoepfe = [];
      for (let i = 0; i < nStufen; i += 1) {
        const { f, nr } = this._eintrag(l1, "Farbbereich entfernen", i, nStufen, false, (v) => this._stufeGeaendert(i, v), STUFE_SCHEMA, "stufe");
        this._stufenFormen.push(f);
        this._stufenKoepfe.push(nr);
      }
      const plus = textKnopf("mdi:plus", "Farbbereich hinzufügen");
      plus.addEventListener("click", () => this._stufeNeu());
      ed.appendChild(plus);

      const h2 = document.createElement("h3");
      h2.textContent = "Marken";
      const t2 = document.createElement("div");
      t2.className = "hinweis";
      t2.textContent = "Weitere Werte derselben Einheit, z. B. eine Prognose. Die erste Marke liegt oben.";
      const l2 = document.createElement("div");
      l2.className = "liste";
      ed.append(h2, t2, l2);
      this._markenFormen = [];
      this._markenKoepfe = [];
      for (let i = 0; i < nMarken; i += 1) {
        const { f, nr } = this._eintrag(l2, "Marke entfernen", i, nMarken, true, (v) => this._markeGeaendert(i, v), MARKE_SCHEMA, "marke");
        this._markenFormen.push(f);
        this._markenKoepfe.push(nr);
      }
      const neu = this._form(NEU_SCHEMA, (v) => {
        if (!v.neu) return;
        neu.data = { neu: "" };
        this._senden({ ...this._cfg, marken: [...this._liste("marken"), { entity: v.neu }] });
      });
      neu.className = "neu";
      neu.data = { neu: "" };
      ed.appendChild(neu);
    }

    _kopfGeaendert(v) {
      const c = { ...this._cfg };
      if (v.entity) c.entity = v.entity;
      else delete c.entity;
      if (v.name) c.name = v.name;
      else delete c.name;
      for (const [k, standard] of [["min", 0], ["max", 100]]) {
        const n = v[k] === undefined || v[k] === null || v[k] === "" ? NaN : Number(v[k]);
        // den Standardwert nur schreiben, wenn er schon in der Konfiguration stand
        if (Number.isFinite(n) && !(n === standard && this._cfg[k] === undefined)) c[k] = n;
        else if (!Number.isFinite(n)) delete c[k];
      }
      if (v.needle === false) c.needle = false;
      else delete c.needle;
      this._senden(c);
    }

    _stufeGeaendert(i, v) {
      const stufen = this._liste("segments");
      const alt = stufen[i] || {};
      const neu = { ...alt };
      const n = v.from === undefined || v.from === null || v.from === "" ? NaN : Number(v.from);
      if (Number.isFinite(n)) neu.from = n;
      const farbe = farbeAus(v.color, alt.color, undefined);
      if (farbe) neu.color = farbe;
      stufen[i] = neu;
      this._senden({ ...this._cfg, segments: stufen });
    }

    _stufeNeu() {
      const stufen = this._liste("segments");
      const min = Number.isFinite(Number(this._cfg.min)) ? Number(this._cfg.min) : 0;
      const max = Number.isFinite(Number(this._cfg.max)) ? Number(this._cfg.max) : 100;
      const werte = stufen.map((s) => Number(s.from)).filter(Number.isFinite);
      const schritt = Math.max((max - min) / 4, Number.EPSILON);
      let from = werte.length ? Math.max(...werte) + schritt : min;
      if (from >= max) from = werte.length ? Math.max(...werte) : min;
      from = Math.round(from * 100) / 100;
      stufen.push({ from, color: STUFEN_FARBEN[stufen.length % STUFEN_FARBEN.length] });
      this._senden({ ...this._cfg, segments: stufen });
    }

    _markeGeaendert(i, v) {
      const marken = this._liste("marken");
      const alt = marken[i] || {};
      const neu = { ...alt };
      if (v.entity) neu.entity = v.entity; // leeren geht nicht – zum Entfernen den Papierkorb nehmen
      if (v.entity && v.entity !== alt.entity) delete neu.attribut_stand;
      if (v.name) neu.name = v.name;
      else delete neu.name;
      if (v.form === "dreieck") neu.form = "dreieck";
      else delete neu.form;
      const farbe = farbeAus(v.farbe, alt.farbe, MARKE_BLAU);
      if (farbe) neu.farbe = farbe;
      else delete neu.farbe;
      if (v.gestrichelt === true) neu.gestrichelt = true;
      else delete neu.gestrichelt;
      if (v.attribut_stand && !(v.entity && v.entity !== alt.entity)) neu.attribut_stand = v.attribut_stand;
      else delete neu.attribut_stand;
      marken[i] = neu;
      this._senden({ ...this._cfg, marken });
    }

    _verschieben(art, i, d) {
      const k = art === "stufe" ? "segments" : "marken";
      const liste = this._liste(k);
      const j = i + d;
      if (j < 0 || j >= liste.length) return;
      [liste[i], liste[j]] = [liste[j], liste[i]];
      this._senden({ ...this._cfg, [k]: liste });
    }

    _entfernen(art, i) {
      const k = art === "stufe" ? "segments" : "marken";
      const liste = this._liste(k);
      liste.splice(i, 1);
      const c = { ...this._cfg, [k]: liste };
      if (k === "segments" && !liste.length) delete c.segments;
      this._senden(c);
    }

    _senden(c) {
      // feste Reihenfolge, damit der Code-Editor übersichtlich bleibt
      const aus = {};
      ORDNUNG.forEach((k) => {
        if (c[k] !== undefined) aus[k] = c[k];
      });
      Object.keys(c).forEach((k) => {
        if (!(k in aus)) aus[k] = c[k];
      });
      this._cfg = aus;
      this._zeichnen();
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: aus }, bubbles: true, composed: true }));
    }
  }

  if (!customElements.get("tacho-marken-card-editor")) customElements.define("tacho-marken-card-editor", TachoMarkenCardEditor);
  customElements.define("tacho-marken-card", TachoMarkenCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "tacho-marken-card",
    name: "Tacho mit Marken",
    description: "Tacho wie die Gauge-Karte, mit Markierungsstrichen für weitere Werte (z. B. Prognose).",
    preview: false,
  });
  console.info(`%c TACHO-MARKEN-CARD %c ${TMK_VERSION} `, "background:#2a78d6;color:#fff", "background:#ddd;color:#000");
}
