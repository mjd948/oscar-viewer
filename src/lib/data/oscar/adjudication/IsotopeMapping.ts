import WebIdAnalysisResult, {IWebIdIsotope} from "@/lib/data/oscar/adjudication/WebId";
import {extractLatestAdjudicationCode} from "@/lib/data/oscar/adjudication/EmlMetadata";
import type {EventTableData} from "@/lib/data/oscar/TableHelpers";

export const CANONICAL_ISOTOPE_CHOICES = [
    "Unknown",
    "Neptunium",
    "Plutonium",
    "Uranium233",
    "Uranium235",
    "Uranium238",
    "Americium",
    "Barium",
    "Bismuth",
    "Californium",
    "Cesium134",
    "Cesium137",
    "Cobalt57",
    "Cobalt60",
    "Europium152",
    "Iridium",
    "Manganese",
    "Selenium",
    "Sodium",
    "Strontium",
    "Fluorine",
    "Gallium",
    "Iodine123",
    "Iodine131",
    "Indium",
    "Palladium",
    "Technetium",
    "Xenon",
    "Potassium",
    "Radium",
    "Thorium",
] as const;

export type CanonicalIsotopeKey = (typeof CANONICAL_ISOTOPE_CHOICES)[number];

export type UpSetSetName =
    | "Gamma"
    | "NORM"
    | "Unknown"
    | "Industrial"
    | "Medical"
    | "SNM"
    | "Neutron";

export type UpSetSourceCategory = "NORM" | "Unknown" | "Industrial" | "Medical" | "SNM";

export interface UpSetSetTotalItem {
    name: UpSetSetName | string;
    count: number;
    snm?: boolean;
}

export interface UpSetIntersectionItem {
    mask?: number;
    label: string;
    sets?: string[];
    activeSets?: string[];
    count: number;
    percentPct?: number;
    snmPresent: boolean;
}

export interface UpSetCoOccurrencePayload {
    totalOccupancies: number;
    sets: UpSetSetTotalItem[];
    intersections: UpSetIntersectionItem[];
}

export interface DisplayedUpSetColumnItem extends UpSetIntersectionItem {
    coOccurringSets: string[];
    otherSnmRollup: boolean;
    rolledUpMasks: number[];
    excludedSnmMasks: number[];
    rolledUpCombinationCount: number;
}

export type UpSetFilterSelection =
    | {
          kind: "category";
          setName: UpSetSetName | string;
          bit: number;
          label: string;
          count: number;
          snmPresent: boolean;
      }
    | {
          kind: "intersection";
          mask: number;
          label: string;
          count: number;
          snmPresent: boolean;
      }
    | {
          kind: "otherSnm";
          masks: number[];
          excludedMasks: number[];
          label: string;
          count: number;
          snmPresent: true;
      };

export const UPSET_OTHER_SNM_SYNTHETIC_MASK = -1000;

export interface N42AlarmReportItem {
    samplingTime?: string | number;
    alarmCategoryCode?: string;
    alarmDescription?: string;
}

export interface DeviceNuclideMatch {
    rawName: string;
    canonicalIsotope: CanonicalIsotopeKey;
    category: UpSetSourceCategory | null;
    confidenceText: string;
    confidenceScore: number;
}

const CANONICAL_SET = new Set<string>(CANONICAL_ISOTOPE_CHOICES);

const NON_THREAT_PLACEHOLDERS = new Set<string>([
    "",
    "none",
    "nothing",
    "background",
    "bkg",
    "bg",
    "null",
    "n/a",
    "na",
]);

/**
 * Maps vendor N42, IAEA .spe, RadComm Syclone, or Sandia WebID nuclide strings
 * (e.g. "I131", "I-131", "Iodine 131", "K40", "Ba133", "WGPu", "HEU", "Tc-99m")
 * to OSCAR's canonical 31-option IsotopeSelect keys.
 */
export function mapNuclideToCanonicalIsotope(rawName: string | null | undefined): CanonicalIsotopeKey | null {
    if (!rawName) return null;
    const trimmed = rawName.trim();
    if (!trimmed) return null;

    if (CANONICAL_SET.has(trimmed)) {
        return trimmed as CanonicalIsotopeKey;
    }

    const compact = trimmed.replace(/[\s_()-]+/g, "").toLowerCase();
    if (NON_THREAT_PLACEHOLDERS.has(compact)) {
        return null;
    }

    if (compact.startsWith("unk") || compact === "unidentified") return "Unknown";
    if (compact.startsWith("np") || compact.startsWith("neptunium")) return "Neptunium";
    if (compact.startsWith("pu") || compact.startsWith("wgpu") || compact.startsWith("rgpu") || compact.startsWith("plutonium")) {
        return "Plutonium";
    }
    if (compact === "u233" || compact === "uranium233") return "Uranium233";
    if (compact === "u235" || compact === "uranium235" || compact.startsWith("heu")) return "Uranium235";
    if (
        compact === "u238"
        || compact === "uranium238"
        || compact.startsWith("du")
        || compact === "depleteduranium"
        || compact.startsWith("leu")
        || compact.startsWith("unat")
        || compact === "naturaluranium"
        || compact === "uranium"
    ) {
        return "Uranium238";
    }
    if (compact.startsWith("am241") || compact === "am" || compact.startsWith("americium")) return "Americium";
    if (compact.startsWith("ba133") || compact === "ba" || compact.startsWith("barium")) return "Barium";
    if (compact.startsWith("bi2") || compact === "bi" || compact.startsWith("bismuth")) {
        return "Bismuth";
    }
    if (compact.startsWith("cf252") || compact === "cf" || compact.startsWith("californium")) return "Californium";
    if (compact === "cs134" || compact === "cesium134" || compact === "caesium134") return "Cesium134";
    if (compact === "cs137" || compact === "cs" || compact.startsWith("cesium") || compact.startsWith("caesium")) {
        return "Cesium137";
    }
    if (compact === "co57" || compact === "cobalt57") return "Cobalt57";
    if (compact === "co60" || compact === "co" || compact.startsWith("cobalt")) return "Cobalt60";
    if (compact.startsWith("eu152") || compact.startsWith("eu154") || compact === "eu" || compact.startsWith("europium")) {
        return "Europium152";
    }
    if (compact.startsWith("ir192") || compact === "ir" || compact.startsWith("iridium")) return "Iridium";
    if (compact.startsWith("mn54") || compact === "mn" || compact.startsWith("manganese")) return "Manganese";
    if (compact.startsWith("se75") || compact === "se" || compact.startsWith("selenium")) return "Selenium";
    if (compact.startsWith("na22") || compact.startsWith("na24") || compact === "na" || compact.startsWith("sodium")) {
        return "Sodium";
    }
    if (compact.startsWith("sr90") || compact.startsWith("sr89") || compact === "sr" || compact.startsWith("strontium")) {
        return "Strontium";
    }
    if (
        compact.startsWith("f18")
        || compact === "fdg"
        || compact.includes("annihilation")
        || compact === "511kev"
        || compact.startsWith("fluorine")
    ) {
        return "Fluorine";
    }
    if (compact.startsWith("ga67") || compact.startsWith("ga68") || compact === "ga" || compact.startsWith("gallium")) {
        return "Gallium";
    }
    if (compact === "i123" || compact === "iodine123") return "Iodine123";
    if (compact === "i131" || compact === "i125" || compact.startsWith("iodine")) return "Iodine131";
    if (compact.startsWith("in111") || compact.startsWith("indium")) return "Indium";
    if (compact.startsWith("pd103") || compact === "pd" || compact.startsWith("palladium")) return "Palladium";
    if (compact.startsWith("tc99") || compact === "tc" || compact.startsWith("technetium")) return "Technetium";
    if (compact.startsWith("xe133") || compact.startsWith("xe135") || compact === "xe" || compact.startsWith("xenon")) {
        return "Xenon";
    }
    if (compact.startsWith("k40") || compact === "k" || compact.startsWith("potassium")) return "Potassium";
    if (compact.startsWith("ra226") || compact === "ra" || compact.startsWith("radium")) return "Radium";
    if (compact.startsWith("th232") || compact.startsWith("th228") || compact === "th" || compact.startsWith("thorium")) {
        return "Thorium";
    }

    // Other recognized medical/industrial radionuclides not individually enumerated in the 31-choice menu
    // (e.g. Lu-177, Tl-201, Sm-153, Ho-166m, Y-88) fall back to "Unknown" rather than dropping silently
    if (/^[a-z]{1,3}\d{2,3}m?$/i.test(compact)) {
        return "Unknown";
    }
    return null;
}

/**
 * Normalizes a list of raw nuclide strings into deduplicated canonical IsotopeSelect keys.
 * Because IsotopeSelect treats "Unknown" as mutually exclusive with named isotopes,
 * "Unknown" is retained only when no named isotopes are present.
 */
export function normalizeIsotopeListForSelect(rawNames: readonly (string | null | undefined)[]): CanonicalIsotopeKey[] {
    const named: CanonicalIsotopeKey[] = [];
    let sawUnknown = false;
    for (const raw of rawNames) {
        const mapped = mapNuclideToCanonicalIsotope(raw);
        if (!mapped) continue;
        if (mapped === "Unknown") {
            sawUnknown = true;
        } else if (!named.includes(mapped)) {
            named.push(mapped);
        }
    }
    if (named.length > 0) {
        return named;
    }
    return sawUnknown ? ["Unknown"] : [];
}

/**
 * Scores WebID or N42 confidence strings/numbers on a unified 0..100 scale.
 * Sandia Full Spectrum WebID uses single-letter confidenceStr ("H", "G", "M", "F", "L", "P")
 * plus numeric confidence (typically 0..10).
 */
export function rankConfidenceScore(
    confidenceNum?: number | string | null,
    confidenceStr?: string | null,
): number {
    let letterScore = 0;
    if (confidenceStr) {
        const clean = confidenceStr.trim().toUpperCase();
        if (clean === "H" || clean.startsWith("HIGH") || clean.startsWith("CERTAIN")) letterScore = 90;
        else if (clean === "G" || clean.startsWith("GOOD")) letterScore = 80;
        else if (clean === "M" || clean.startsWith("MED") || clean.startsWith("MOD")) letterScore = 65;
        else if (clean === "F" || clean.startsWith("FAIR")) letterScore = 50;
        else if (clean === "L" || clean.startsWith("LOW")) letterScore = 35;
        else if (clean === "P" || clean.startsWith("POOR")) letterScore = 15;
    }

    let numericScore = 0;
    const parsedNum = typeof confidenceNum === "number"
        ? confidenceNum
        : confidenceNum != null && String(confidenceNum).trim() !== ""
            ? Number(confidenceNum)
            : NaN;
    if (Number.isFinite(parsedNum) && parsedNum > 0) {
        numericScore = parsedNum <= 10.0 ? parsedNum * 10.0 : Math.min(100.0, parsedNum);
    }

    if (letterScore > 0 && numericScore > 0) {
        return Math.min(100, letterScore + numericScore * 0.1);
    }
    return Math.max(letterScore, numericScore, 10);
}

/**
 * Classifies a canonical isotope, raw nuclide name, or vendor/WebID category string
 * into one of the 5 UpSet source categories: SNM, Medical, Industrial, NORM, or Unknown.
 */
export function classifySourceCategory(
    rawIsotopeOrCategory: string | null | undefined,
    explicitTypeHint?: string | null,
): UpSetSourceCategory | null {
    if (explicitTypeHint) {
        const upperHint = explicitTypeHint.trim().toUpperCase();
        if (upperHint.includes("SNM") || upperHint.includes("NUCLEAR") || upperHint.includes("SPECIAL")) return "SNM";
        if (upperHint === "MED" || upperHint.includes("MEDICAL")) return "Medical";
        if (upperHint === "IND" || upperHint.includes("INDUSTRIAL")) return "Industrial";
        if (upperHint.includes("NORM") || upperHint.includes("NATURAL")) return "NORM";
    }

    const canonical = mapNuclideToCanonicalIsotope(rawIsotopeOrCategory);
    switch (canonical) {
        case "Neptunium":
        case "Plutonium":
        case "Uranium233":
        case "Uranium235":
            return "SNM";
        case "Potassium":
        case "Radium":
        case "Thorium":
        case "Uranium238":
            return "NORM";
        case "Fluorine":
        case "Gallium":
        case "Iodine123":
        case "Iodine131":
        case "Indium":
        case "Palladium":
        case "Technetium":
        case "Xenon":
            return "Medical";
        case "Americium":
        case "Barium":
        case "Bismuth":
        case "Californium":
        case "Cesium134":
        case "Cesium137":
        case "Cobalt57":
        case "Cobalt60":
        case "Europium152":
        case "Iridium":
        case "Manganese":
        case "Selenium":
        case "Sodium":
        case "Strontium":
            return "Industrial";
        case "Unknown":
            return "Unknown";
        default:
            return null;
    }
}

export function selectHighestConfidenceIsotopesFromWebIdEntry(result: WebIdAnalysisResult | null | undefined): {
    canonicalIsotopes: CanonicalIsotopeKey[];
    rawNames: string[];
    dominantCategory: UpSetSourceCategory | null;
    topScore: number;
} {
    if (!result) {
        return { canonicalIsotopes: [], rawNames: [], dominantCategory: null, topScore: 0 };
    }

    const candidates: Array<{
        rawName: string;
        canonical: CanonicalIsotopeKey;
        category: UpSetSourceCategory | null;
        score: number;
    }> = [];

    if (Array.isArray(result.isotopes) && result.isotopes.length > 0) {
        for (const iso of result.isotopes as IWebIdIsotope[]) {
            const canonical = mapNuclideToCanonicalIsotope(iso?.name);
            if (!canonical) continue;
            const score = rankConfidenceScore(iso?.confidence, iso?.confidenceStr);
            const category = classifySourceCategory(iso?.name, iso?.type);
            candidates.push({
                rawName: iso.name,
                canonical,
                category,
                score,
            });
        }
    } else if (result.isotopeString) {
        for (const token of result.isotopeString.split(/[,;+]+/)) {
            const canonical = mapNuclideToCanonicalIsotope(token);
            if (!canonical) continue;
            candidates.push({
                rawName: token.trim(),
                canonical,
                category: classifySourceCategory(token),
                score: 50,
            });
        }
    }

    if (candidates.length === 0) {
        return { canonicalIsotopes: [], rawNames: [], dominantCategory: null, topScore: 0 };
    }

    candidates.sort((a, b) => b.score - a.score);
    const topScore = candidates[0].score;
    // Include the highest-confidence isotope and any co-identified high-confidence isotopes within 15 points
    const selected = candidates.filter((c) => c.score >= Math.max(65, topScore - 15));
    const chosen = selected.length > 0 ? selected : [candidates[0]];

    const canonicalIsotopes = normalizeIsotopeListForSelect(chosen.map((c) => c.canonical));
    const rawNames = Array.from(new Set(chosen.map((c) => c.rawName)));
    const dominantCategory = pickPriorityCategory(chosen.map((c) => c.category));

    return { canonicalIsotopes, rawNames, dominantCategory, topScore };
}

export function selectHighestConfidenceWebIdResult(results: readonly WebIdAnalysisResult[]): {
    bestResult: WebIdAnalysisResult | null;
    canonicalIsotopes: CanonicalIsotopeKey[];
    rawNames: string[];
    dominantCategory: UpSetSourceCategory | null;
} {
    let bestResult: WebIdAnalysisResult | null = null;
    let bestSummary: ReturnType<typeof selectHighestConfidenceIsotopesFromWebIdEntry> = {
        canonicalIsotopes: [],
        rawNames: [],
        dominantCategory: null,
        topScore: -1,
    };

    for (const candidate of results) {
        if (!candidate) continue;
        const summary = selectHighestConfidenceIsotopesFromWebIdEntry(candidate);
        if (summary.canonicalIsotopes.length > 0 && summary.topScore > bestSummary.topScore) {
            bestResult = candidate;
            bestSummary = summary;
        }
    }

    if (!bestResult && results.length > 0) {
        bestResult = results[0];
    }

    return {
        bestResult,
        canonicalIsotopes: bestSummary.canonicalIsotopes,
        rawNames: bestSummary.rawNames,
        dominantCategory: bestSummary.dominantCategory,
    };
}

/**
 * Parses N42Output alarmReports (e.g. "Isotope: I-131 (Medical, Confidence: 10.0)")
 * into structured device nuclide matches sorted by confidence descending.
 */
export function parseN42AlarmReportNuclides(alarmReports: readonly N42AlarmReportItem[] | undefined | null): DeviceNuclideMatch[] {
    if (!Array.isArray(alarmReports) || alarmReports.length === 0) {
        return [];
    }

    const matches: DeviceNuclideMatch[] = [];
    const seen = new Set<string>();

    for (const alarm of alarmReports) {
        if (!alarm) continue;
        const cat = (alarm.alarmCategoryCode ?? "").trim();
        const desc = (alarm.alarmDescription ?? "").trim();
        if (!desc && cat.toLowerCase() !== "isotope") continue;

        // Match "Isotope: I-131 (Medical, Confidence: 10.0)" or "Alarm: Isotope: Ba-133"
        let rawBody = desc;
        const isoPrefixMatch = /(?:^|:\s*)isotope\s*:\s*(.+)$/i.exec(desc);
        if (isoPrefixMatch) {
            rawBody = isoPrefixMatch[1].trim();
        } else if (cat.toLowerCase() !== "isotope") {
            continue;
        }

        let rawName = rawBody;
        let metaText = "";
        const parenIdx = rawBody.indexOf("(");
        if (parenIdx > 0 && rawBody.endsWith(")")) {
            rawName = rawBody.slice(0, parenIdx).trim();
            metaText = rawBody.slice(parenIdx + 1, -1).trim();
        }

        const canonical = mapNuclideToCanonicalIsotope(rawName);
        if (!canonical) continue;

        let explicitCat: string | null = null;
        let confidenceText = "";
        if (metaText) {
            for (const part of metaText.split(",")) {
                const p = part.trim();
                if (/^confidence\s*:/i.test(p)) {
                    confidenceText = p.replace(/^confidence\s*:\s*/i, "").trim();
                } else if (!explicitCat) {
                    explicitCat = p;
                }
            }
        }

        const confidenceScore = rankConfidenceScore(confidenceText, confidenceText);
        const dedupKey = `${canonical}|${rawName.toLowerCase()}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        matches.push({
            rawName,
            canonicalIsotope: canonical,
            category: classifySourceCategory(rawName, explicitCat),
            confidenceText,
            confidenceScore,
        });
    }

    matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
    return matches;
}

export function selectDeviceReportIsotopes(alarmReports: readonly N42AlarmReportItem[] | undefined | null): {
    matches: DeviceNuclideMatch[];
    canonicalIsotopes: CanonicalIsotopeKey[];
    dominantCategory: UpSetSourceCategory | null;
} {
    const matches = parseN42AlarmReportNuclides(alarmReports);
    if (matches.length === 0) {
        return { matches: [], canonicalIsotopes: [], dominantCategory: null };
    }
    const topScore = matches[0].confidenceScore;
    const topTier = matches.filter((m) => m.confidenceScore >= Math.max(60, topScore - 15));
    const chosen = topTier.length > 0 ? topTier : [matches[0]];
    return {
        matches,
        canonicalIsotopes: normalizeIsotopeListForSelect(chosen.map((m) => m.canonicalIsotope)),
        dominantCategory: pickPriorityCategory(chosen.map((m) => m.category)),
    };
}

function pickPriorityCategory(categories: readonly (UpSetSourceCategory | null)[]): UpSetSourceCategory | null {
    const priority: UpSetSourceCategory[] = ["SNM", "Medical", "Industrial", "NORM", "Unknown"];
    for (const p of priority) {
        if (categories.includes(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Maps dominant source category to the standard OSCAR adjudication disposition code:
 * - SNM -> Code 1 (Contraband Found)
 * - Medical -> Code 3 (Medical Isotope Found)
 * - NORM -> Code 4 (NORM Found)
 * - Industrial -> Code 5 (Declared Shipment of Radioactive Material)
 * - Unknown -> Code 2 (Other Real Alarm)
 * - Background / Nuisance (no source isotope identified) -> Code 7 (RIID/ASP Indicates Background Only)
 */
export function suggestAdjudicationCodeForCategory(
    category: UpSetSourceCategory | null,
    hasAnyIsotopes: boolean,
): number {
    switch (category) {
        case "SNM":
            return 1;
        case "Medical":
            return 3;
        case "NORM":
            return 4;
        case "Industrial":
            return 5;
        case "Unknown":
            return 2;
        default:
            return hasAnyIsotopes ? 5 : 7;
    }
}

const SPECTROSCOPIC_FILE_SUFFIXES = [
    ".spe",
    ".n42.xml",
    ".n42",
    ".xml",
    ".spc",
    ".chn",
    ".pcf",
    ".cnf",
    ".tka",
    ".mca",
    ".phd",
    ".lzs",
    ".mps",
    ".aram",
] as const;

export function isSpectroscopicFilePath(rawPath: string | null | undefined): boolean {
    if (!rawPath) return false;
    let clean = rawPath.trim();
    const qIdx = clean.indexOf("?");
    if (qIdx >= 0) clean = clean.slice(0, qIdx);
    const hIdx = clean.indexOf("#");
    if (hIdx >= 0) clean = clean.slice(0, hIdx);
    clean = clean.trim().toLowerCase();
    if (clean.length < 4) return false;
    for (const suffix of SPECTROSCOPIC_FILE_SUFFIXES) {
        if (clean.length > suffix.length && clean.endsWith(suffix)) {
            return true;
        }
    }
    if (clean.endsWith(".txt")) {
        const slashIdx = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
        const baseName = slashIdx >= 0 ? clean.slice(slashIdx + 1) : clean;
        return baseName.length > 15 && baseName.startsWith("foreground-");
    }
    return false;
}

const BIT_GAMMA = 1 << 0;
const BIT_NORM = 1 << 1;
const BIT_UNKNOWN = 1 << 2;
const BIT_INDUSTRIAL = 1 << 3;
const BIT_MEDICAL = 1 << 4;
const BIT_SNM = 1 << 5;
const BIT_NEUTRON = 1 << 6;

const UPSET_SET_DEFS: ReadonlyArray<{ name: UpSetSetName; bit: number; snm: boolean }> = [
    { name: "Gamma", bit: BIT_GAMMA, snm: false },
    { name: "NORM", bit: BIT_NORM, snm: false },
    { name: "Unknown", bit: BIT_UNKNOWN, snm: false },
    { name: "Industrial", bit: BIT_INDUSTRIAL, snm: false },
    { name: "Medical", bit: BIT_MEDICAL, snm: false },
    { name: "SNM", bit: BIT_SNM, snm: true },
    { name: "Neutron", bit: BIT_NEUTRON, snm: false },
];

function categoryToBit(cat: UpSetSourceCategory | null): number {
    if (cat === "NORM") return BIT_NORM;
    if (cat === "Unknown") return BIT_UNKNOWN;
    if (cat === "Industrial") return BIT_INDUSTRIAL;
    if (cat === "Medical") return BIT_MEDICAL;
    if (cat === "SNM") return BIT_SNM;
    return 0;
}

function classifySourceCategoryBitsFromToken(rawToken: string | null | undefined): number {
    if (!rawToken) return 0;
    const trimmed = rawToken.trim();
    if (!trimmed) return 0;
    const lower = trimmed.toLowerCase();
    let bits = 0;
    if (lower.includes("gamma")) bits |= BIT_GAMMA;
    if (lower.includes("neutron")) bits |= BIT_NEUTRON;
    if (lower.includes("snm") || lower.includes("special nuclear") || lower.includes("threat")) bits |= BIT_SNM;
    else if (lower.includes("medical") || lower === "med") bits |= BIT_MEDICAL;
    else if (lower.includes("industrial") || lower === "ind") bits |= BIT_INDUSTRIAL;
    else if (lower.includes("norm") || lower.includes("natural")) bits |= BIT_NORM;
    else if (lower.includes("unknown") || lower === "unk") bits |= BIT_UNKNOWN;
    bits |= categoryToBit(classifySourceCategory(trimmed));
    return bits;
}

function classifyDispositionCodeBits(codeNum: number): number {
    if (codeNum === 1) return BIT_SNM;
    if (codeNum === 2) return BIT_UNKNOWN;
    if (codeNum === 3) return BIT_MEDICAL;
    if (codeNum === 4 || codeNum === 9999) return BIT_NORM;
    if (codeNum === 5) return BIT_INDUSTRIAL;
    return 0;
}

export function getUpSetCategoryBit(name: string | null | undefined): number {
    if (!name) return 0;
    const def = UPSET_SET_DEFS.find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
    return def ? def.bit : 0;
}

export function setsToUpSetMask(sets: readonly string[] | null | undefined): number {
    if (!sets || sets.length === 0) return 0;
    let mask = 0;
    for (const s of sets) {
        mask |= getUpSetCategoryBit(s);
    }
    return mask;
}

/**
 * Orders the 7 main UpSet categories so populated categories (`count > 0`) always appear first
 * (sorted descending by occupancy count, with SNM breaking ties first), followed by zero-count categories.
 */
export function orderUpSetSetsPopulatedFirst(sets: readonly UpSetSetTotalItem[]): UpSetSetTotalItem[] {
    return [...sets].sort((a, b) => {
        const aPop = a.count > 0 ? 0 : 1;
        const bPop = b.count > 0 ? 0 : 1;
        if (aPop !== bPop) return aPop - bPop;
        if (b.count !== a.count) return b.count - a.count;
        const aSnm = Boolean(a.snm || a.name === "SNM");
        const bSnm = Boolean(b.snm || b.name === "SNM");
        if (aSnm !== bSnm) return aSnm ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

function resolveIntersectionMemberSets(inter: UpSetIntersectionItem): string[] {
    if (Array.isArray(inter.sets) && inter.sets.length > 0) return inter.sets;
    if (Array.isArray(inter.activeSets) && inter.activeSets.length > 0) return inter.activeSets;
    return [];
}

export function resolveIntersectionMask(inter: UpSetIntersectionItem): number {
    if (typeof inter.mask === "number" && inter.mask > 0) return inter.mask;
    return setsToUpSetMask(resolveIntersectionMemberSets(inter));
}

/**
 * Builds the displayed UpSet intersection columns capped at `maxIntersections`.
 * Whenever rare SNM-present combinations fall outside `maxIntersections`, they are rolled into
 * a crimson `"Other SNM"` column (replacing the lowest-ranked non-SNM column so total columns
 * never exceed `maxIntersections`) ensuring the SNM vertical bars always sum to the exact SNM total on the left.
 */
export function buildDisplayedUpSetColumns(
    intersections: readonly UpSetIntersectionItem[],
    maxIntersections: number,
    otherSnmLabel = "Other SNM",
): DisplayedUpSetColumnItem[] {
    if (!Array.isArray(intersections) || intersections.length === 0) return [];
    const cap = Math.max(1, maxIntersections);

    const toRegularColumn = (inter: UpSetIntersectionItem): DisplayedUpSetColumnItem => {
        const memberSets = resolveIntersectionMemberSets(inter);
        const mask = resolveIntersectionMask(inter);
        return {
            ...inter,
            mask,
            sets: memberSets,
            activeSets: memberSets,
            coOccurringSets: [],
            otherSnmRollup: false,
            rolledUpMasks: mask > 0 ? [mask] : [],
            excludedSnmMasks: [],
            rolledUpCombinationCount: 1,
        };
    };

    if (intersections.length <= cap) {
        return intersections.map(toRegularColumn);
    }

    const overflowSnm = intersections
        .slice(cap)
        .filter((inter) => inter.snmPresent && inter.count > 0);

    if (overflowSnm.length === 0) {
        return intersections.slice(0, cap).map(toRegularColumn);
    }

    const kept = [...intersections.slice(0, cap)];
    const rolled: UpSetIntersectionItem[] = [];
    let dropNonSnmIdx = -1;
    for (let i = kept.length - 1; i >= 0; i--) {
        if (!kept[i].snmPresent) {
            dropNonSnmIdx = i;
            break;
        }
    }
    if (dropNonSnmIdx >= 0) {
        kept.splice(dropNonSnmIdx, 1);
    } else {
        const popped = kept.pop();
        if (popped) rolled.push(popped);
    }
    rolled.push(...overflowSnm);

    let otherSnmCount = 0;
    const coSets = new Set<string>();
    const rolledMasks: number[] = [];
    for (const r of rolled) {
        otherSnmCount += r.count;
        const m = resolveIntersectionMask(r);
        if (m > 0) rolledMasks.push(m);
        for (const s of resolveIntersectionMemberSets(r)) {
            if (s !== "SNM") coSets.add(s);
        }
    }

    const keptColumns = kept.map(toRegularColumn);
    const keptSnmMasks = keptColumns
        .filter((c) => c.snmPresent && typeof c.mask === "number" && c.mask > 0)
        .map((c) => c.mask as number);

    return [
        ...keptColumns,
        {
            mask: UPSET_OTHER_SNM_SYNTHETIC_MASK,
            label: otherSnmLabel,
            sets: ["SNM"],
            activeSets: ["SNM"],
            coOccurringSets: Array.from(coSets),
            count: otherSnmCount,
            snmPresent: true,
            otherSnmRollup: true,
            rolledUpMasks: rolledMasks,
            excludedSnmMasks: keptSnmMasks,
            rolledUpCombinationCount: rolled.length,
        },
    ];
}

export function matchesUpSetFilter(
    eventMask: number,
    selection: UpSetFilterSelection | null | undefined,
): boolean {
    if (!selection) return true;
    if (eventMask <= 0) return false;
    if (selection.kind === "category") {
        return selection.bit > 0 && (eventMask & selection.bit) !== 0;
    }
    if (selection.kind === "intersection") {
        return eventMask === selection.mask;
    }
    if (selection.masks.length > 0) {
        return selection.masks.includes(eventMask);
    }
    return (eventMask & BIT_SNM) !== 0 && !selection.excludedMasks.includes(eventMask);
}

export function isUpSetFilterValidForData(
    data: UpSetCoOccurrencePayload | null | undefined,
    selection: UpSetFilterSelection | null | undefined,
    maxIntersections = 18,
): boolean {
    if (!selection) return true;
    if (!data || data.totalOccupancies <= 0 || !Array.isArray(data.intersections)) return false;
    if (selection.kind === "category") {
        const found = data.sets.find((s) => s.name === selection.setName);
        return Boolean(found && found.count > 0);
    }
    if (selection.kind === "intersection") {
        return data.intersections.some((col) => resolveIntersectionMask(col) === selection.mask && col.count > 0);
    }
    const cols = buildDisplayedUpSetColumns(data.intersections, maxIntersections);
    return cols.some((c) => c.otherSnmRollup && c.count > 0);
}

function finalizeUpSetFromCounts(countsByMask: readonly number[], totalOccupancies: number): UpSetCoOccurrencePayload {
    const setTotals: UpSetSetTotalItem[] = orderUpSetSetsPopulatedFirst(
        UPSET_SET_DEFS.map((def) => {
            let sum = 0;
            for (let m = 1; m < 128; m++) {
                if ((m & def.bit) !== 0) {
                    sum += countsByMask[m];
                }
            }
            return { name: def.name, count: sum, snm: def.snm };
        }),
    );

    const intersections: UpSetIntersectionItem[] = [];
    for (let m = 1; m < 128; m++) {
        const c = countsByMask[m];
        if (c <= 0) continue;
        const activeSets = setTotals
            .filter((s) => {
                const def = UPSET_SET_DEFS.find((d) => d.name === s.name);
                return def ? (m & def.bit) !== 0 : false;
            })
            .map((s) => s.name);
        intersections.push({
            mask: m,
            label: activeSets.join(" + "),
            sets: activeSets,
            count: c,
            percentPct: totalOccupancies > 0 ? Math.round((c / totalOccupancies) * 10000) / 100 : 0,
            snmPresent: (m & BIT_SNM) !== 0,
        });
    }

    intersections.sort(
        (a, b) =>
            b.count - a.count
            || (a.snmPresent === b.snmPresent ? 0 : a.snmPresent ? -1 : 1)
            || a.label.localeCompare(b.label),
    );

    return {
        totalOccupancies,
        sets: setTotals,
        intersections,
    };
}

export interface VehiclePassUpSetInput {
    gammaAlarm: boolean;
    neutronAlarm: boolean;
    emlAutoReleased?: boolean;
    alarmCategoryCode?: string;
    confirmedIsotopes?: readonly string[];
    eml?: {
        decision?: string;
        sourceType?: string;
    } | null;
    webIdAnalyses?: ReadonlyArray<{
        isotopeString?: string;
        isotopes?: readonly string[];
    }>;
    adjudications?: ReadonlyArray<{
        adjudicationCode?: number;
        isotopes?: readonly string[];
    }>;
}

export function computeVehiclePassUpSetMask(pass: VehiclePassUpSetInput | null | undefined): number {
    if (!pass) return 0;
    const alarmCat = (pass.alarmCategoryCode ?? "").trim();
    const isAlarming = Boolean(pass.gammaAlarm || pass.neutronAlarm || alarmCat.length > 0);
    if (!isAlarming) {
        return 0;
    }

    let mask = 0;
    if (pass.gammaAlarm) mask |= BIT_GAMMA;
    if (pass.neutronAlarm) mask |= BIT_NEUTRON;
    if (pass.emlAutoReleased) mask |= BIT_NORM;

    if (alarmCat.length > 0) {
        for (const tok of alarmCat.split(/[,;/+]/)) {
            mask |= classifySourceCategoryBitsFromToken(tok);
        }
    }
    if (pass.eml?.sourceType) {
        mask |= classifySourceCategoryBitsFromToken(pass.eml.sourceType);
    }
    if (Array.isArray(pass.confirmedIsotopes)) {
        for (const iso of pass.confirmedIsotopes) {
            mask |= classifySourceCategoryBitsFromToken(iso);
        }
    }
    if (Array.isArray(pass.webIdAnalyses)) {
        for (const w of pass.webIdAnalyses) {
            if (Array.isArray(w?.isotopes)) {
                for (const iso of w.isotopes) {
                    mask |= classifySourceCategoryBitsFromToken(iso);
                }
            }
            if (w?.isotopeString) {
                for (const tok of w.isotopeString.split(/[,;+]/)) {
                    mask |= classifySourceCategoryBitsFromToken(tok);
                }
            }
        }
    }
    if (Array.isArray(pass.adjudications)) {
        for (const adj of pass.adjudications) {
            if (!adj) continue;
            let isoBits = 0;
            if (Array.isArray(adj.isotopes)) {
                for (const iso of adj.isotopes) {
                    isoBits |= classifySourceCategoryBitsFromToken(iso);
                }
            }
            mask |= isoBits;
            const codeNum = Number(adj.adjudicationCode ?? 0);
            const codeBits = classifyDispositionCodeBits(codeNum);
            if (!(codeBits === BIT_INDUSTRIAL && isoBits !== 0)) {
                mask |= codeBits;
            }
        }
    }

    if (mask === 0) {
        mask = BIT_GAMMA;
    }
    return mask & 0x7f;
}

export function buildUpSetCoOccurrenceFromVehiclePasses(
    passes: readonly VehiclePassUpSetInput[],
): UpSetCoOccurrencePayload {
    const countsByMask = new Array<number>(128).fill(0);
    let totalOccupancies = 0;
    for (const pass of passes) {
        const mask = computeVehiclePassUpSetMask(pass);
        if (mask > 0 && mask < 128) {
            countsByMask[mask] += 1;
            totalOccupancies += 1;
        }
    }
    return finalizeUpSetFromCounts(countsByMask, totalOccupancies);
}

export function computeEventUpSetMask(
    event: Pick<EventTableData, "status"> & Partial<Pick<EventTableData, "adjudicatedData" | "adjudicatedCode" | "adjudicatedIds">>,
): number {
    const status = (event.status ?? "").trim();
    if (!status || status === "None" || status.startsWith("Fault") || status === "Tamper") {
        return 0;
    }

    let mask = 0;
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes("gamma")) mask |= BIT_GAMMA;
    if (lowerStatus.includes("neutron")) mask |= BIT_NEUTRON;
    if (lowerStatus.includes("norm")) mask |= BIT_GAMMA | BIT_NORM;
    if (lowerStatus.includes("medical")) mask |= BIT_GAMMA | BIT_MEDICAL;
    if (lowerStatus.includes("industrial")) mask |= BIT_GAMMA | BIT_INDUSTRIAL;
    if (lowerStatus.includes("snm") || lowerStatus.includes("special nuclear") || lowerStatus.includes("threat")) {
        mask |= BIT_GAMMA | BIT_SNM;
    }
    if (lowerStatus.includes("unknown")) mask |= BIT_GAMMA | BIT_UNKNOWN;
    if (mask === 0) {
        mask |= BIT_GAMMA;
    }

    const isotopes: string[] = Array.isArray(event.adjudicatedData?.isotopes)
        ? event.adjudicatedData.isotopes
        : [];
    for (const iso of isotopes) {
        mask |= categoryToBit(classifySourceCategory(iso));
    }

    const latestMarkerCode = Array.isArray(event.adjudicatedIds)
        ? (extractLatestAdjudicationCode(event.adjudicatedIds) ?? 0)
        : 0;
    const codeNum = event.adjudicatedData?.adjudicationCode?.code ?? event.adjudicatedCode ?? latestMarkerCode;
    if ((mask & (BIT_NORM | BIT_UNKNOWN | BIT_INDUSTRIAL | BIT_MEDICAL | BIT_SNM)) === 0 && codeNum > 0) {
        mask |= classifyDispositionCodeBits(codeNum);
    }

    return mask;
}

export function buildUpSetCoOccurrenceFromEvents(events: readonly EventTableData[]): UpSetCoOccurrencePayload {
    const countsByMask = new Array<number>(128).fill(0);
    let totalOccupancies = 0;

    for (const ev of events) {
        const mask = computeEventUpSetMask(ev);
        if (mask > 0 && mask < 128) {
            countsByMask[mask] += 1;
            totalOccupancies += 1;
        }
    }

    return finalizeUpSetFromCounts(countsByMask, totalOccupancies);
}
