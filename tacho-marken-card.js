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
 *
 * Quelle: https://github.com/bryce2071/tacho-marken-card (MIT-Lizenz)
 */
const TMK_VERSION = "1.2.0";

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

    static getStubConfig() {
      return { entity: "", min: 0, max: 100, needle: true, marken: [] };
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
