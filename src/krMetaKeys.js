// KR-Zähler-/Pool-Meta-Schlüssel und Default-Konfiguration.
// Abhängigkeitsfreies Blatt-Modul; aus krCounters.js ausgelagert und dort
// über das Barrel re-exportiert (verhaltensneutral).

export const KR_ANG = 'krAng'
export const KR_ABW = 'krAbw'
/** Mutterzeilen-Primärstempel (Ang/SRA/blaues Abw) in dieser KR — für LH-Prior-Budget. */
export const KR_MOTHER_PRIMARY_USED_THIS_ROUND = 'krMotherPrimaryUsedThisRound'
/**
 * Zusätzliche Parade (Helden-Einstellung): separates schwarzes Schild.
 * `0` = Ladung im Slot sichtbar, `1` = verbraucht (Stempel aktiv).
 */
export const KR_PARADE_EXTRA = 'krParadeExtra'
/** Sonstige reguläre Aktionen (z. B. Atem holen, Bewegen, Position, Taktik) */
export const KR_SRA = 'krSra'
/** Welche Aktionstypen den beiden vorderen Slots zugeordnet sind (Standard: Ang + Abw). */
export const KR_PAIR_MODE = 'krPairMode'
/** Erstes Aktionsfeld der Zeile: Angriff oder S.R.A. (UI-Dropdown). */
export const KR_FIRST_SLOT_KIND = 'krFirstSlotKind'
/**
 * Gemeinsame Ladung des ersten Aktionsfeldes (AN / S.R.A. / L.H.): bleibt beim Umschalten erhalten.
 * Fehlender Schlüssel: Migration aus dem jeweils aktiven Zählerfeld.
 */
export const KR_PRIMARY_LADUNG = 'krPrimaryLadung'
/** Zweite L.H.-Ladung (Schild → Feld); 0 = nur Grundladung (UI halbiert), 1 = voll. Fehlender Schlüssel = 1 (Altbestand). */
export const KR_LH_SECOND = 'krLhSecondCharge'
/** L.H. mit genau einer Aktion: klickbarer Stempel wie Ang./Abw./S.R.A./F.A. */
export const KR_LH_ACTION = 'krLhAction'
/** Freie Aktion (Zyklus): verbrauchte Klicks vs. Obergrenze. */
export const KR_FREE_ACTION = 'krFreeAction'
/** 1: L.H.-Feld per oberem Pfeil geleert (krLhAction 1 ohne Stempel); Rechtsklick −1 hebt Leerung auf, ohne zweite Ladung zu erfinden. */
export const KR_LH_VOID_BY_TRANSFER = 'krLhVoidByTransfer'
/**
 * 1: Ang./S.R.A.-Primärfeld per Umwandlung ins Abwehr-Schild geleert (wie L.H.
 * `KR_LH_VOID_BY_TRANSFER`); UI blendet das Aktions-Icon aus.
 */
export const KR_PRIMARY_VOID_BY_ABW_TRANSFER = 'krPrimaryVoidByAbwTransfer'

/**
 * Bei INI < 0 wird die Gesamtladung auf höchstens 1 reduziert (Priorität: erst
 * die Primärseite A, dann ggf. die Schildseite B). Die beiden Felder merken,
 * wie viele Marks durch die Sperre abgezogen wurden, damit sie bei INI ≥ 0
 * wieder ergänzt werden können.
 */
export const KR_INI_LOCK_MINUS_A = 'krIniLockMinusA'
export const KR_INI_LOCK_MINUS_B = 'krIniLockMinusB'

/**
 * Konfiguration des Verhaltens bei INI < 0 (pro Held, token-meta).
 * `heroIniNegActionsLost`: Anzahl Ladungen, die bei INI < 0 wegfallen (Standard 1).
 * `heroIniNegAngMode`: Schwert-Freigabe ('no' | 'yes' | 'zatOnly', Standard 'no').
 */
export const HERO_INI_NEG_ACTIONS_LOST = 'heroIniNegActionsLost'
export const HERO_INI_NEG_ANG_MODE = 'heroIniNegAngMode'

/**
 * Zustand der einzelnen 2.A.-Objekt-Slots (Wurzel-Phasen-Links).
 * Jeder Eintrag: `{ kind: 'ang'|'sra'|'lh'|'uo', marks: 0|1, lodgedAbw?: true }`.
 * `kind:'uo'` (Umwandel-Objekt): Ladung liegt im gemeinsamen `KR_ABW`, Primär zeigt Schild.
 * `lodgedAbw`: Ladung liegt im gemeinsamen `KR_ABW` (Zeile bleibt, Primär leer).
 * Fehlt der Eintrag, wird bei der Anzeige Kind = Mutter-Kind und `marks = 1`
 * angenommen (Kompatibilität mit alten Daten).
 */
export const KR_ZAO_SLOTS = 'krZaoSlots'

/** SL: Angriffsanteil des Umwandlungs-Speichers pro KR (mit `heroActionPoolAbw`, Summe konstant). */
export const HERO_ACTION_POOL_ANG = 'heroActionPoolAng'
/** SL: Abwehranteil des Umwandlungs-Speichers pro KR. */
export const HERO_ACTION_POOL_ABW = 'heroActionPoolAbw'
/** SL: Obergrenze ang+abw pro KR (1…20). Ohne Key: aus gespeichertem ang+abw abgeleitet. */
export const HERO_ACTION_POOL_MAX = 'heroActionPoolMax'
/** Laufzeit: Rest-Angriffsanteil in der laufenden KR. */
export const KR_ACTION_POOL_ANG_REM = 'krActionPoolAngRem'
/** Laufzeit: Rest-Abwehranteil in der laufenden KR. */
export const KR_ACTION_POOL_ABW_REM = 'krActionPoolAbwRem'

/**
 * 1: In dieser KR wurde bei INI&lt;0 eine Einheit vom Aktions- zum Reaktionspool
 * verschoben — wird bei INI wieder ≥0 symmetrisch zurückgenommen (keine Drift).
 */
export const KR_INI_NEG_POOL_SHIFT_APPLIED = 'krIniNegPoolShiftApplied'

/** Summe Aktions- + Reaktionsladungen pro KR (untere Grenze). */
export const MIN_HERO_ACTION_POOL_SUM = 1
export const MAX_HERO_ACTION_POOL_SUM = 20

/** Obergrenze für KR-Zähler-Markierungen. */
export const KR_COUNTER_MAX = 10

/**
 * Standard-Zähler für neue Kampf-Teilnehmer: je eine volle Ladung
 * im ersten Aktionsfeld und bei Abwehr (UI: Zähler 0 = Ladung geladen).
 */
export const DEFAULT_TRACKER_KR_COUNTERS = Object.freeze({
  [KR_ANG]: 0,
  [KR_ABW]: 0,
  [KR_SRA]: 0,
  [KR_FREE_ACTION]: 0,
  [KR_LH_ACTION]: 0,
  [KR_LH_SECOND]: 0,
  [KR_PRIMARY_LADUNG]: 0,
  [KR_PAIR_MODE]: 'ang_abw',
  [KR_FIRST_SLOT_KIND]: 'ang',
  [KR_MOTHER_PRIMARY_USED_THIS_ROUND]: 0,
})
