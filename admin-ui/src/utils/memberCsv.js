/** Normalised key for API plan_name matching (trim + lowercase). */
export function normalizePlanMatchKey(name) {
    return String(name ?? '').trim().toLowerCase();
}

/** Split a single CSV line with basic quoted-field support. */
export function parseCsvRow(line) {
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
            if (c === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                cur += c;
            }
        } else if (c === '"') {
            quoted = true;
        } else if (c === ',') {
            cells.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    cells.push(cur);
    return cells.map((s) => s.trim());
}

/**
 * True if two or more plans share the same effective name for CSV matching.
 * @param {{ name?: string }[]} plans
 */
export function hasDuplicateEffectivePlanNames(plans) {
    if (!plans?.length) return false;
    const seen = new Set();
    for (const p of plans) {
        const k = normalizePlanMatchKey(p.name);
        if (!k) continue;
        if (seen.has(k)) return true;
        seen.add(k);
    }
    return false;
}

export const MEMBER_CSV_HEADER_HINT =
    'full_name,mobile,email,plan_name,join_date,next_due_date';

/**
 * Pre-upload checks: required plan_name header, legacy plan_id detection,
 * duplicate plan names on the org, and unknown plan_name cell values vs plans[].name.
 * @param {string} csvText
 * @param {{ name?: string }[]} plans
 * @returns {{ blockingError?: string, warnings: string[] }}
 */
export function analyzeMemberCsvPlanColumn(csvText, plans) {
    const warnings = [];
    const raw = String(csvText ?? '').replace(/^\uFEFF/, '');
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter((l) => l.trim() !== '');
    if (lines.length === 0) {
        return { blockingError: 'The CSV file is empty.', warnings };
    }

    const headers = parseCsvRow(lines[0]).map((h) => h.trim());
    const planNameIdx = headers.findIndex((h) => h.toLowerCase() === 'plan_name');
    const planIdIdx = headers.findIndex((h) => h.toLowerCase() === 'plan_id');

    if (planNameIdx === -1) {
        if (planIdIdx !== -1) {
            return {
                blockingError: `This file uses the legacy plan_id column. Replace it with plan_name using the human-readable plan names from this organisation. Expected columns include: ${MEMBER_CSV_HEADER_HINT}.`,
                warnings
            };
        }
        return {
            blockingError: `Missing required column plan_name. The header row must include plan_name (for example): ${MEMBER_CSV_HEADER_HINT}.`,
            warnings
        };
    }

    if (hasDuplicateEffectivePlanNames(plans)) {
        warnings.push(
            'This organisation has two or more plans with the same name when trimmed and compared case-insensitively. Imports require unique plan names per organisation for CSV matching—you may see row errors until plan names differ.'
        );
    }

    const validKeys = new Set((plans || []).map((p) => normalizePlanMatchKey(p.name)).filter(Boolean));
    if (validKeys.size === 0) {
        warnings.push(
            'This organisation has no membership plans yet. Add plans before importing members that reference plan_name.'
        );
    }

    const unknown = new Set();
    for (let r = 1; r < lines.length; r++) {
        const cells = parseCsvRow(lines[r]);
        if (planNameIdx >= cells.length) continue;
        const rawName = cells[planNameIdx];
        const key = normalizePlanMatchKey(rawName);
        if (!key) continue;
        if (!validKeys.has(key)) {
            unknown.add(rawName.trim());
        }
    }
    if (unknown.size > 0) {
        const sample = [...unknown].slice(0, 8).join(', ');
        const more = unknown.size > 8 ? ` (+${unknown.size - 8} more)` : '';
        warnings.push(
            `Some plan_name values in this file do not match a plan on this organisation: ${sample}${more}. Matching is case-insensitive after trimming—use the exact labels shown under Membership Plans.`
        );
    }

    return { warnings };
}
