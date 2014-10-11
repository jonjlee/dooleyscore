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
                refresh(); 

                // Bypass default bootstrap handler
                return false;
            });
        });

        // Init slider to set threshold
        $("#threshold").slider();
        $("#threshold").on("slide", function(e) { refresh(); });
    }

    function refresh() {
        // Update dataset
        var active = $('.dataset.active');
        activedata = [];
        active.each(function(idx, e) {
            var name = $(e).text().trim(),
                subset = datasetByName(name);
            activedata = activedata.concat(subset.data);
        });
        activedata = filterCancerDefined(activedata);
        $('#n').text(activedata.length);

        // Calculate all stats
        var threshold = parseInt($('#threshold').val());
        var cancer = filterCancer(activedata),
            nocancer = filterNoCancer(activedata);
        var dooleyStats = calcStats(
                cancer, 
                nocancer,
                function(e) { return e.total >= threshold; },
                function(e) { return e.total < threshold; }),
            BIRADSStats = calcStats(
                cancer,
                nocancer,
                function(e) { return e.birads >= 4; },
                function(e) { return e.birads < 4; })
            combinedStats = calcStats(
                cancer,
                nocancer,
                function(e) { return (e.total >= threshold) || (e.birads >= 4); },
                function(e) { return (e.total < threshold) && (e.birads < 4); });

        // Update Dooley Score outcomes table
        $('.outcome-threshold').text(threshold);
        $('#outcome-ttl-col-1').text(cancer.length);
        $('#outcome-ttl-col-2').text(nocancer.length);
        $('#outcome-ttl-row-1').text(dooleyStats.a + dooleyStats.c);
        $('#outcome-ttl-row-2').text(dooleyStats.b + dooleyStats.d);
        $('#true-pos').text(dooleyStats.a);
        $('#false-pos').text(dooleyStats.b);
        $('#false-neg').text(dooleyStats.c);
        $('#true-neg').text(dooleyStats.d);

        // Dooley Score results
        $('#sensitivity').text(dooleyStats.sensitivity);
        $('#specificity').text(dooleyStats.specificity);
        $('#ppv').text(dooleyStats.ppv);
        $('#npv').text(dooleyStats.npv);
        $('#accuracy').text(dooleyStats.accuracy);

        // BIRADS results
        $('#birads-sensitivity').text(BIRADSStats.sensitivity);
        $('#birads-specificity').text(BIRADSStats.specificity);
        $('#birads-ppv').text(BIRADSStats.ppv);
        $('#birads-npv').text(BIRADSStats.npv);
        $('#birads-accuracy').text(BIRADSStats.accuracy);

        // Combined results
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
                colors: ['#00A8F0', '#C0D800', '#CB4B4B'],
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
                colors: ['#00A8F0', '#C0D800', '#CB4B4B'],
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
    function countByBIRADS(data, score) { return _.filter(data, function(e) { return e.birads === score; }).length; }

    init();
    refresh();
});