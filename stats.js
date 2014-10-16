$(function() {
    function init() {
        // Add dataset button for each dataset
        var $datasets = $('#datasets'),
            avail = Object.keys(data).sort(),
            active = ['Nipple Discharge', 'Breast Pain', 'Breast Mass'];
        _.each(avail, function(datasetName, idx) {
            var tpl = _.template($('#dataset-template').html()),
                id = 'dataset-' + idx;
            $datasets.append(tpl({
                id: id,
                name: data[datasetName].name
            }));
            if (active.indexOf(datasetName) >= 0) {
                $('#' + id).addClass('active');
                $('#' + id + ' input').attr('checked', '1');
            }
            $('#' + id).click(function() { 
                // Manually update active class so it will be set on refresh()
                $(this).toggleClass('active');
                refreshStats();

                // Bypass default bootstrap handler
                return false;
            });
        });

        // Formula for combining BIRAD+PE
        $('#formula').text(
            filterCombinedPos
                .toString()
                .replace(/function.*return |; *}/g,'')
                .replace(/e.total/g, 'dooley')
                .replace(/e.birads/g, 'birads')
                .replace(/Math.max/g, 'max')
                .replace(/\|\|/g, 'OR'))

        // Handlers for component checkboxes
        $('.ds-component').change(function() { refreshDooleyScore(); });

        // Init slider to set threshold
        $("#threshold").slider();
        $("#threshold").on("slide", function(e) { refresh(); });

        refreshDooleyScore();
    }

    function refreshDooleyScore() {
        var mass = $('#ds-mass').is(':checked'),
            mass2x = $('#ds-mass2x').is(':checked'),
            ln = $('#ds-ln').is(':checked'),
            heme = $('#ds-heme').is(':checked'),
            ducts = $('#ds-ducts').is(':checked'),
            hemeduct = $('#ds-hemeduct').is(':checked'),
            t4 = $('#ds-t4').is(':checked');

        var i, j, dataset, e;
        _.each(data, function(dataset) {
            _.each(dataset.data, function(e) {
                e.total = 
                    (mass && !mass2x ? e['mass'] || 0 : 0) +
                    (mass2x ? e['mass']*2 || 0 : 0) +
                    (ln ? e['axillary lns'] || 0 : 0) +
                    (heme ? e['heme discharge'] || 0 : 0) +
                    (ducts ? e['ducts involved'] || 0 : 0) +
                    (hemeduct ? e['heme discharge']>=1 && e['ducts involved']>=2 && 3 || 0 : 0) +
                    (t4 ? e['t4 findings'] && e['t4 findings'] || 0 : 0);
                if (isNaN(e.total)) {
                    console.log(e);
                }
            });
        });

        refreshStats();
    }

    function refreshStats() {
        activedata = [];
        activestats = {};

        // Update dataset
        var active = $('.dataset.active');
        active.each(function(idx, e) {
            var name = $(e).text().trim(),
                subset = datasetByName(name);
            activedata = activedata.concat(subset.data);
        });
        activedata = _.filter(activedata, filterCancerDefined);
        // activedata = _.filter(activedata, function(e) { return e['mass']==0; });

        // Calculate all stats
        var cancer = _.filter(activedata, filterCancer),
            nocancer = _.filter(activedata, filterNoCancer);
        for (threshold = 0; threshold <= 13; threshold++) {
            activestats[threshold] = {
                dooley: calcStats(
                    cancer, 
                    nocancer,
                    function(e) { return _.isNumber(e.total); },
                    function(e) { return (e.total >= threshold); },
                    function(e) { return (e.total < threshold); }),
                birads: calcStats(
                    cancer,
                    nocancer,
                    function(e) { return _.isNumber(e.birads); },
                    filterBiradsPos,
                    filterBiradsNeg),
                combined: calcStats(
                    cancer,
                    nocancer,
                    filterCombinedValid,
                    filterCombinedPos,
                    filterCombinedNeg),
                mcnemar: compareStats(
                    cancer,
                    nocancer,
                    filterDooleyValid,
                    filterDooleyPos,
                    filterDooleyNeg,
                    filterBiradsPos,
                    filterBiradsNeg),
                mcnemarCombined: compareStats(
                    cancer,
                    nocancer,
                    filterCombinedValid,
                    filterCombinedPos,
                    filterCombinedNeg,
                    filterBiradsPos,
                    filterBiradsNeg),
            }
        }
        for (threshold = 0; threshold <= 6; threshold++) {
            activestats['birads' + threshold] = calcStats(
                cancer,
                nocancer,
                function(e) { return _.isNumber(e.birads); },
                function(e) { return (e.birads >= threshold); },
                function(e) { return (e.birads < threshold); });
        }

        // Update UI
        refresh();
    }

    // Refreshes the UI based on activedata and activestats, both calculated
    // in refreshStats()
    function refresh() {
        // Update number of samples
        $('#n').text(activedata.length);

        // Retrieve current stats
        var threshold = parseInt($('#threshold').val()),
            cancer = _.filter(activedata, filterCancer),
            nocancer = _.filter(activedata, filterNoCancer),
            dooleyStats = activestats[threshold].dooley,
            biradsStats = activestats[threshold].birads,
            combinedStats = activestats[threshold].combined,
            mcnemarStats = activestats[threshold].mcnemar;
            mcnemarCombinedStats = activestats[threshold].mcnemarCombined;

        // Update Dooley Score outcomes table
        $('.outcome-threshold').text(threshold);
        $('#outcome-ttl-col-1').text(dooleyStats.n_disease);
        $('#outcome-ttl-col-2').text(dooleyStats.n_nodisease);
        $('#outcome-ttl-row-1').text(dooleyStats.a + dooleyStats.c);
        $('#outcome-ttl-row-2').text(dooleyStats.b + dooleyStats.d);
        $('#true-pos').text(dooleyStats.a);
        $('#false-pos').text(dooleyStats.b);
        $('#false-neg').text(dooleyStats.c);
        $('#true-neg').text(dooleyStats.d);

        // Dooley Score results
        $('#samples').text(dooleyStats.n);
        $('#sensitivity').html(dooleyStats.sensitivity + '%<br><small><i>95%: ' + dooleyStats.sensitivity_CI[0] + ' to ' + dooleyStats.sensitivity_CI[1] + '</i></small>');
        $('#specificity').html(dooleyStats.specificity + '%<br><small><i>95%: ' + dooleyStats.specificity_CI[0] + ' to ' + dooleyStats.specificity_CI[1] + '</i></small>');
        $('#ppv').text(dooleyStats.ppv);
        $('#npv').text(dooleyStats.npv);
        $('#accuracy').text(dooleyStats.accuracy);

        // BIRADS results
        $('#birads-samples').text(biradsStats.n);
        $('#birads-sensitivity').html(biradsStats.sensitivity + '%<br><small><i>95%: ' + biradsStats.sensitivity_CI[0] + ' to ' + biradsStats.sensitivity_CI[1] + '</i></small>');
        $('#birads-specificity').html(biradsStats.specificity + '%<br><small><i>95%: ' + biradsStats.specificity_CI[0] + ' to ' + biradsStats.specificity_CI[1] + '</i></small>');
        $('#birads-ppv').text(biradsStats.ppv);
        $('#birads-npv').text(biradsStats.npv);
        $('#birads-accuracy').text(biradsStats.accuracy);

        // Combined results
        $('#combined-samples').text(combinedStats.n);
        $('#combined-sensitivity').html(combinedStats.sensitivity + '%<br><small><i>95%: ' + combinedStats.sensitivity_CI[0] + ' to ' + combinedStats.sensitivity_CI[1] + '</i></small>');
        $('#combined-specificity').html(combinedStats.specificity + '%<br><small><i>95%: ' + combinedStats.specificity_CI[0] + ' to ' + combinedStats.specificity_CI[1] + '</i></small>');
        $('#combined-ppv').text(combinedStats.ppv);
        $('#combined-npv').text(combinedStats.npv);
        $('#combined-accuracy').text(combinedStats.accuracy);

        // Dooley Score Comparison
        $('#sensitivity-pospos').text(mcnemarStats.sensitivity.pospos);
        $('#sensitivity-posneg').text(mcnemarStats.sensitivity.posneg);
        $('#sensitivity-negpos').text(mcnemarStats.sensitivity.negpos);
        $('#sensitivity-negneg').text(mcnemarStats.sensitivity.negneg);
        $('#sensitivity-diff').text((mcnemarStats.sensitivity.diff * 100).toFixed(2) + '%');
        $('#sensitivity-mcnemar').text(mcnemarStats.sensitivity.p);
        
        $('#specificity-pospos').text(mcnemarStats.specificity.pospos);
        $('#specificity-posneg').text(mcnemarStats.specificity.posneg);
        $('#specificity-negpos').text(mcnemarStats.specificity.negpos);
        $('#specificity-negneg').text(mcnemarStats.specificity.negneg);
        $('#specificity-diff').text((mcnemarStats.specificity.diff * 100).toFixed(2) + '%');
        $('#specificity-mcnemar').text(mcnemarStats.specificity.p);

        // Combined Comparison
        $('#combined-sensitivity-pospos').text(mcnemarCombinedStats.sensitivity.pospos);
        $('#combined-sensitivity-posneg').text(mcnemarCombinedStats.sensitivity.posneg);
        $('#combined-sensitivity-negpos').text(mcnemarCombinedStats.sensitivity.negpos);
        $('#combined-sensitivity-negneg').text(mcnemarCombinedStats.sensitivity.negneg);
        $('#combined-sensitivity-diff').text((mcnemarCombinedStats.sensitivity.diff * 100).toFixed(2) + '%');
        $('#combined-sensitivity-mcnemar').text(mcnemarCombinedStats.sensitivity.p);
        
        $('#combined-specificity-pospos').text(mcnemarCombinedStats.specificity.pospos);
        $('#combined-specificity-posneg').text(mcnemarCombinedStats.specificity.posneg);
        $('#combined-specificity-negpos').text(mcnemarCombinedStats.specificity.negpos);
        $('#combined-specificity-negneg').text(mcnemarCombinedStats.specificity.negneg);
        $('#combined-specificity-diff').text((mcnemarCombinedStats.specificity.diff * 100).toFixed(2) + '%');
        $('#combined-specificity-mcnemar').text(mcnemarCombinedStats.specificity.p);

        // Update Dooley score graph
        var i,
            dd1 = [],
            dd2 = [],
            dd3 = [],
            max = 0,
            graph = $('#graph1')[0];
        for (i = 0; i <= 12; i++) {
            var nocancercount = countByDooleyScore(nocancer, i),
                cancercount = countByDooleyScore(cancer, i);
            dd1.push([i, nocancercount]);
            dd2.push([i, cancercount]);
            max = Math.max(max, nocancercount, cancercount);
        }
        Flotr.draw(graph, [
                { data: dd1, label: '&nbsp;Cancer -'},
                { data: dd2, label: '&nbsp;Cancer +'},
                { data: [[threshold, 0], [threshold, max]]}
            ], {
                colors: ['#00A8F0', '#C0D800', '#9440ED'],
                xaxis: {
                    title: 'Dooley Score',
                    ticks: [0,1,2,3,4,5,6,7,8,9,10,11,12],
                    min: 0,
                    max: 12,
                    tickDecimals: 0
                },
                yaxis: {
                    title: 'n',
                },
                mouse: {
                    position: 'ne',
                    track: true,
                    trackDecimals: 0,
                    sensibility: 10,
                    trackY: true,
                    trackFormatter: function(e) { return 'n = '+e.y; }
                },
                legend : {
                    position : 'se',
                }
            }
        );
        
        // Update BIRADS score graph
        dd1=[];
        dd2=[];
        max = 0;
        graph = $('#graph2')[0];
        for (i = 0; i <= 5; i++) {
            var nocancercount = countByBIRADS(nocancer, i),
                cancercount = countByBIRADS(cancer, i);
            dd1.push([i, nocancercount]);
            dd2.push([i, cancercount]);
            max = Math.max(max, nocancercount, cancercount);
        }
        Flotr.draw(graph, [
                { data: dd1, label: '&nbsp;Cancer -'},
                { data: dd2, label: '&nbsp;Cancer +'},
                { data: [[4, 0], [4, max]]}
            ], {
                colors: ['#00A8F0', '#C0D800', '#9440ED'],
                xaxis: {
                    title: 'BIRADS Score',
                    ticks: [0,1,2,3,4,5],
                    min: 0,
                    max: 5,
                    tickDecimals: 0
                },
                yaxis: {
                    title: 'n',
                },
                mouse: {
                    position: 'ne',
                    track: true,
                    trackDecimals: 0,
                    sensibility: 10,
                    trackY: true,
                    trackFormatter: function(e) { return 'n = '+e.y; }
                },
                legend : {
                    position : 'se',
                }
            }
        );

        // Update ROC graph
        dd1 = [];
        dd2 = [];
        dd3 = [];
        graph = $('#graph3')[0];
        for (i = 0; i <= 13; i++) {
            dd1.push([(1-activestats[i].dooley.specificity/100).toFixed(2), activestats[i].dooley.sensitivity/100]);
            dd3.push([(1-activestats[i].combined.specificity/100).toFixed(2), activestats[i].combined.sensitivity/100]);
        }
        for (i = 0; i <= 6; i++) {
            dd2.push([(1-activestats['birads'+i].specificity/100).toFixed(2), activestats['birads'+i].sensitivity/100])
        }
        if (parseFloat(dd1[dd1.length-1][0]) > 0) { dd1.push(["0.0","0.0"]); }
        if (parseFloat(dd1[0][0]) < 1) { dd1.unshift(["1.0","1.0"]); }
        if (parseFloat(dd2[dd2.length-1][0]) > 0) { dd2.push(["0.0","0.0"]); }
        if (parseFloat(dd2[0][0]) < 1) { dd2.unshift(["1.0","1.0"]); }
        if (parseFloat(dd3[dd3.length-1][0]) > 0) { dd3.push(["0.0","0.0"]); }
        if (parseFloat(dd3[0][0]) < 1) { dd3.unshift(["1.0","1.0"]); }
        Flotr.draw(graph, [
                { data: dd1, label: '&nbsp;Dooley Score', lines: { show: true }, points: { show: true }},
                { data: dd2, label: '&nbsp;BIRADS', lines: { show: true }, points: { show: true }},
                { data: dd3, label: '&nbsp;Combined', lines: { show: true }, points: { show: true }},
                { data: [[(1-activestats[threshold].dooley.specificity/100).toFixed(2), activestats[threshold].dooley.sensitivity/100]], points: { radius: 4, lineWidth: 8, show: true }},
                { data: [[(1-activestats[threshold].combined.specificity/100).toFixed(2), activestats[threshold].combined.sensitivity/100]], points: { radius: 4, lineWidth: 8, show: true }},
            ], {
                colors: ['#00A8F0', '#663300', '#C0D800', '#9440ED', '#9440ED'],
                xaxis: {
                    title: '1 - Spec',
                    tickDecimals: 2,
                    min: 0,
                    max: 1,
                },
                yaxis: {
                    title: 'Sens',
                    tickDecimals: 2,
                    min: 0,
                    max: 1,
                },
                mouse: {
                    position: 'ne',
                    track: true,
                    trackDecimals: 0,
                    sensibility: 2,
                    trackY: false,
                    trackFormatter: function(e) { return 'sens: ' + e.y + '<br/>spec: ' + (1-e.x).toFixed(2); }
                },
                legend : {
                    position : 'se',
                }
            }
        );

        // Update approximate AUC values
        $('#dooley-auc').text(auc(dd1))
        $('#birads-auc').text(auc(dd2))
        $('#combined-auc').text(auc(dd3))
    }

    function datasetByName(name) {
        for (var i in data) {
            if (data[i].name == name) {
                return data[i];
            }
        }
        return null;
    }

    function auc(curve) {
        var auc = 0;
        for (i = 1; i < curve.length; i++) {
            var dx = Math.abs(curve[i][0]-curve[i-1][0]),
                dy = Math.abs(curve[i][1]-curve[i-1][1]),
                y_min = Math.min(curve[i][1], curve[i-1][1]);
            auc += dx*y_min;
            auc += 0.5*dx*dy;
        }
        return auc.toFixed(4);
    }

    function calcStats(disease, noDisease, filterValidFun, filterTestPosFun, filterTestNegFun) {
        var validDisease = _.filter(disease, filterValidFun),
            validNoDisease = _.filter(noDisease, filterValidFun),
            truepos = _.filter(validDisease, filterTestPosFun),
            falsepos = _.filter(validNoDisease, filterTestPosFun),
            falseneg = _.filter(validDisease, filterTestNegFun),
            trueneg = _.filter(validNoDisease, filterTestNegFun),
            a = truepos.length,
            b = falsepos.length,
            c = falseneg.length,
            d = trueneg.length,
            n = a+b+c+d,
            sensitivity = a / (a+c),
            specificity = d / (b+d);

        var r = {
            a: a,
            b: b,
            c: c,
            d: d,
            n: a+b+c+d,
            n_disease: a+c,
            n_nodisease: b+d,
            n_testpos: a+b,
            n_testneg: c+d,
            sensitivity: sensitivity * 100,
            sensitivity_CI: [
                (sensitivity - 1.96 * Math.sqrt(sensitivity * (1 - sensitivity) / n)) * 100,
                (sensitivity + 1.96 * Math.sqrt(sensitivity * (1 - sensitivity) / n)) * 100],
            specificity: specificity * 100,
            specificity_CI: [
                (specificity - 1.96 * Math.sqrt(specificity * (1 - specificity) / n)) * 100,
                (specificity + 1.96 * Math.sqrt(specificity * (1 - specificity) / n)) * 100],
            ppv: a / (a+b),
            npv: d / (d+c),
            accuracy: (a+d) / (a+b+c+d) * 100,
        };

        // Fixed decimal places
        var fixedFields = ['sensitivity', 'specificity', 'ppv', 'npv', 'accuracy', 'sensitivity_CI', 'specificity_CI'];
        for (var i in fixedFields) {
            if (Array.isArray(r[fixedFields[i]])) {
                for (var j in r[fixedFields[i]]) {
                    r[fixedFields[i]][j] = r[fixedFields[i]][j].toFixed(2); 
                }
            } else {
                r[fixedFields[i]] = r[fixedFields[i]].toFixed(2); 
            }
        }

        // Convert all NaN (divide by 0) to 0
        var nanFields = ['sensitivity', 'specificity', 'ppv', 'npv', 'accuracy'];
        for (var i in nanFields) {
            if (isNaN(r[nanFields[i]])) {
                r[nanFields[i]] = 0;
            }
        }

        return r;
    }
    
    function compareStats(disease, noDisease, filterValidFun, filterTest1PosFun, filterTest1NegFun, filterTest2PosFun, filterTest2NegFun) {
        var validDisease = _.filter(disease, filterValidFun),
            validNoDisease = _.filter(noDisease, filterValidFun);
        var pos, neg, posneg, negpos,
            r, s, critval,
            truepos, falsepos, falseneg, trueneg,
            a, b, c, d,
            ret = {};

        // Calculate sensitivity & specificity for test 1
        truepos = _.filter(validDisease, filterTest1PosFun);
        falsepos = _.filter(validNoDisease, filterTest1PosFun);
        falseneg = _.filter(validDisease, filterTest1NegFun);
        trueneg = _.filter(validNoDisease, filterTest1NegFun);
        a = truepos.length;
        b = falsepos.length;
        c = falseneg.length;
        d = trueneg.length;
        ret.sensitivity1 = a / (a+c);
        ret.specificity1 = d / (b+d);

        // Calculate sensitivity & specificity for test 2
        truepos = _.filter(validDisease, filterTest2PosFun);
        falsepos = _.filter(validNoDisease, filterTest2PosFun);
        falseneg = _.filter(validDisease, filterTest2NegFun);
        trueneg = _.filter(validNoDisease, filterTest2NegFun);
        a = truepos.length;
        b = falsepos.length;
        c = falseneg.length;
        d = trueneg.length;
        ret.sensitivity2 = a / (a+c);
        ret.specificity2 = d / (b+d);

        // Compare sensitivities
        pos = _.filter(validDisease, filterTest1PosFun);
        neg = _.filter(validDisease, filterTest1NegFun);
        pospos = _.filter(pos, filterTest2PosFun);
        negneg = _.filter(neg, filterTest2NegFun);
        posneg = _.filter(pos, filterTest2NegFun);
        negpos = _.filter(neg, filterTest2PosFun);
        r = posneg.length;
        s = negpos.length;
        critval = Math.pow(Math.abs(r-s)-1, 2) / (r+s);
        ret.sensitivity = {
            pospos: pospos.length,
            negneg: negneg.length,
            posneg: posneg.length,
            negpos: negpos.length,
            diff: (ret.sensitivity1 - ret.sensitivity2),
            p: chisqcalc(critval).toFixed(8),
        };

        // Compare specificities
        pos = _.filter(validNoDisease, filterTest1PosFun);
        neg = _.filter(validNoDisease, filterTest1NegFun);
        pospos = _.filter(pos, filterTest2PosFun);
        negneg = _.filter(neg, filterTest2NegFun);
        posneg = _.filter(pos, filterTest2NegFun);
        negpos = _.filter(neg, filterTest2PosFun);
        r = posneg.length;
        s = negpos.length;
        critval = Math.pow(Math.abs(r-s)-1, 2) / (r+s);
        ret.specificity = {
            pospos: pospos.length,
            negneg: negneg.length,
            posneg: posneg.length,
            negpos: negpos.length,
            diff: (ret.specificity1 - ret.specificity2),
            p: chisqcalc(critval).toFixed(8),
        }

        return ret;
    }

    // -----------------------------------------------------
    // Code for chi-squared p-value adapted from
    // www.swogstat.org/stat/public/chisq_calculator.htm
    // -----------------------------------------------------
    function chisqcalc(criticalValue, degreesOfFreedom) {
        // Calculate chi-squared p-value given a critical value
        degreesOfFreedom = (degreesOfFreedom === undefined) ? 1 : degreesOfFreedom;

        // max value to represent exp(x)
        var BIGX = 20.0;
        var ex = function(x) { return (x < -BIGX) ? 0.0 : Math.exp(x); }

        // probability of normal z value
        var poz = function(z) {
            var y, x, w;
            var Z_MAX = 6.0; // Maximum meaningful z value
            
            if (z == 0.0) {
                x = 0.0;
            } else {
                y = 0.5 * Math.abs(z);
                if (y >= (Z_MAX * 0.5)) {
                    x = 1.0;
                } else if (y < 1.0) {
                    w = y * y;
                    x = ((((((((0.000124818987 * w
                             - 0.001075204047) * w + 0.005198775019) * w
                             - 0.019198292004) * w + 0.059054035642) * w
                             - 0.151968751364) * w + 0.319152932694) * w
                             - 0.531923007300) * w + 0.797884560593) * y * 2.0;
                } else {
                    y -= 2.0;
                    x = (((((((((((((-0.000045255659 * y
                                   + 0.000152529290) * y - 0.000019538132) * y
                                   - 0.000676904986) * y + 0.001390604284) * y
                                   - 0.000794620820) * y - 0.002034254874) * y
                                   + 0.006549791214) * y - 0.010557625006) * y
                                   + 0.011630447319) * y - 0.009279453341) * y
                                   + 0.005353579108) * y - 0.002141268741) * y
                                   + 0.000535310849) * y + 0.999936657524;
                }
            }
            return z > 0.0 ? ((x + 1.0) * 0.5) : ((1.0 - x) * 0.5);
        }

        // probability of chi-square value
        var pochisq = function(x, df) {
            var a, y, s;
            var e, c, z;
            var even; // True if df is an even number
            var LOG_SQRT_PI = 0.5723649429247000870717135; // log(sqrt(pi))
            var I_SQRT_PI = 0.5641895835477562869480795;   // 1 / sqrt(pi)
            
            if (x <= 0.0 || df < 1) { return 1.0; }
            
            a = 0.5 * x;
            even = !(df & 1);
            if (df > 1) {
                y = ex(-a);
            }
            s = (even ? y : (2.0 * poz(-Math.sqrt(x))));
            if (df > 2) {
                x = 0.5 * (df - 1.0);
                z = (even ? 1.0 : 0.5);
                if (a > BIGX) {
                    e = (even ? 0.0 : LOG_SQRT_PI);
                    c = Math.log(a);
                    while (z <= x) {
                        e = Math.log(z) + e;
                        s += ex(c * z - a - e);
                        z += 1.0;
                    }
                    return s;
                } else {
                    e = (even ? 1.0 : (I_SQRT_PI / Math.sqrt(a)));
                    c = 0.0;
                    while (z <= x) {
                        e = e * (a / z);
                        c = c + e;
                        z += 1.0;
                    }
                    return c * y + s;
                }
            } else {
                return s;
            }
        }
        
        // Compute critical chi-square value to produce given p.
        // Do a bisection search for a value within CHI_EPSILON,
        // relying on the monotonicity of pochisq().
        var critchi = function(p, df) {
            var CHI_EPSILON = 0.000001,   // Accuracy of critchi approximation
                CHI_MAX = 99999.0,        // Maximum chi-square value
                minchisq = 0.0,
                maxchisq = CHI_MAX,
                chisqval;
            if (p <= 0.0) { return maxchisq; }
            if (p >= 1.0) { return 0.0; }
            chisqval = df / Math.sqrt(p); // fair first value
            while ((maxchisq - minchisq) > CHI_EPSILON) {
                if (pochisq(chisqval, df) < p) {
                    maxchisq = chisqval;
                } else {
                    minchisq = chisqval;
                }
                chisqval = (maxchisq + minchisq) * 0.5;
            }
            return chisqval;
        }
     
        return pochisq(criticalValue, degreesOfFreedom);
    }
    // -----------------------------------------------------

    function filterCancerDefined(e) { return e.cancer.match(/yes|no/); }
    function filterCancer(e) { return e.cancer === 'yes'; }
    function filterNoCancer(e) { return e.cancer === 'no'; }
    function filterBiradsPos(e) { return (e.birads >= 4); }
    function filterBiradsNeg(e) { return (e.birads < 4); }
    function filterDooleyValid(e) { return _.isNumber(e.total); }
    function filterDooleyPos(e) { return (e.total >= threshold); }
    function filterDooleyNeg(e) { return (e.total < threshold); }
    function filterCombinedValid(e) { return _.isNumber(e.total) && _.isNumber(e.birads); }
    function filterCombinedPos(e) { return (e.total >= threshold) || (e.total+e.birads >= threshold+2) || (e.birads >= Math.max(4, threshold)); }
    // function filterCombinedPos(e) { return Math.max(e['birads'], e['total']+e['birads']-3) >= threshold; }
    function filterCombinedNeg(e) { return !filterCombinedPos(e); }
    function countByDooleyScore(data, score) { return _.filter(data, function(e) { return e.total == score; }).length; }
    function countByBIRADS(data, score) { return _.filter(data, function(e) { return _.isNumber(e.birads) && (e.birads === score); }).length; }

    init();
    refreshStats();
    refresh();
});