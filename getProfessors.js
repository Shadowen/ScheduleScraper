// Run on http://www.apsc.utoronto.ca/timetable/fall.html to retrieve the teachers of courses

// Get the page
// http://www.whateverorigin.org/
// https://github.com/limtaesu/alloworigin
// http://anyorigin.com/
var tries = 0;
var tryJSONRequest = function(url) {
    console.log('Attempting to retrieve contents of //whateverorigin.org/get?url=' + encodeURIComponent(url) + '...');
    var deferred = $.Deferred();
    var doJSON = function() {
        $.getJSON('//alloworigin.com/get?url=' + encodeURIComponent(url))
            .success(function(response, b, c) {
                console.log('Successfully loaded page!');
                deferred.resolve($.parseHTML(response.contents));
            })
            .error(function(a, b, c) {
                console.error("Error retrieving page! (" + b + ')');
                tries++;
                if (tries < 3) {
                    console.log('trying again... ' + tries.toString());
                    deferred.notify('trying again...' + tries.toString());
                    setTimeout(doJSON, 0);
                } else {
                    deferred.reject('Failed lots of times :(');
                }
            });
    };
    doJSON();
    return deferred.promise();
};

// Retrieve professor names from the page (DOM of http%3A%2F%2Fwww.apsc.utoronto.ca%2Ftimetable%2Ffall.html)
var parseMasterTimetable = function(page) {
    console.log('Parsing master timetable...');
    var teachers = {};
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
    console.log('Timetable parsed!');
    return teachers;
};
