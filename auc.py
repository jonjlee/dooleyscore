#!/usr/bin/env python -B

import json
import re
from pprint import pprint
import numpy as np
from sklearn import metrics
from sklearn import metrics

def dooleyScore(e): return (e['mass'] + e['axillary lns'] + e['heme discharge'] + e['ducts involved'] + e['t4 findings'])
# def dooleyScore(e): return (e['mass'] + e['axillary lns'] + e['heme discharge'] + e['t4 findings'])
# def dooleyScore(e): return (e['mass']*2 + e['axillary lns'] + e['heme discharge'] + e['t4 findings'])

def filterCancerDefined(data):
    return filter(lambda e: re.search('yes|no', e['birads']), data)

def filterCancer(data): 
    return filter(lambda e: e['cancer'] == 'yes', data)

def filterNoCancer(data):
    return filter(lambda e: e['cancer'] == 'no', data)

def filterBiradsValid(e): return ('birads' in e) and (type(e['birads']) is float)
def filterBiradsPos(e): return (e['birads'] >= 4)
def filterBiradsNeg(e): return (e['birads'] < 4)
def filterDooleyValid(e): return ('total' in e) and (type(e['total']) is float)
def filterCombinedValid(e): return ('total' in e) and (type(e['total']) is float) and ('birads' in e) and (type(e['birads']) is float)

def calcStats(disease, noDisease, filterValidFun, filterTestPosFun, filterTestNegFun):
    validDisease = list(filter(filterValidFun, disease))
    validNoDisease = list(filter(filterValidFun, noDisease))
    truepos = list(filter(filterTestPosFun, validDisease))
    falsepos = list(filter(filterTestPosFun, validNoDisease))
    falseneg = list(filter(filterTestNegFun, validDisease))
    trueneg = list(filter(filterTestNegFun, validNoDisease))
    a = len(truepos)
    b = len(falsepos)
    c = len(falseneg)
    d = len(trueneg)
    if a+c > 0:
        sensitivity = a / (a+c)
    else:
        sensitivity = 0

    if b+d > 0:
        specificity = d / (b+d)
    else:
        specificity = 0

    return (sensitivity, specificity, 'n=%d, sens=%.4f, spec=%.4f' % (a+b+c+d, sensitivity, specificity))

def main():
    include = [
        'Breast Mass',
        'Breast Pain',
        'Nipple Discharge',
        # 'Abnormal Mammography',
    ]
    activedata = []
    with open('data.json', 'r') as f:
        source = json.loads(f.read())
        for _, dataset in source.items():
            name = dataset['name']

            print('Processing dataset: %s' % name)
            if name in include:
                activedata += dataset['data']

    for e in activedata:
        e['total'] = dooleyScore(e)

    cancer = list(filterCancer(activedata))
    nocancer = list(filterNoCancer(activedata))

    dooleyStats = []
    for threshold in range(0,14):
        try:
            dooleyStats.append(
                calcStats(
                    cancer,
                    nocancer,
                    filterDooleyValid,
                    lambda e: ((float(e['total']) >= threshold)),
                    lambda e: ((float(e['total']) < threshold))
                ))
        except ValueError as e:
            print(e)
    if dooleyStats[-1][1] < 1: dooleyStats.append((0,1))

    combinedStats = []
    for threshold in range(0,14):
        try:
            combinedStats.append(
                calcStats(
                    cancer,
                    nocancer,
                    filterCombinedValid,
                    lambda e: ((float(e['total']) >= threshold) or (float(e['birads']) >= max(4, threshold))),
                    lambda e: ((float(e['total']) < threshold) and (float(e['birads']) < max(4, threshold)))
                ))
        except ValueError as e:
            print(e)
    if combinedStats[-1][1] < 1: combinedStats.append((0,1, '-'))
    
    biradsStats = []
    for threshold in range(0,7):
        try:
            biradsStats.append(
                calcStats(
                    cancer,
                    nocancer,
                    filterCombinedValid,
                    lambda e: (float(e['birads']) >= threshold),
                    lambda e: (float(e['birads']) < threshold)
                ))
        except ValueError as e:
            print(e)
    if biradsStats[-1][1] < 1: biradsStats.append((0,1))

    print('Dooley Score:')
    pprint([e[-1] for e in dooleyStats])
    print('\nBIRADS:')
    pprint([e[-1] for e in biradsStats])
    print('\nCombined:')
    pprint([e[-1] for e in combinedStats])

    x = np.array([1-e[1] for e in dooleyStats])
    y = np.array([e[0] for e in dooleyStats])
    print('\nDooley Score ROC/AUC: %s' % metrics.auc(x, y))

    x = np.array([1-e[1] for e in biradsStats])
    y = np.array([e[0] for e in biradsStats])
    print('BIRADS ROC/AUC: %s' % metrics.auc(x, y))

    x = np.array([1-e[1] for e in combinedStats])
    y = np.array([e[0] for e in combinedStats])
    print('Combined ROC/AUC: %s' % metrics.auc(x, y))


if __name__ == '__main__':
    main()