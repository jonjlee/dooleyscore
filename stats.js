$(function() {
    function init() {
        // Add dataset button for each dataset
        var $datasets = $('#datasets'),
            avail = ['Nipple Discharge', 'Breast Pain']; //Object.keys(data).sort();
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

        // Update outcomes table
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

        // Update calculations
        var sensitivity = a / (a+c),
            specificity = d / (b+d),
            ppv = a / (a+b),
            npv = d / (d+c),
            accuracy = (a+d) / (a+b+c+d);
        if (isNaN(ppv)) { ppv = 0; }
        if (isNaN(npv)) { npv = 0; }
        $('#n').text(activedata.length);
        $('#sensitivity').text(sensitivity.toFixed(2));
        $('#specificity').text(specificity.toFixed(2));
        $('#ppv').text(ppv.toFixed(2));
        $('#npv').text(npv.toFixed(2));
        $('#accuracy').text(accuracy.toFixed(2));

        // Update graphs
        drawGraph($('.graph')[0], start);
        drawGraph($('.graph')[1], start);
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

    var container = $('#graph1')[0],
        start = (new Date).getTime(),
        dd, graph, offset, i;

    // Draw a sine curve at time t
    function drawGraph(container, t) {
        var dd = [];
        offset = 2 * Math.PI * (t - start) / 10000;

        // Sample the sine function
        for (i = 0; i < 4 * Math.PI; i += 0.2) {
        dd.push([i, Math.sin(i - offset)]);
        }

        // Draw Graph
        graph = Flotr.draw(container, [ dd ], {
            yaxis : {
              max : 2,
              min : -2
            }
        });
    }

    init();
    refresh();
});