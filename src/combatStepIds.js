import { TRACKER_ID } from './participants.js'

/** Synthetischer Zug „Ende der Kampfrunde“ (INI intern 0); kein Szenen-Token. */
export const ROUND_END_STEP_ID = `${TRACKER_ID}/roundEndStep`
/** Synthetischer Zug „Beginn der Kampfrunde“ (Listenkopf); kein Szenen-Token. */
export const ROUND_START_STEP_ID = `${TRACKER_ID}/roundStartStep`
