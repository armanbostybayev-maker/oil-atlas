```javascript
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const xlsxPath = process.argv[2];

if (!xlsxPath) {
  console.error(
    'Использование: node scripts/update-from-excel.mjs "C:\\путь\\файл.xlsx"'
  );
  process.exit(1);
}

if (!fs.existsSync(xlsxPath)) {
  console.error("Excel-файл не найден:", xlsxPath);
  process.exit(1);
}

const atlasPath = path.join(root, "public", "data", "atlas.json");

if (!fs.existsSync(atlasPath)) {
  console.error("Не найден:", atlasPath);
  process.exit(1);
}

/*
 * Читаем XLSX через Python/openpyxl.
 * Python принудительно работает в UTF-8, чтобы Windows CP1251
 * не повреждала русские и другие Unicode-символы.
 */
const pythonCode = String.raw`
import json
import sys
import openpyxl

filename = sys.argv[1]

wb = openpyxl.load_workbook(
    filename,
    read_only=True,
    data_only=True
)

sheet_name = "country_world_globalpetrolprice"

if sheet_name not in wb.sheetnames:
    raise Exception("Не найден лист: " + sheet_name)

ws = wb[sheet_name]

rows = ws.iter_rows(values_only=True)
headers = next(rows)

result = []

for row in rows:
    obj = {}

    for key, value in zip(headers, row):
        if key is None:
            continue

        if value is None:
            obj[str(key)] = None
        elif isinstance(value, (int, float, bool, str)):
            obj[str(key)] = value
        else:
            obj[str(key)] = str(value)

    if obj.get("fid") is not None:
        result.append(obj)

# Явно пишем UTF-8 в stdout
sys.stdout.reconfigure(encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
`;

let output;

try {
  output = execFileSync(
    "py",
    ["-X", "utf8", "-c", pythonCode, xlsxPath],
    {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
    }
  );
} catch (error) {
  console.error("\nНе удалось прочитать Excel.");
  console.error("Проверьте наличие Python и openpyxl:");
  console.error("py -m pip install openpyxl");
  console.error();

  if (error.stderr) {
    console.error(error.stderr.toString());
  }

  console.error(error.message);
  process.exit(1);
}

let excelCountries;

try {
  excelCountries = JSON.parse(output);
} catch (error) {
  console.error("Ошибка разбора данных, полученных из Excel.");
  console.error(error.message);
  process.exit(1);
}

console.log(
  `Excel: найдено стран/территорий: ${excelCountries.length}`
);

const atlas = JSON.parse(
  fs.readFileSync(atlasPath, "utf8")
);

/* -------------------------------------------------------
   Соответствие полей Excel внутренней модели Oil Atlas
------------------------------------------------------- */

const FIELDS = {
  consumption:
    "Потребление нефти/нефтепродуктов, барр./сут.",

  production:
    "Добыча нефти и жидкостей, барр./сут.",

  crude:
    "Добыча сырой нефти, барр./сут.",

  ngpl:
    "Добыча NGPL, барр./сут.",

  gdp:
    "ВВП, млрд USD",

  growth:
    "Рост ВВП, %",

  inflation:
    "Инфляция CPI, %",

  diesel:
    "Дизель/дистилляты, % потребления",

  gasoline:
    "Бензин, % потребления",

  lpg:
    "LPG, % потребления",

  jet:
    "Jet/керосин, % потребления",

  residual:
    "Мазут/Residual Fuel Oil, % потребления",

  gasolinePrice:
    "Цена бензина, USD",

  dieselPrice:
    "Цена дизеля, USD",

  jetPrice:
    "Цена Jet/керосина, USD",

  lpgPrice:
    "Цена LPG, USD",

  residualPrice:
    "Цена мазута, USD",
};

const YEAR_FIELDS = {
  consumption: "Год потребления",
  production: "Год добычи",
  crude: "Год сырой нефти / конденсата",
  ngpl: "Год NGPL",

  gdp: "Год ВВП",
  growth: "Год роста",
  inflation: "Год инфляции",

  diesel: "Год продуктовых долей",
  gasoline: "Год продуктовых долей",
  lpg: "Год продуктовых долей",
  jet: "Год продуктовых долей",
  residual: "Год продуктовых долей",
};

function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "н/д"
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".");

  const n = Number(cleaned);

  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------
   Индексы существующих стран
------------------------------------------------------- */

if (!Array.isArray(atlas.countries)) {
  console.error(
    "Ошибка: в atlas.json отсутствует массив countries."
  );
  process.exit(1);
}

const byId = new Map(
  atlas.countries.map((country) => [
    String(country.id),
    country,
  ])
);

const byName = new Map(
  atlas.countries.map((country) => [
    String(country.name || "")
      .trim()
      .toLowerCase(),
    country,
  ])
);

/* -------------------------------------------------------
   Обновление стран
------------------------------------------------------- */

let updated = 0;
const missing = [];

for (const row of excelCountries) {
  const fid = String(row.fid);

  let country = byId.get(fid);

  if (!country && row.NAME_EN) {
    country = byName.get(
      String(row.NAME_EN)
        .trim()
        .toLowerCase()
    );
  }

  if (!country) {
    missing.push({
      fid,
      name: row.NAME_EN,
    });

    continue;
  }

  /*
   * Сохраняем все исходные поля Excel.
   */
  country.raw = {
    ...(country.raw || {}),
    ...row,
  };

  country.name =
    row.NAME_EN || country.name;

  country.nameRu =
    row.NAME_RU || country.nameRu;

  country.values = country.values || {};

  for (const [key, excelField] of Object.entries(FIELDS)) {
    const value = number(row[excelField]);

    /*
     * Не уничтожаем существующее значение,
     * если в новой таблице ячейка пустая.
     */
    if (value !== null) {
      country.values[key] = value;
    }
  }

  country.years = country.years || {};

  for (
    const [key, excelField]
    of Object.entries(YEAR_FIELDS)
  ) {
    const value = number(row[excelField]);

    if (value !== null) {
      country.years[key] = value;
    }
  }

  if (row["Единица/тип цены"]) {
    country.priceUnit =
      row["Единица/тип цены"];
  }

  if (row["Дата цены"]) {
    country.priceDate =
      row["Дата цены"];
  }

  updated++;
}

/* -------------------------------------------------------
   Обновляем quality
------------------------------------------------------- */

atlas.quality = atlas.quality || {};

atlas.quality.countryRecords =
  atlas.countries.length;

atlas.quality.priceRecords =
  atlas.countries.filter((country) =>
    Object.keys(country.values || {}).some(
      (key) =>
        key.endsWith("Price") &&
        country.values[key] !== null &&
        country.values[key] !== undefined
    )
  ).length;

/* -------------------------------------------------------
   Создаём резервную копию atlas.json
------------------------------------------------------- */

const backupPath =
  atlasPath +
  ".backup-" +
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

fs.copyFileSync(
  atlasPath,
  backupPath
);

/* -------------------------------------------------------
   Записываем обновлённый atlas.json
------------------------------------------------------- */

fs.writeFileSync(
  atlasPath,
  JSON.stringify(atlas),
  "utf8"
);

console.log("");
console.log("=================================");
console.log("Oil Atlas — обновление завершено");
console.log("=================================");
console.log(`Обновлено стран: ${updated}`);
console.log(`Не найдено: ${missing.length}`);
console.log(
  `НПЗ сохранено: ${atlas.refineries?.length ?? 0}`
);

if (missing.length) {
  console.log("");
  console.log("Не сопоставлены:");

  for (const item of missing) {
    console.log(
      `  fid=${item.fid} | ${item.name}`
    );
  }
}

console.log("");
console.log("Backup:");
console.log(backupPath);

console.log("");
console.log("Новый файл:");
console.log(atlasPath);

console.log("");
console.log("Готово.");
```