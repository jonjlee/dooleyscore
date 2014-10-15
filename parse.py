#!/usr/bin/env python -B

import sys
import xlrd
from collections import namedtuple, OrderedDict
from datetime import datetime
import json

from pprint import pprint

# Set up logging
import logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)-15s: %(message)s')

SheetInfo = namedtuple('SheetInfo', ['dataset_name', 'sheet_name', 'start_row', 'columns'])
AllSheetInfo = {
    'Nipple DC': SheetInfo(
        dataset_name='Nipple Discharge',
        sheet_name='NIpple DC',
        start_row=2,
        columns=['Last name', 'First name', 'sex', 'race', 'DOB', 'age', 'cc', 'Nipple d/c character', 'Hemoccult +/-', 'visit date', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'Birads', 'Dx', 'Cancer based on dx', 'Patients.Pt ID', 'visits.Pt ID', 'Pt History.Pt ID', 'Notes']
    ),
    'Mammography': SheetInfo(
        dataset_name='Abnormal Mammography',
        sheet_name='Mammography',
        start_row=2,
        columns=['Last name', 'First name', 'Sex', 'DOB', 'SSN', 'Notes', 'Visit Date', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'Pt ID', 'BIRADS', 'Density/distortion', 'Calcifications', 'Diagnosis', 'Cancer based on dx', 'CC']
    ),
    'Br Mass': SheetInfo(
        dataset_name='Breast Mass',
        sheet_name='Br Mass',
        start_row=2,
        columns=['Last Name', 'First Name', 'DOB', 'Mass Found By', 'Mass Characterization by PennyPacker Exam', 'Visit Date', 'BIRADS', 'Mass', 'Axillary LNs', 'Heme Discharge', 'Ducts Involved', 'T4 Findings', 'Total', 'Patient ID', 'MR Number', 'SSN', 'PreOp Diagnosis', 'PostOp Diagnosis', 'Dx', 'Cancer based on dx']
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
    date_fields = ['visit date']
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
            row = OrderedDict(zip(cols, row))
            
            # Convert date fields to actual dates
            for f in date_fields:
                if not f in row: continue
                try:
                    date_tuple = xlrd.xldate_as_tuple(row[f], workbook.datemode)
                    row[f] = datetime(*date_tuple)
                except:
                    print('Could not parse Date for %s, %s' % (row['last name'], row['first name']))
            
            # # Convert Current Age into a visit date based on DOB
            # if 'age' in row and 'dob' in row:
            #     dob = datetime.strptime(row['dob'], '%m/%d/%Y')
            #     age = int(row['current age'])
            #     day = 28 if (dob.month == 2 and dob.day == 29) else dob.day
            #     row['visit date'] = datetime(dob.year + age, dob.month, day)

            rows.append(row)
        
        data[info.dataset_name] = {
            'name': info.dataset_name,
            'data': rows,
        }

    return data

def parse_cancer_pts(xlfilename):
    # Open the first worksheet, and extract all first name, last name, and DOB
    wb = xlrd.open_workbook(xlfilename)
    s = wb.sheet_by_index(0)
    rows = OrderedDict()
    for i in range(1, s.nrows):
        row = s.row_values(i, 0, 6)
        if not (row[1].strip() and row[2].strip()): continue

        id = '%s;%s;%s' % (row[1],row[2],row[4])

        try:
            date_tuple = xlrd.xldate_as_tuple(row[5], wb.datemode)
        except:
            print('Could not parse visit date: ', row)

        rows[id.lower()] = { 'dx_date': datetime(*date_tuple) }

    wb.release_resources()
    return rows

def set_cancer_field(data, xlfilename):
    '''
    For all patients listed in the excel file, set the cancer field for 
    any corresponding entries in data to yes
    '''
    one_year_in_sec = 60*60*24*365

    # Parse the excel sheet into a map of known cancer patients: "last;first;dob" -> {'dx_date'}),
    cancer_pts = parse_cancer_pts(xlfilename)
    for _, dataset in data.items():
        for row in dataset['data']:
            pt_name_and_dob = '%s;%s;%s' % (row.get('last name'), row.get('first name'), row.get('dob'))
            pt_name_and_dob = pt_name_and_dob.lower()
            cancer_pt = cancer_pts.get(pt_name_and_dob)

            # Set cancer flag if not already set. Default to no. If patient is 
            # in excel spreadsheet and visit date is within 1 year prior to dx date,
            # then set cancer flag to yes.
            cancer = row.get('cancer') or 'no'
            if cancer_pt:
                if 'visit date' in row:
                    if round((row['visit date'] - cancer_pt['dx_date']).total_seconds() / one_year_in_sec) <= 1:
                        cancer = 'yes'
            row['cancer'] = cancer

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

    # Set the cancer field to true for all patients in the cancer patients Excel files
    set_cancer_field(data, 'TR data 2 2010.xlsx')
    set_cancer_field(data, '2009 to 2012 breast cancer OUMC.xlsx')

    # Remove all PHI
    remove_phi(data)
    output(data, outfile)

def output(data, outfile):
    # Convert to JS
    dthandler = lambda obj: (
        obj.isoformat()
        if isinstance(obj, datetime)
        else None)
    js_data = json.dumps(data, default=dthandler)

    if not outfile:
        return print(js_data)
    with open(outfile + '.js', 'w') as out:
        out.write('data = %s;' % js_data)
    with open(outfile + '.json', 'w') as out:
        out.write(js_data)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: parse.py <excel file> [output file]')
        sys.exit(1)

    infile = sys.argv[1]
    outfile = None if len(sys.argv) < 3 else sys.argv[2]
    main(infile, outfile)