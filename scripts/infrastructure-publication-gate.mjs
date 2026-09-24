/**
 * A prepared dataset is not a publication authorization.
 * Keep this check separate from geometric/provenance validation.
 */
export function publicationIssues(manifest, datasets) {
  const issues = [];
  const records = Array.isArray(manifest?.datasets) ? manifest.datasets : [];
  for (const { type, features } of datasets) {
    if (!features) continue;
    const record = records.find(item => item.type === type);
    if (manifest?.status !== "approved_for_publication") issues.push(`${type}: manifest status is not approved_for_publication`);
    if (!record?.source_release || !String(record.source_release).trim()) issues.push(`${type}: missing dataset release`);
    if (!record?.redistribution_permission || !String(record.redistribution_permission).trim()) issues.push(`${type}: missing redistribution permission evidence`);
    if (!record?.attribution || !String(record.attribution).trim()) issues.push(`${type}: missing required attribution`);
    if (!record?.permission_url || !/^https:\/\//i.test(record.permission_url)) issues.push(`${type}: missing HTTPS permission reference`);
    if (record?.features !== features) issues.push(`${type}: manifest feature count does not match published data`);
  }
  return issues;
}
