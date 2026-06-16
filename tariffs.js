// tariffs.js — Données EDF Tempo. POINT UNIQUE DE MISE À JOUR.
// ---------------------------------------------------------------------------
// Grille tarifaire réglementée en €/kWh TTC, en vigueur depuis le 1ᵉʳ février 2026.
// Les tarifs Tempo sont révisés ~deux fois par an (CRE, février & août).
// À revérifier sur : https://particulier.edf.fr/fr/accueil/gestion-contrat/options/tempo.html
// Source de cette grille : https://www.hellowatt.fr/blog/tarifs-edf-tempo-nouvelle-grille-prix/
// ---------------------------------------------------------------------------

export const TARIFF_DATE = "1ᵉʳ février 2026";

// codeJour (renvoyé par l'API) → couleur du jour Tempo
//   0 = Inconnu (pas encore annoncé) · 1 = Bleu · 2 = Blanc · 3 = Rouge
// hp = prix Heures Pleines (6h–22h) · hc = prix Heures Creuses (22h–6h), €/kWh TTC.
export const COLORS = {
  0: { id: "inconnu", nom: "Inconnu", hp: null,   hc: null   },
  1: { id: "bleu",    nom: "Bleu",    hp: 0.1612, hc: 0.1325 },
  2: { id: "blanc",   nom: "Blanc",   hp: 0.1871, hc: 0.1499 },
  3: { id: "rouge",   nom: "Rouge",   hp: 0.7060, hc: 0.1575 },
};

// Ordre d'affichage (du moins cher au plus cher).
export const COLOR_ORDER = [1, 2, 3];

// Quotas de jours par saison Tempo (1ᵉʳ sept → 31 août).
export const QUOTAS = { bleu: 300, blanc: 43, rouge: 22 };

// Plage Heures Creuses : 22h00 → 06h00 (heure locale).
export const HC_START = 22; // 22:00
export const HC_END = 6; //   06:00

// Heure (locale) à laquelle la couleur du lendemain est généralement publiée.
export const ANNOUNCE_HOUR = 11; // ~11h00

// Le tarif le plus bas possible sert de référence dans le simulateur d'usage :
// un jour Bleu, en heures creuses.
export const CHEAPEST_PRICE = COLORS[1].hc;

/** Sommes-nous en heures creuses à l'instant `date` ? */
export function isHC(date = new Date()) {
  const h = date.getHours();
  return h >= HC_START || h < HC_END;
}

/** Période Tempo en cours (ex. "2025-2026"), basée sur le 1ᵉʳ septembre. */
export function currentPeriod(date = new Date()) {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 8 ? y : y - 1; // septembre = index 8
  return `${startYear}-${startYear + 1}`;
}

/** Prix €/kWh pour un codeJour + un créneau (true = HC). null si Inconnu. */
export function priceFor(codeJour, hc) {
  const c = COLORS[codeJour] || COLORS[0];
  return hc ? c.hc : c.hp;
}
