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

        // Update Dooley Score outcomes table
        var threshold = parseInt($('#threshold').val());
        var cancer = filterCancer(activedata),
            nocancer = filterNoCancer(activedata),
            gethreshold = filterDooleyGeThreshold(activedata, threshold),
            ltthreshold = filterDooleyLtThreshold(activedata, threshold),
            truepos = filterDooleyGeThreshold(cancer, threshold),
            falsepos = filterDooleyGeThreshold(nocancer, threshold),
            falseneg = filterDooleyLtThreshold(cancer, threshold),
            trueneg = filterDooleyLtThreshold(nocancer, threshold),
            a = truepos.length,
            b = falsepos.length,
            c = falseneg.length,
            d = trueneg.length;

        $('.outcome-threshold').text(threshold);
        $('#outcome-ttl-col-1').text(cancer.length);
        $('#outcome-ttl-col-2').text(nocancer.length);
        $('#outcome-ttl-row-1').text(gethreshold.length);
        $('#outcome-ttl-row-2').text(ltthreshold.length);
        $('#true-pos').text(a);
        $('#false-pos').text(b);
        $('#false-neg').text(c);
        $('#true-neg').text(d);

        // Update Dooley Score calculations
        var sensitivity = a / (a+c),
            specificity = d / (b+d),
            ppv = a / (a+b),
            npv = d / (d+c),
            accuracy = (a+d) / (a+b+c+d);
        if (isNaN(sensitivity)) { sensitivity = 0; }
        if (isNaN(specificity)) { specificity = 0; }
        if (isNaN(ppv)) { ppv = 0; }
        if (isNaN(npv)) { npv = 0; }
        if (isNaN(accuracy)) { accuracy = 0; }
        $('#sensitivity').text(sensitivity.toFixed(2));
        $('#specificity').text(specificity.toFixed(2));
        $('#ppv').text(ppv.toFixed(2));
        $('#npv').text(npv.toFixed(2));
        $('#accuracy').text(accuracy.toFixed(2));

        // Update BIRADS calculations
        gethreshold = filterBIRADSGeThreshold(activedata, 4);
        ltthreshold = filterBIRADSLtThreshold(activedata, 4);
        truepos = filterBIRADSGeThreshold(cancer, 4);
        falsepos = filterBIRADSGeThreshold(nocancer, 4);
        falseneg = filterBIRADSLtThreshold(cancer, 4);
        trueneg = filterBIRADSLtThreshold(nocancer, 4);
        a = truepos.length;
        b = falsepos.length;
        c = falseneg.length;
        d = trueneg.length;
        sensitivity = a / (a+c);
        specificity = d / (b+d);
        ppv = a / (a+b);
        npv = d / (d+c);
        accuracy = (a+d) / (a+b+c+d);
        if (isNaN(sensitivity)) { sensitivity = 0; }
        if (isNaN(specificity)) { specificity = 0; }
        if (isNaN(ppv)) { ppv = 0; }
        if (isNaN(npv)) { npv = 0; }
        if (isNaN(accuracy)) { accuracy = 0; }
        $('#birads-sensitivity').text(sensitivity.toFixed(2));
        $('#birads-specificity').text(specificity.toFixed(2));
        $('#birads-ppv').text(ppv.toFixed(2));
        $('#birads-npv').text(npv.toFixed(2));
        $('#birads-accuracy').text(accuracy.toFixed(2));

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

    function filterCancerDefined(data) { return _.filter(data, function(e) { return e.cancer.match(/yes|no/); }); }
    function filterCancer(data) { return _.filter(data, function(e) { return e.cancer === 'yes'; }); }
    function filterNoCancer(data) { return _.filter(data, function(e) { return e.cancer === 'no'; }); }
    function filterDooleyGeThreshold(data, threshold) { return _.filter(data, function(e) { return e.total >= threshold; }); }
    function filterDooleyLtThreshold(data, threshold) { return _.filter(data, function(e) { return e.total < threshold; }); }
    function countByDooleyScore(data, score) { return _.filter(data, function(e) { return e.total == score; }).length; }
    function filterBIRADSGeThreshold(data, threshold) { return _.filter(data, function(e) { return e.birads >= threshold; }); }
    function filterBIRADSLtThreshold(data, threshold) { return _.filter(data, function(e) { return e.birads < threshold; }); }
    function countByBIRADS(data, score) { return _.filter(data, function(e) { return e.birads === score; }).length; }

    init();
    refresh();
});