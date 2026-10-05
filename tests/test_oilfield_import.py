import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from xml.sax.saxutils import escape
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location('importer', Path(__file__).parents[1] / 'scripts/import_oilfields.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)

def col(index):
    result = ''
    while index:
        index, rem = divmod(index - 1,26)
        result = chr(65+rem) + result
    return result

def workbook(path, records):
    rows = [[label for label, _ in importer.HEADERS]] + [[record.get(key) for _,key in importer.HEADERS] for record in records]
    xml = []
    for i,row in enumerate(rows,1):
        cells = []
        for j,value in enumerate(row,1):
            if value is None: continue
            address = f'{col(j)}{i}'
            if isinstance(value,(int,float)):
                cells.append(f'<c r="{address}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{address}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>')
        xml.append('<row>'+''.join(cells)+'</row>')
    with ZipFile(path,'w') as archive:
        archive.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Реестр" r:id="rId1"/></sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        archive.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(xml)+'</sheetData></worksheet>')

class ImportTests(unittest.TestCase):
    def test_roundtrip_missing_zero_invalid_and_uncertainty(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'registry.xlsx'
            workbook(path,[{'id':'a','name':'Тест','lat':0,'lon':0,'oilReserves':0,'productionStart':'2025 (expected)'},{'id':'b','lat':91,'lon':0}])
            data = importer.convert(path)
            records = [dict(zip(data['columns'],row)) for row in data['rows']]
            self.assertEqual(records[0]['oilReserves'],0)
            self.assertIsNone(records[0]['oilProduction'])
            self.assertEqual(records[0]['productionStart'],'2025 (expected)')
            self.assertEqual(data['quality']['validCoordinates'],1)
            self.assertEqual(data['quality']['invalidCoordinateIds'],['b'])
            self.assertEqual(data,importer.convert(path))
            self.assertEqual(json.loads(json.dumps(data))['rows'],data['rows'])

    def test_duplicate_id_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'registry.xlsx'
            workbook(path,[{'id':'a'},{'id':'a'}])
            with self.assertRaisesRegex(ValueError,'duplicate'):
                importer.convert(path)

    def test_coordinates(self):
        for value in [None,'','nan',float('inf'),True,91]:
            self.assertIsNone(importer.coordinate(value,90))
        self.assertEqual(importer.coordinate('45,5',90),45.5)

if __name__ == '__main__':
    unittest.main()
