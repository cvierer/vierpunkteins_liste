// Statische Tooltip-/Regeltexte für den Heldenblock (Mouseover).
// Aus iniModMeta.js ausgelagert und dort über das Barrel re-exportiert.

/** Tooltip WS-Feld (Mouseover). */
export const WS_RULES_TOOLTIP =
  'Ohne Modifikationen liegt die WS bei KO/2. Wenn die erlittenen SP höher als die WS ist, bekommt man: eine Wunde, wenn SP > KO: zwei Wunden, wenn SP > 1,5 x KO: drei Wunden.'

/** Tooltip LE-Schwellen-Anzeige (Mouseover auf „S“). */
export const LE_THRESHOLD_TOOLTIP =
  'LE-Schwellenwerte. Weniger als 1/2 LE: alle Eigenschaftsproben, AT, PA und FK je um 1 erschwert, alle Zauber- und Talentproben 3 Punkte. Bei weniger 1/3: +2/+6. Weniger als 1/4: +3/+9. Bei LE 0 bis 5 kampfunfähig. LE 0 oder weniger: Tod in KO KR x 1W6.'

/** Regeltexte für die drei Wundmarken pro Trefferzone (Mouseover). */
export const WUNDEN_DOTS_TOOLTIP_BY_ZONE = {
  kopf:
    'Kopf (W20 19 bis 20): 1. und 2. Wunde: je KL, IN, MU, INI-Basis –2, INI –2W6; die 3. Wunde: +2W6 SP, bewusstlos, Blutverlust',
  brust:
    'Brust (W20: 15 bis 18): 1. und 2. Wunde: je AT, PA, KK, KO, AW –1, +1W6 SP; 3. Wunde bewusstlos, Blutverlust',
  ruecken:
    'Rücken (W20: 15 bis 18): 1. und 2. Wunde: je AT, PA, KK, KO, AW –1, +1W6 SP; 3. Wunde bewusstlos, Blutverlust',
  schildarm:
    'Arme (W20: 9, 11, 13 = Schildarm; 10, 12, 14 = Schwertarm): 1. und 2. Wunde: je AT, PA, FF, KK –2 mit getroffenem Arm; 3. Wunde: Arm handlungsunfähig',
  schwertarm:
    'Arme (W20: 9, 11, 13 = Schildarm; 10, 12, 14 = Schwertarm): 1. und 2. Wunde: je AT, PA, FF, KK –2 mit getroffenem Arm; 3. Wunde: Arm handlungsunfähig',
  bauch:
    'Bauch (W20: 7 bis 8): 1. und 2. Wunde: je AT, PA, GS, KK, KO, INI-Basis, AW –1, +1W6 SP; 3. Wunde: bewusstlos, Blutverlust',
  lbein:
    'Beine (W20: 1, 3, 5 = Bein links; 2, 4, 6 = Bein rechts): 1. und 2. Wunde: je AT, PA, AW, GE, INI-Basis –2, GS –1; 3. Wunde: Sturz, kampfunfähig',
  rbein:
    'Beine (W20: 1, 3, 5 = Bein links; 2, 4, 6 = Bein rechts): 1. und 2. Wunde: je AT, PA, AW, GE, INI-Basis –2, GS –1; 3. Wunde: Sturz, kampfunfähig',
}
