#!/usr/bin/env python -B

import json
import re
from pprint import pprint
import numpy as np
from sklearn import metrics
from rpy2 import robjects as ro
import rpy2.interactive.packages as rpackages
import rpy2.interactive
pRoc = rpackages.importr("pROC")

include = [
    'Breast Mass',
    'Breast Pain',
    'Nipple Discharge',
    'Abnormal Mammography',
]

def dooleyScore(e): 
    if e['heme discharge']>=1 and e['ducts involved']>=2:
        hemeduct = 4
    # elif e['heme discharge']>=1 and e['ducts involved']==1:
        # hemeduct = 2
    else:
        hemeduct = 0
    return (e['mass']*2 + e['axillary lns'] + hemeduct + e['t4 findings'])
# def dooleyScore(e): return (e['mass'] + e['axillary lns'] + e['heme discharge'] + e['ducts involved'] + e['t4 findings'])
# def dooleyScore(e): return (e['mass'] + e['axillary lns'] + e['heme discharge'] + e['t4 findings'])
# def dooleyScore(e): return (e['mass']*2 + e['axillary lns'] + e['heme discharge'] + e['t4 findings'])

# def filterCombinedPos(threshold): 
#     return lambda e: (float(e['total']) >= threshold) or (float(e['birads']) >= max(4, threshold))
def filterCombinedPos(threshold): 
    return lambda e: (float(e['total']) >= threshold) or (float(e['birads']) >= max(4, threshold)) or (float(e['total'])+float(e['birads']) >= threshold+2)

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
    activedata = []
    with open('data.json', 'r') as f:
        source = json.loads(f.read())
        for _, dataset in source.items():
            name = dataset['name']

            # print('Processing dataset: %s' % name)
            if name in include:
                activedata += dataset['data']

    activedata = list(filter(filterCancerDefined, activedata))

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
                    filterCombinedPos(threshold),
                    lambda e: not filterCombinedPos(threshold)(e)
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

    # Calculation with R
    activedata = list(filter(filterCombinedValid, activedata))
    y = [1 if e['cancer'] == 'yes' else 0 for e in activedata]
    pred = [e['total'] for e in activedata]
    pred2 = [e['birads'] for e in activedata]
    pred3 = [e['total'] + e['birads'] for e in activedata]
    y = tuple(y)
    pred = tuple(pred)
    y = ro.IntVector(y)
    pred = ro.FloatVector(pred)
    pred2 = ro.FloatVector(pred2)
    pred3 = ro.FloatVector(pred3)
    dooleyroc = pRoc.roc(y, pred)
    biradsroc = pRoc.roc(y, pred2)
    combinedroc = pRoc.roc(y, pred3)
    print('Dooley Score vs BIRADS')
    print(pRoc.roc_test(dooleyroc, biradsroc))
    # print(pRoc.power_roc_test(dooleyroc, biradsroc))
    print('Combined vs BIRADS')
    print(pRoc.roc_test(combinedroc, biradsroc))
    # print(pRoc.power_roc_test(combinedroc, biradsroc))

    # print('Dooley Score:')
    # pprint([e[-1] for e in dooleyStats])
    # print('\nBIRADS:')
    # pprint([e[-1] for e in biradsStats])
    # print('\nCombined:')
    # pprint([e[-1] for e in combinedStats])

    x = np.array([1-e[1] for e in biradsStats])
    y = np.array([e[0] for e in biradsStats])
    print('BIRADS ROC/AUC: %.4f' % metrics.auc(x, y))

    x = np.array([1-e[1] for e in dooleyStats])
    y = np.array([e[0] for e in dooleyStats])
    print('Dooley Score ROC/AUC: %.4f' % metrics.auc(x, y))

    x = np.array([1-e[1] for e in combinedStats])
    y = np.array([e[0] for e in combinedStats])
    print('Combined ROC/AUC: %.4f' % metrics.auc(x, y))


if __name__ == '__main__':
    main()