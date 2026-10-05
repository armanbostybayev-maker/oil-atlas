"""Read-only XLSX registry importer. Python standard library, no Excel runtime."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
HEADERS = [
    ('ID', 'id'), ('Название', 'name'), ('Местное название', 'localName'),
    ('Страна', 'country'), ('Регион', 'region'), ('Широта', 'lat'), ('Долгота', 'lon'),
    ('Точность координат', 'coordinateAccuracy'), ('Тип топлива', 'fuelType'),
    ('Тип объекта', 'objectType'), ('Статус', 'status'), ('Источник статуса', 'statusSource'),
    ('Год статуса', 'statusYear'), ('Год открытия', 'discoveryYear'), ('Год FID', 'fidYear'),
    ('Начало добычи', 'productionStart'), ('Оператор', 'operator'), ('Владелец', 'owner'),
    ('Материнская компания', 'parentCompany'), ('Бассейн', 'basin'), ('Блок/лицензия', 'block'),
    ('Проект/комплекс', 'project'), ('Добыча нефти', 'oilProduction'),
    ('Ед. добычи нефти', 'oilProductionUnit'), ('Год добычи нефти', 'oilProductionYear'),
    ('Запасы нефти', 'oilReserves'), ('Ед. запасов нефти', 'oilReservesUnit'),
    ('Год запасов нефти', 'oilReservesYear'), ('Класс запасов нефти', 'oilReservesClass'),
    ('Добыча газа', 'gasProduction'), ('Ед. добычи газа', 'gasProductionUnit'),
    ('Год добычи газа', 'gasProductionYear'), ('Запасы газа', 'gasReserves'),
    ('Ед. запасов газа', 'gasReservesUnit'), ('Год запасов газа', 'gasReservesYear'),
    ('Класс запасов газа', 'gasReservesClass'), ('Ссылка', 'sourceUrl'),
]

def column_index(address):
    result = 0
    for char in re.match(r'[A-Z]+', address).group():
        result = result * 26 + ord(char) - 64
    return result - 1

def read_sheet(path, sheet_name='Реестр'):
    with ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next((s for s in workbook.findall('m:sheets/m:sheet', NS) if s.get('name') == sheet_name), None)
        if sheet is None:
            raise ValueError(f'Missing sheet: {sheet_name}')
        relation_id = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        relations = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.get('Target') for r in relations if r.get('Id') == relation_id)
        member = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
        root = ET.fromstring(archive.read(member))
        for row in root.findall('m:sheetData/m:row', NS):
            cells = {}
            for cell in row.findall('m:c', NS):
                value = cell.find('m:v', NS)
                value = value.text if value is not None else None
                kind = cell.get('t')
                if kind == 's' and value is not None:
                    value = shared[int(value)]
                elif kind == 'inlineStr':
                    value = ''.join(cell.find('m:is', NS).itertext())
                elif value is not None and kind not in ('str', 'e'):
                    value = float(value)
                    if not math.isfinite(value):
                        value = None
                    elif value.is_integer():
                        value = int(value)
                if isinstance(value, str):
                    value = value.strip() or None
                cells[column_index(cell.get('r'))] = value
            yield cells

def coordinate(value, limit):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(str(value).strip().replace(',', '.'))
        return number if math.isfinite(number) and abs(number) <= limit else None
    except ValueError:
        return None

def convert(path):
    header = None
    records = []
    ids = set()
    invalid = []
    for row in read_sheet(path):
        if header is None:
            if row.get(0) == 'ID' and 'Широта' in row.values():
                header = {value: index for index, value in row.items()}
                missing = [label for label, _ in HEADERS if label not in header]
                if missing:
                    raise ValueError(f'Missing columns: {missing}')
            continue
        if not any(value is not None for value in row.values()):
            continue
        record = {key: row.get(header[label]) for label, key in HEADERS}
        if not record['id'] or str(record['id']) in ids:
            raise ValueError(f'Missing or duplicate ID: {record["id"]}')
        record['id'] = str(record['id'])
        ids.add(record['id'])
        # Invalid coordinates are retained in the registry but never sent to MapLibre.
        if coordinate(record['lat'], 90) is None or coordinate(record['lon'], 180) is None:
            invalid.append(record['id'])
        else:
            record['lat'] = coordinate(record['lat'], 90)
            record['lon'] = coordinate(record['lon'], 180)
        records.append(record)
    if header is None or not records:
        raise ValueError('Registry is empty or its header is missing')
    columns = [key for _, key in HEADERS]
    quality = {
        'total': len(records), 'validCoordinates': len(records) - len(invalid),
        'invalidCoordinateIds': invalid,
        'countries': len({r['country'] for r in records if r['country']}),
        'statuses': dict(Counter(r['status'] or 'unknown' for r in records)),
        'coordinateAccuracy': dict(Counter(r['coordinateAccuracy'] or 'unknown' for r in records)),
    }
    return {'schemaVersion': 1, 'sourceFile': Path(path).name,
            'sourceSha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            'columns': columns, 'rows': [[r[key] for key in columns] for r in records], 'quality': quality}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/data/oilfields.json')
    args = parser.parse_args()
    data = convert(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temporary.replace(args.output)
    print(json.dumps({**data['quality'], 'invalidCoordinateIds': len(data['quality']['invalidCoordinateIds'])}, ensure_ascii=False))

if __name__ == '__main__':
    main()
