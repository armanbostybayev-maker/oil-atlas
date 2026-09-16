import { finite, sum, mean, quantile, ratio } from "../utils/numbers.mjs";
import { TONNES_YEAR_TO_BPD } from "../data/normalize.mjs";
import { CLASSIFICATION as RULES, PRODUCTS, ANOMALIES } from "./config.mjs";
export function aggregate(rows) {
  const caps = rows.map((r) => r.capacity),
    known = caps.filter(finite),
    total = sum(caps),
    ages = rows.map((r) => r.age),
    count = rows.length;
  const complete =
      count > 0 &&
      known.length === count &&
      !rows.some((r) => r.duplicateWarning),
    maximum = known.length ? Math.max(...known) : null;
  return {
    count,
    active: rows.filter((r) => r.status === "Active").length,
    capacity: total === null ? null : total / 1e6,
    capacityBpd: total === null ? null : total * TONNES_YEAR_TO_BPD,
    knownCapacity: known.length,
    completeCapacity: complete,
    duplicateWarnings: rows.filter((r) => r.duplicateWarning).length,
    average: complete ? total / count / 1e6 : null,
    median: complete ? quantile(known, 0.5) / 1e6 : null,
    maximum: complete ? maximum / 1e6 : null,
    largestShare: complete && total > 0 ? ratio(maximum, total) * 100 : null,
    hhi:
      complete && total > 0
        ? sum(known.map((c) => (c / total) ** 2)) * 1e4
        : null,
    averageAge: mean(ages),
    medianAge: quantile(ages, 0.5),
    knownAge: ages.filter(finite).length,
    ...Object.fromEntries(
      [30, 50, 70].map((n) => [
        "age" + n,
        ages.some(finite)
          ? ages.filter((a) => finite(a) && a > n).length
          : null,
      ]),
    ),
  };
}
export function classify(c, largeThreshold) {
  const p = c.pcRatio,
    r = c.rcRatio;
  if (!finite(p) || !finite(r) || !c.completeCapacity)
    return "Insufficient Data";
  if (p >= RULES.exportRatio && r < 1) return "Raw Oil Exporter";
  if (r >= RULES.hubRatio) return "Refining Hub";
  if (p < RULES.dependentRatio && r < RULES.dependentRatio)
    return "Import Dependent";
  if (c.consumption >= largeThreshold) return "Large Consumer Market";
  if (
    p >= RULES.balancedMin &&
    p <= RULES.balancedMax &&
    r >= RULES.balancedMin &&
    r <= RULES.balancedMax
  )
    return "Balanced Market";
  return "Insufficient Data";
}
export function createAnalytics(data) {
  const grouped = new Map(data.countries.map((c) => [c.id, []]));
  for (const r of data.refineries)
    if (grouped.has(r.country)) grouped.get(r.country).push(r);
  const stats = data.countries.map((c) => {
    const rows = grouped.get(c.id),
      a = aggregate(rows),
      v = c.values;
    // Totals are observed sums. Ratios require complete capacity coverage.
    const cap = a.completeCapacity ? a.capacityBpd : null;
    return {
      ...c,
      ...v,
      ...a,
      rows,
      pcRatio: ratio(v.production, v.consumption),
      rcRatio: ratio(cap, v.consumption),
      consumptionCapacity: ratio(v.consumption, cap),
      consumptionPerRefinery: ratio(v.consumption, a.count),
      refiningIntensity: ratio(
        a.completeCapacity ? a.capacity * 1e6 : null,
        v.gdp,
      ),
      consumptionIntensity: ratio(v.consumption, v.gdp),
      productionIntensity: ratio(v.production, v.gdp),
    };
  });
  const large = quantile(
      stats.map((c) => c.consumption),
      0.75,
    ),
    highProduction = quantile(
      stats.map((c) => c.production),
      0.75,
    ),
    highCount = quantile(
      stats.filter((c) => c.count > 0).map((c) => c.count),
      0.75,
    ),
    small = quantile(
      stats.map((c) => c.average),
      0.25,
    ),
    largePlant = quantile(
      stats.map((c) => c.average),
      0.75,
    );
  for (const c of stats) {
    c.classification = classify(c, large);
    const closed = aggregate(c.rows.filter((r) => r.status === "Closed")),
      active = c.rows.filter((r) => r.status === "Active"),
      activeAges = active.map((r) => r.age).filter(finite);
    c.anomalies = [];
    const flags = [
      c.production >= highProduction &&
        finite(c.rcRatio) &&
        c.capacityBpd < c.production * 0.5,
      finite(c.rcRatio) && c.rcRatio > 1.5,
      c.consumption >= large && finite(c.rcRatio) && c.rcRatio < 0.5,
      c.count >= highCount && finite(c.average) && c.average < small,
      c.count > 0 &&
        c.count <= 3 &&
        finite(c.average) &&
        c.average >= largePlant,
      c.completeCapacity &&
        closed.capacity !== null &&
        ratio(closed.capacity, c.capacity) > 0.25,
      activeAges.length >= 3 &&
        activeAges.length / active.length >= 0.7 &&
        mean(activeAges) > 50,
      finite(c.rcRatio) && c.rcRatio > 1.5,
      finite(c.rcRatio) && c.rcRatio < 0.5,
    ];
    flags.forEach((f, i) => {
      if (f) c.anomalies.push(ANOMALIES[i]);
    });
  }
  const byId = new Map(stats.map((c) => [c.id, c])),
    ownerGroups = new Map();
  for (const r of data.refineries) {
    if (!r.owner) continue;
    if (!ownerGroups.has(r.owner)) ownerGroups.set(r.owner, []);
    ownerGroups.get(r.owner).push(r);
  }
  const owners = [...ownerGroups]
    .map(([name, rows]) => ({
      name,
      rows,
      ...aggregate(rows),
      countries: new Set(rows.map((r) => r.country).filter(Boolean)).size,
      largest:
        rows
          .filter((r) => finite(r.capacity))
          .sort((a, b) => b.capacity - a.capacity)[0] || null,
    }))
    .sort((a, b) => (b.capacity ?? -1) - (a.capacity ?? -1));
  return {
    stats,
    byId,
    owners,
    getCountryRefineries: (id) => grouped.get(id) || [],
    getCountryRefiningCapacity: (id) => byId.get(id)?.capacity ?? null,
    getCountryOilBalance: (id) => {
      const c = byId.get(id);
      return c
        ? {
            production: c.production,
            consumption: c.consumption,
            capacity: c.capacityBpd,
            productionConsumptionRatio: c.pcRatio,
            refiningConsumptionRatio: c.rcRatio,
            years: c.years,
          }
        : null;
    },
    getOwnerStatistics: () => owners,
    getRefineryAgeStatistics: () => aggregate(data.refineries),
    getProductMix: (id) =>
      Object.fromEntries(PRODUCTS.map((k) => [k, byId.get(id)?.[k] ?? null])),
    getCountryAnomalies: () => stats.filter((c) => c.anomalies.length),
    getCountryClassification: (id) => byId.get(id)?.classification,
    getDataCoverage: (metric) => ({
      known: stats.filter((c) => finite(c[metric])).length,
      total: stats.length,
    }),
    similar: (id) => similarCountries(byId.get(id), stats),
  };
}
export function similarCountries(country, stats) {
  if (!country) return [];
  const keys = ["production", "consumption", "capacity", "count", ...PRODUCTS],
    moments = Object.fromEntries(
      keys.map((k) => {
        const a = stats.map((c) => c[k]).filter(finite),
          m = mean(a);
        return [
          k,
          { mean: m, sd: Math.sqrt(mean(a.map((x) => (x - m) ** 2))) },
        ];
      }),
    );
  return stats
    .filter((c) => c.id !== country.id)
    .map((c) => {
      const available = keys.filter(
        (k) => finite(c[k]) && finite(country[k]) && moments[k].sd > 0,
      );
      if (available.length < 6) return null;
      return {
        country: c,
        features: available.length,
        distance: Math.sqrt(
          sum(
            available.map((k) => ((c[k] - country[k]) / moments[k].sd) ** 2),
          ) / available.length,
        ),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
}
export function metricValue(c, state, filteredRows) {
  if (state.mode === "overview") return null;
  if (state.mode === "balance" && state.metric === "classification")
    return c.classification;
  if (state.mode === "anomalies")
    return c.anomalies.includes(state.anomaly) ? 1 : null;
  if (state.mode === "owners") {
    const a = aggregate(filteredRows);
    return a[state.metric] ?? null;
  }
  if (state.mode === "status") {
    const a = aggregate(filteredRows);
    return state.metric === "statusCount"
      ? a.count
      : state.metric === "statusShare"
        ? c.count > 0
          ? ratio(a.count, c.count) * 100
          : null
        : a.capacity;
  }
  if (
    state.metric.endsWith("Price") &&
    (!c.priceUnit || !c.priceDate || c.priceUnit !== state.priceUnit)
  )
    return null;
  return c[state.metric] ?? null;
}
export function metricYear(c, metric) {
  if (c.years[metric]) return String(c.years[metric]);
  if (metric.endsWith("Price")) return c.priceDate || "Date unavailable";
  if (metric === "pcRatio" || metric === "classification")
    return `Production ${c.years.production || "?"} / consumption ${c.years.consumption || "?"}; refinery inventory`;
  if (["rcRatio", "consumptionCapacity"].includes(metric))
    return `Capacity: mixed / consumption ${c.years.consumption || "?"}`;
  if (metric === "consumptionPerRefinery")
    return `Consumption ${c.years.consumption || "?"} / refinery inventory`;
  if (metric.endsWith("Intensity"))
    return `${metric === "refiningIntensity" ? "Capacity: mixed" : `${metric.startsWith("production") ? "Production" : "Consumption"} ${c.years[metric.startsWith("production") ? "production" : "consumption"] || "?"}`} / GDP ${c.years.gdp || "?"}`;
  return "Refinery inventory · status 2026; capacity years vary";
}
