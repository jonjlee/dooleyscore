#!/usr/bin/env python -B

import json
import re
from pprint import pprint
import numpy as np
from sklearn import metrics
from rpy2 import robjects as ro
import rpy2.robjects.packages as rpackages
import rpy2.rlike.container as rlc
pRoc = rpackages.importr("pROC")

include = [
    'Breast Mass',
    'Breast Pain',
    'Nipple Discharge',
    'Abnormal Mammography',
]

# def dooleyScore(e): 
#     if e['heme discharge']>=1 and e['ducts involved']>=2:
#         hemeduct = 4
#     # elif e['heme discharge']>=1 and e['ducts involved']==1:
#         # hemeduct = 2
#     else:
#         hemeduct = 0
#     return (e['mass']*2 + e['axillary lns'] + hemeduct + e['t4 findings'])
# def dooleyScore(e): return (e['mass'] + e['axillary lns'] + e['heme discharge'] + e['ducts involved'] + e['t4 findings'])
# def dooleyScore(e): return (e['mass'] + e['axillary lns'] + e['heme discharge'] + e['t4 findings'])
def dooleyScore(e): return (e['mass']*2 + e['axillary lns'] + e['heme discharge'] + e['t4 findings'])

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
    print('Datasets: %s' % include)

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
    dooleydata = list(filter(filterDooleyValid, activedata))
    dooleyy = [1 if e['cancer'] == 'yes' else 0 for e in dooleydata]
    dooleypred = [e['total'] for e in dooleydata]
    dooleyy = ro.IntVector(dooleyy)
    dooleypred = ro.FloatVector(dooleypred)
    dooleyroc = pRoc.roc(dooleyy, dooleypred)

    combineddata = list(filter(filterCombinedValid, activedata))
    y = [1 if e['cancer'] == 'yes' else 0 for e in combineddata]
    y = ro.IntVector(y)

    pred2 = [e['birads'] for e in combineddata]
    pred2 = ro.FloatVector(pred2)
    biradsroc = pRoc.roc(y, pred2)

    pred3 = [max(e['birads'], e['total']+e['birads']-3) for e in combineddata]
    pred3 = ro.FloatVector(pred3)
    combinedroc = pRoc.roc(y, pred3)

    dooleyRocTest = pRoc.roc_test(dooleyroc, biradsroc)
    combinedRocTest = pRoc.roc_test(roc1=combinedroc, roc2=biradsroc)
    biradsAuc = dooleyRocTest.rx2('estimate')[1]
    dooleyAuc = dooleyRocTest.rx2('estimate')[0]
    combinedAuc = combinedRocTest.rx2('estimate')[0]

    print('ROC/AUC using R:')
    print('  BIRADS: %.4f' % biradsAuc)
    print('  Dooley Score: %.4f. Diff = %.4f (p = %.4f)' % (dooleyAuc, dooleyAuc - biradsAuc, dooleyRocTest.rx2('p.value')[0]))
    print('  Combined: %.4f. Diff = %.4f (p = %.4f)' % (combinedAuc, combinedAuc - biradsAuc, combinedRocTest.rx2('p.value')[0]))

    # Print sensitivity/specificity pairs
    #
    # print('Dooley Score:')
    # pprint([e[-1] for e in dooleyStats])
    # print('\nBIRADS:')
    # pprint([e[-1] for e in biradsStats])
    # print('\nCombined:')
    # pprint([e[-1] for e in combinedStats])

    print('\nROC/AUC using sklearn:')
    x = np.array([1-e[1] for e in biradsStats])
    y = np.array([e[0] for e in biradsStats])
    biradsAuc = metrics.auc(x, y)
    print('  BIRADS: %.4f' % biradsAuc)

    x = np.array([1-e[1] for e in dooleyStats])
    y = np.array([e[0] for e in dooleyStats])
    dooleyAuc = metrics.auc(x, y)
    print('  Dooley Score: %.4f. Diff = %.4f' % (dooleyAuc, dooleyAuc - biradsAuc))

    x = np.array([1-e[1] for e in combinedStats])
    y = np.array([e[0] for e in combinedStats])
    combinedAuc = metrics.auc(x, y)
    print('  Combined: %.4f. Diff = %.4f' % (combinedAuc, combinedAuc - biradsAuc))


if __name__ == '__main__':
    main()