///////////
// Run on http://www.apsc.utoronto.ca/timetable/fall.html to retrieve the "master" timetable

// http://stackoverflow.com/questions/2813647/how-do-i-perform-a-callback-on-jquery-once-its-loaded
var withJQuery = function(success) {
    if (typeof(jQuery) == "undefined") {
        var uid = "__9384nalksdfalkj04320";
        //create onload-callback function
        window[uid] = function() {
            console.log("jQuery-" + jQuery.fn.jquery + " loaded!");
            if (typeof success == 'function') {
                success(jQuery);
            }
        };

        //load jQuery asynchronously
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("onload", uid + "();"); //register onload-callback listener function
        script.setAttribute("src", "//code.jquery.com/jquery-latest.min.js");
        document.head.appendChild(script);
    } else {
        console.log('jQuery-' + jQuery.fn.jquery + ' was already loaded.');
        if (typeof success == 'function') {
            success(jQuery);
        }
    }
};

withJQuery(function($) {
    var parseMasterTimetable = function() {
        console.log('Parsing master timetable...');
        // Check if the two arrays have the same names in them
        var containsSameNames = function(a, b) {
            if (a.length != b.length) {
                return false;
            }
            for (var i = 0; i < a.length; i++) {
                for (var j = 0;; j++) {
                    if (j >= b.length) {
                        return false;
                    }
                    if (a[i].first == b[j].first && a[i].last == b[j].last) {
                        break;
                    }
                }
            }
            return true;
        };
        // Converts three letter day abbreviations to JavaScript Date numbers
        var dayStrToNum = function(word) {
            switch (word) {
                case "Mon":
                    return '1';
                case "Tue":
                    return '2';
                case "Wed":
                    return '3';
                case "Thu":
                    return '4';
                case "Fri":
                    return '5';
                default:
                    console.error("Failed to convert day " + word + "to number.");
            }
        }

        var master = {};
        $('a > table').not(':contains("Course Prefixes")').each(function() {
            // 3 Letter course prefix (ie. AER)
            var prefix = $(this).children('caption').text();
            var tbody = $(this).children('tbody');
            tbody.children('tr:not(:has(th))').each(function() {
                var tr = $(this);
                var tds = tr.children();
                // Start parsing!
                var code = tds.eq(0).text();
                var section = tds.eq(1).text();
                var startDate = tds.eq(2).text();
                var day = dayStrToNum(tds.eq(3).text());
                var startTime = tds.eq(4).text().replace(/[:]/g, '');
                var finishTime = tds.eq(5).text().replace(/[:]/g, '');
                var location = tds.eq(6).text();
                // An array of the professors teaching the course
                var professors = $.map($.grep(tds.eq(7).text().split(" and "), function(e) {
                    return /\S/.test(e);
                }), function(name) {
                    var splitName = name.split(',');
                    return {
                        first: splitName[1].trim(),
                        last: splitName[0].trim()
                    }
                });
                var notes = tds.eq(8).text();

                master[code] = master[code] || {};
                master[code][section] = master[code][section] || {};
                master[code][section][day + startTime + finishTime + location] = master[code][section][day + startTime + finishTime + location] || [];
                master[code][section][day + startTime + finishTime + location].push({
                    startDate: startDate,
                    professors: professors,
                    notes: notes
                });
            });
        });
        console.log('Timetable parsed!');
        return master;
    };

    var toJSONP = function(string){
    	return "c311745ae7ee4925b17eb440fd06a31d(" + string + ")";
    }

    var downloadString = function(string) {
        console.log('Creating download...');
        $(document.createElement('a'))
            .css('display', 'none')
            .attr('download', location.pathname.slice(1).replace(/[\/]/g, '-').replace('.html', '') + ".js")
            .attr('href', window.URL.createObjectURL(
                new Blob([string], {
                    type: 'text/plain'
                })))[0].click();
        console.log('Download complete!');
    }

    ///// Main program
    $.when(parseMasterTimetable())
        .then(function(master) {
            console.log(master);
            return master;
        })
        .then(JSON.stringify)
        .then(toJSONP)
        .then(downloadString);
});
