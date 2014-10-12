$(function() {
    function init() {
        // Add dataset button for each dataset
        var $datasets = $('#datasets'),
            avail = Object.keys(data).sort(); //['Nipple Discharge', 'Breast Pain']; //
        _.each(avail, function(datasetName, idx) {
            var tpl = _.template($('#dataset-template').html()),
                id = 'dataset-' + idx;
            $datasets.append(tpl({
                id: id,
                name: data[datasetName].name
            }));
            $('#' + id).click(function() { 
                // Manually update active class so it will be set on refresh()
                $(this).toggleClass('active');
                refreshStats();

                // Bypass default bootstrap handler
                return false;
            });
        });

        // Init slider to set threshold
        $("#threshold").slider();
        $("#threshold").on("slide", function(e) { refresh(); });
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
        activedata = filterCancerDefined(activedata);

        // Calculate all stats
        var cancer = filterCancer(activedata),
            nocancer = filterNoCancer(activedata);
        for (threshold = 0; threshold <= 12; threshold++) {
            activestats[threshold] = {
                dooley: calcStats(
                    cancer, 
                    nocancer,
                    function(e) { return _.isNumber(e.total) && (e.total >= threshold); },
                    function(e) { return _.isNumber(e.total) && (e.total < threshold); }),
                birads: calcStats(
                    cancer,
                    nocancer,
                    function(e) { return _.isNumber(e.birads) && (e.birads >= 4); },
                    function(e) { return _.isNumber(e.birads) && (e.birads < 4); }),
                combined: calcStats(
                    cancer,
                    nocancer,
                    function(e) { return _.isNumber(e.total) && _.isNumber(e.birads) && ((e.total >= threshold) || (e.birads >= 4)); },
                    function(e) { return _.isNumber(e.total) && _.isNumber(e.birads) && ((e.total < threshold) && (e.birads < 4)); }),
            }
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
            cancer = filterCancer(activedata),
            nocancer = filterNoCancer(activedata),
            dooleyStats = activestats[threshold].dooley,
            biradsStats = activestats[threshold].birads,
            combinedStats = activestats[threshold].combined;

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
        $('#sensitivity').text(dooleyStats.sensitivity);
        $('#specificity').text(dooleyStats.specificity);
        $('#ppv').text(dooleyStats.ppv);
        $('#npv').text(dooleyStats.npv);
        $('#accuracy').text(dooleyStats.accuracy);

        // BIRADS results
        $('#birads-samples').text(biradsStats.n);
        $('#birads-sensitivity').text(biradsStats.sensitivity);
        $('#birads-specificity').text(biradsStats.specificity);
        $('#birads-ppv').text(biradsStats.ppv);
        $('#birads-npv').text(biradsStats.npv);
        $('#birads-accuracy').text(biradsStats.accuracy);

        // Combined results
        $('#combined-samples').text(combinedStats.n);
        $('#combined-sensitivity').text(combinedStats.sensitivity);
        $('#combined-specificity').text(combinedStats.specificity);
        $('#combined-ppv').text(combinedStats.ppv);
        $('#combined-npv').text(combinedStats.npv);
        $('#combined-accuracy').text(combinedStats.accuracy);

        // Update Dooley score graph
        var i,
            dd1 = [],
            dd2 = [],
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
                    ticks: [0,1,2,3,4,5,6,7,8,9,10,11,12],
                    min: 0,
                    max: 12,
                    tickDecimals: 0
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
                    ticks: [0,1,2,3,4,5],
                    min: 0,
                    max: 5,
                    tickDecimals: 0
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
        graph = $('#graph3')[0];
        for (i = 0; i <= 12; i++) {
            dd1.push([(1-activestats[i].dooley.specificity).toFixed(2), activestats[i].dooley.sensitivity]);
            dd2.push([(1-activestats[i].combined.specificity).toFixed(2), activestats[i].combined.sensitivity]);
        }
        if (parseFloat(dd1[dd1.length-1][0]) > 0) { dd1.push(["0.0","0.0"]); }
        if (parseFloat(dd1[0][0]) < 1) { dd1.unshift(["1.0","1.0"]); }
        if (parseFloat(dd2[dd2.length-1][0]) > 0) { dd2.push(["0.0","0.0"]); }
        if (parseFloat(dd2[0][0]) < 1) { dd2.unshift(["1.0","1.0"]); }
        Flotr.draw(graph, [
                { data: dd1, label: '&nbsp;Dooley Score'},
                { data: dd2, label: '&nbsp;Combined'},
                { data: [[(1-activestats[threshold].dooley.specificity).toFixed(2), activestats[threshold].dooley.sensitivity]], points: { show: true }},
                { data: [[(1-activestats[threshold].combined.specificity).toFixed(2), activestats[threshold].combined.sensitivity]], points: { show: true }},
            ], {
                colors: ['#00A8F0', '#C0D800', '#9440ED', '#9440ED'],
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
                    sensibility: 10,
                    trackY: false,
                    trackFormatter: function(e) { return 'sens: ' + e.y + '<br/>spec: ' + (1-e.x).toFixed(2); }
                },
                legend : {
                    position : 'se',
                }
            }
        );
    }

    function datasetByName(name) {
        for (var i in data) {
            if (data[i].name == name) {
                return data[i];
            }
        }
        return null;
    }

    function calcStats(disease, noDisease, filterTestPosFun, filterTestNegFun) {
        var truepos = _.filter(disease, filterTestPosFun),
            falsepos = _.filter(noDisease, filterTestPosFun),
            falseneg = _.filter(disease, filterTestNegFun),
            trueneg = _.filter(noDisease, filterTestNegFun),
            a = truepos.length,
            b = falsepos.length,
            c = falseneg.length,
            d = trueneg.length;

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
            sensitivity: a / (a+c),
            specificity: d / (b+d),
            ppv: a / (a+b),
            npv: d / (d+c),
            accuracy: (a+d) / (a+b+c+d)
        };

        // Fixed decimal places
        var fixedFields = ['sensitivity', 'specificity', 'ppv', 'npv', 'accuracy'];
        for (var i in fixedFields) {
            r[fixedFields[i]] = r[fixedFields[i]].toFixed(2);
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

    function filterCancerDefined(data) { return _.filter(data, function(e) { return e.cancer.match(/yes|no/); }); }
    function filterCancer(data) { return _.filter(data, function(e) { return e.cancer === 'yes'; }); }
    function filterNoCancer(data) { return _.filter(data, function(e) { return e.cancer === 'no'; }); }
    function countByDooleyScore(data, score) { return _.filter(data, function(e) { return e.total == score; }).length; }
    function countByBIRADS(data, score) { return _.filter(data, function(e) { return _.isNumber(e.birads) && (e.birads === score); }).length; }

    init();
    refreshStats();
    refresh();
});