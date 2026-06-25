// Heldenblock-Meta-Schlüssel (Token-Metadata-Feldnamen) und UI-Symbole.
// Reine Konstanten ohne Laufzeit-Abhängigkeiten; aus iniModMeta.js ausgelagert
// und dort über das Barrel re-exportiert (verhaltensneutral).

export const HERO_EX_LE = 'heroExLe'
export const HERO_EX_LE_MAX = 'heroExLeMax'
export const HERO_EX_AU_MAX = 'heroExAuMax'
export const HERO_EX_AE_MAX = 'heroExAeMax'
export const HERO_EX_KE_MAX = 'heroExKeMax'
export const HERO_EX_AE = 'heroExAe'
export const HERO_EX_AT = 'heroExAt'
export const HERO_EX_PA = 'heroExPa'
/** Konstitution (Eigenschaft), nur in der Eigenschaftenzeile */
export const HERO_EX_KO = 'heroExKo'
export const HERO_EX_TP = 'heroExTp'
/** Ausweichen (AW), Kampfzeile */
export const HERO_EX_A = 'heroExA'
/** @deprecated Nicht mehr in der UI; wird beim Speichern entfernt */
export const HERO_EX_B = 'heroExB'
/** @deprecated Nicht mehr in der UI; wird beim Speichern entfernt */
export const HERO_EX_C = 'heroExC'
export const HERO_EX_SP = 'heroExSp'
export const HERO_EX_TZ = 'heroExTz'
export const HERO_EX_FRONTAL = 'heroExFrontal'
export const HERO_EX_FK = 'heroExFk'
/** Geschwindigkeit (GS) */
export const HERO_EX_GS = 'heroExGs'
/** Geschosse (Legacy-Metaschlüssel; nicht mehr in der UI) */
export const HERO_EX_G = 'heroExG'
/** Magieresistenz (MR) */
export const HERO_EX_MR = 'heroExMr'
/** Ini-Basis + Modifikation (IB) */
export const HERO_EX_IB = 'heroExIb'
/** W6-Wurf / Kurznotiz zum Wurf */
export const HERO_EX_W6 = 'heroExW6'
/** Wundschwelle + Modifikation (WS) */
export const HERO_EX_WS = 'heroExWs'
/** @deprecated Ersetzt durch Trefferzonen hz*; wird beim Speichern entfernt */
export const HERO_EX_WAPPEN_RS = 'heroExWappenRs'
/** @deprecated Ersetzt durch Trefferzonen hz*; wird beim Speichern entfernt */
export const HERO_EX_WAPPEN_WUNDEN = 'heroExWappenW'
export const HERO_EX_MU = 'heroExMu'
export const HERO_EX_KL = 'heroExKl'
export const HERO_EX_IN = 'heroExIn'
export const HERO_EX_CH = 'heroExCh'
export const HERO_EX_FF = 'heroExFf'
export const HERO_EX_GE = 'heroExGe'
export const HERO_EX_KK = 'heroExKk'
/** Behinderung (BE) */
export const HERO_EX_BE = 'heroExBe'
/** @deprecated Nur Lesen/Migration, nicht mehr in der UI */
export const HERO_EX_AMOD = 'heroExAMod'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_BMOD = 'heroExBMod'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_CMOD = 'heroExCMod'
/** Ausdauer (AU), Heldenblock Trefferzonen-Zeile */
export const HERO_EX_AU = 'heroExAu'
/** @deprecated Nur Lesen/Migration — ersetzt durch heroExExtraField */
export const HERO_EX_KE = 'heroExKe'
/** @deprecated Nur Lesen/Migration — ersetzt durch heroExExtraField */
export const HERO_EX_ENERGY_MODE = 'heroExEnergyMode'
/** Zusatzfeld zwischen AE und MR: none | ke | gw | lo */
export const HERO_EX_EXTRA_FIELD = 'heroExExtraField'
/** Gefahrenwert (GW) */
export const HERO_EX_GW = 'heroExGw'
/** Loyalität (LO) */
export const HERO_EX_LO = 'heroExLo'
export const HERO_EX_SHOW_FK = 'heroExShowFk'
/** AU-Feld im Heldenblock (Standard aus) */
export const HERO_EX_SHOW_AU = 'heroExShowAu'
export const HERO_EX_LE_THRESHOLD = 'heroExLeThreshold'
export const HERO_EX_UNFAEHIG_THRESHOLD = 'heroExUnfaehigThreshold'
export const HERO_EX_UNFAEHIG_MARK_FIELDS = 'heroExUnfaehigMarkFields'
export const HERO_EX_UNFAEHIG_FIXED_FIELDS = 'heroExUnfaehigFixedFields'
export const HERO_DEATH_MODE = 'heroDeathMode'
export const HERO_DEATH_AT_MINUS_ONE_POINT_FIVE_KO = 'heroDeathAtMinusOnePointFiveKo'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_AEKE_LEGACY = 'heroExAeKe'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_WUNDEN_ANZ = 'heroExWnAnz'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_WUNDEN_ORT = 'heroExWnOrt'
/** @deprecated Nur Lesen/Migration */
export const HERO_EX_WUNDEN_LEGACY = 'heroExWunden'
/** @deprecated Zusatzfeld derzeit nicht in der ausklappbaren Zeile */
export const HERO_EX_ZUSATZ = 'heroExZusatz'

/** Auf dem Container von `mountHeroExpandBlock`: vor Listen-Remount flushen. */
export const HERO_EXPAND_BODY_FLUSH = Symbol('vierpunkteinsHeroExpandFlush')
/** Gesetzt solange uncommittete Heldenblock-Eingaben (persistTimer) pending sind. */
export const HERO_EXPAND_HAS_PENDING_INPUT = Symbol(
  'vierpunkteinsHeroExpandPendingInput'
)
