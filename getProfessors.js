// Run on http://www.apsc.utoronto.ca/timetable/fall.html to retrieve the teachers of courses
// Load jQuery
(function() {
    var script = document.createElement("script");
    script.src = 'https://code.jquery.com/jquery-2.1.4.min.js';
    script.type = 'text/javascript';
    document.getElementsByTagName("head")[0].appendChild(script);
})();
// Get the page
// http://www.whateverorigin.org/
// https://github.com/limtaesu/alloworigin
// http://anyorigin.com/
var tries = 0;

var tryJSON = function() {
    console.log('Attempting to retrieve timetable...');
    $.getJSON('//alloworigin.com/get?url=http%3A%2F%2Fwww.apsc.utoronto.ca%2Ftimetable%2Ffall.html').success(function(response, b, c) {
        console.log('Successfully retrieved timetable!');
        var page = $.parseHTML(response.contents);
        parsePage(page);
    }).error(function(a, b, c) {
        console.error("Error retrieving page! " + b);
        tries++;
        if (tries < 5) {
            console.log('trying again... ' + tries.toString());
            setTimeout(tryJSON, 1000);
        }
    });
};

tryJSON();


// Retrieve professor names
var teachers = {};
function parsePage(page) {
    $(page).find('a > table').not(':contains("Course Prefixes")').each(function() {
        var prefix = $(this).children('caption').text(); // 3 Letter course prefix (ie. AER)
        // console.log(prefix);
        var tbody = $(this).children('tbody');
        // console.log(tbody.children('tr:not(:has(th))');
        tbody.children('tr:not(:has(th))').each(function() {
            var tr = $(this);
            var tds = tr.children();
            // console.log(this);
            var name = tds.eq(0).text();
            var section = tds.eq(1).text();
            var startDate = tds.eq(2).text();
            var day = tds.eq(3).text();
            var start = tds.eq(4).text();
            var finish = tds.eq(5).text();
            var location = tds.eq(6).text();
            var professors = $.each($.grep(tds.eq(7).text().split(" and "), function(e) {
                return /\S/.test(e);
            }), function(index, name) {
                var splitName = name.split(',');
                // console.log(splitName);
                return {
                    first: splitName[1].trim(),
                    last: splitName[0].trim()
                }
            });
            var schedulingNotes = tds.eq(8).text();

            // Check if the two arrays have the same names in them
            var containsSameNames = function(a, b) {
                if (a.length != b.length) {
                    return false;
                }
                for (var i = 0; i < a.length; i++) {
                    var flag = false;
                    for (var j = 0; j < b.length; j++) {
                        if (a[i].first == b[j].first && a[i].last == b[j].last) {
                            flag = true;
                            break;
                        }
                    }
                    if (!flag) {
                        return false;
                    }
                }
                return true;
            };

            teachers[name] = teachers[name] || {};
            if (teachers[name][section] && teachers[name][section].length > 0) {
                if (professors.length > 0 && !containsSameNames(teachers[name][section], professors)) {
                    console.error("Different teachers found for " + name + ' ' + section);
                    console.log(teachers[name][section]);
                    console.log(professors);
                }
                // console.log('Ignored empty professors cell');
            } else {
                teachers[name][section] = professors;
            }
            // console.log(name + ' ' + section);
        });
    });
};
