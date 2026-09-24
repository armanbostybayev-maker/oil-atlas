import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const FORBIDDEN = /\.(?:mbtiles|pmtiles|pbf|mvt)$/i;

/** Reject direct publication of raw or derived tile archives under public/. */
export function forbiddenPublicTileFiles(paths) {
  return paths.filter(path => FORBIDDEN.test(path));
}

export async function scanPublicTileFiles(dir) {
  const paths = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) paths.push(relative(dir, path).split(sep).join("/"));
    }
  }
  await walk(dir);
  return forbiddenPublicTileFiles(paths);
}
