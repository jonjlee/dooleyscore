#!/usr/bin/env python -B

import sys
import xlrd
from collections import namedtuple, OrderedDict
import json
from pprint import pprint

# Set up logging
import logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

SheetInfo = namedtuple('SheetInfo', ['dataset_name', 'sheet_name', 'start_row', 'columns'])
AllSheetInfo = {
    'Nipple DC': SheetInfo(
        dataset_name='Nipple Discharge',
        sheet_name='NIpple DC',
        start_row=2,
        columns=['Last name', 'First name', 'sex', 'race', 'DOB', 'age', 'cc', 'Nipple d/c character', 'Hemoccult +/-', 'visit date', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'Birads', 'Dx', 'Cancer', 'Patients.Pt ID', 'visits.Pt ID', 'Pt History.Pt ID', 'Notes']
    ),
    'Mammography': SheetInfo(
        dataset_name='Abnormal Mammography',
        sheet_name='Mammography',
        start_row=2,
        columns=['Last name', 'First name', 'Sex', 'DOB', 'SSN', 'Notes', 'Visit Date', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'Pt ID', 'BIRADS', 'Density/distortion', 'Calcifications', 'Diagnosis', 'Cancer', 'CC']
    ),
    'Br Mass': SheetInfo(
        dataset_name='Breast Mass',
        sheet_name='Br Mass',
        start_row=2,
        columns=['Last Name', 'First Name', 'DOB', 'Mass Found By', 'Mass Characterization by PennyPacker Exam', 'Visit Date', 'BIRADS', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'Patient ID', 'MR Number', 'SSN', 'PreOp Diagnosis', 'PostOp Diagnosis', 'Dx', 'Cancer']
    ),
    'Breast Pain': SheetInfo(
        dataset_name='Breast Pain',
        sheet_name='Breast Pain',
        start_row=1,
        columns=['Last Name', 'First Name', 'MI', 'Sex', 'Race', 'DOB', 'Age when first seen', 'Current Age', 'MR#', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'BIRADS', 'Cancer', 'CC', 'HPI', 'ID1', 'ID2']
    ),
}

def parse_data(workbook, sheet_info):
    # Iterate over all sheets
    data = {}
    for _, info in sheet_info.items():
        s = workbook.sheet_by_name(info.sheet_name)

        # Compile rows into an array
        rows = []
        for i in range(info.start_row, s.nrows):
            # Get cell values in row, but ignore rows with no first column value (i.e. name)
            row = s.row_values(i)
            if not row[0]: continue

            # Convert row -> dictionary with all lower case field names
            cols = [c.lower() for c in info.columns]
            rows.append(OrderedDict(zip(cols, row)))
        
        data[info.dataset_name] = {
            'name': info.dataset_name,
            'data': rows,
        }

    return data

def parse_cancer_pts(workbook):
    # Open the first worksheet, and extract all first name, last name, and DOB
    s = workbook.sheet_by_index(0)
    rows = []
    for i in range(1, s.nrows):
        row = s.row_values(i, 1, 5)
        id = '%s;%s;%s' % (row[0],row[1],row[3])
        rows.append(id.lower())

    return rows

def set_cancer_field(data, cancer_pts):
    '''
    For all patients in cancer_pts (known cancer patients in a list of last;first;dob),
    set the cancer field for any corresponding entries in data to yes
    '''
    for _, dataset in data.items():
        for row in dataset['data']:
            pt_name_and_dob = '%s;%s;%s' % (row.get('last name'), row.get('first name'), row.get('dob'))
            if pt_name_and_dob.lower() in cancer_pts and row.get('cancer') != 'yes':
                logger.info('Changing %s.cancer from %s to yes', pt_name_and_dob, row.get('cancer'))
                row['cancer'] = 'yes'

def remove_phi(data):
    # hpi_fields = set()
    hpi_fields = set(['last name', 'first name', 'birth date', 'birthdate', 'dob', 'ssn'])
    for _, dataset in data.items():
        for row in dataset['data']:
            fields = row.keys()
            field_to_remove = hpi_fields.intersection(fields)
            for field in field_to_remove:
                del row[field]

    return data

def main(fname, outfile):
    # Open main Excel data file
    wb = xlrd.open_workbook(fname, on_demand=True)
    logger.debug('Found sheets: %s', wb.sheet_names())

    # Parse spreadsheets into datasets
    data = parse_data(wb, AllSheetInfo)
    wb.release_resources()

    # Uncomment below to set the cancer field to true for all patients in the cancer patients Excel file
    #
    # wb = xlrd.open_workbook('2009 to 2012 breast cancer OUMC.xlsx')
    # cancer_pts = parse_cancer_pts(wb)
    # wb.release_resources()
    # set_cancer_field(data, cancer_pts)

    # Remove all PHI
    remove_phi(data)
    output(data, outfile)

def output(data, outfile):
    # Convert to JS
    js_data = 'data = %s;' % json.dumps(data)

    if not outfile:
        return print(js_data)
    with open(outfile, 'w') as out:
        out.write(js_data)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: parse.py <excel file> [output file]')
        sys.exit(1)

    infile = sys.argv[1]
    outfile = None if len(sys.argv) < 3 else sys.argv[2]
    main(infile, outfile)