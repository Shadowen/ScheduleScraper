// Acorn Schedule scraper v3.2

// TODO
// Alternate week labs (not sure how to choose which week)
// Automate import into Google Calendar
// http://www.undergrad.engineering.utoronto.ca/Office_of_the_Registrar/Timetables.htm

// Tries to load jQuery if it isn't loaded by appending a <script> tag.
// Waits until jQuery is successfully loaded and calls the provided callback.
function withJQuery(success) {
    if (typeof withJQuery.check == 'undefined') {
        withJQuery.check = function() {
            if (typeof $ == 'undefined' || typeof $.fn != 'object' || $.fn.jquery != '2.1.4') {
                console.log('jQuery not loaded yet.. sleeping 100 ms');
                setTimeout(withJQuery.check, 100);
            } else {
                console.log('JQuery-' + $.fn.jquery + ' successfully loaded!');
                if (typeof success == 'function') {
                    success();
                }
            }
        }
    }
    if (typeof $ == 'undefined' || typeof $.fn != 'object' || $.fn.jquery != '2.1.4') {
        var script = document.createElement("script");
        script.src = 'https://code.jquery.com/jquery-2.1.4.min.js';
        script.type = 'text/javascript';
        document.getElementsByTagName("head")[0].appendChild(script);
    }
    setTimeout(withJQuery.check, 100);
};

// Retrieves the session information from the current page
function getSession() {
    console.log('Getting session...');
    var session = $('div.session-info>span:contains("Session")').next().contents().filter(function() {
        return this.nodeType == 3;
    }).text().trim();
    console.log('Detected session "' + session + '"');
    return session;
}

function parseTimetable() {
    console.log('Parsing timetable...');

    function parseCourse(slotTag, dayNum, isPastNoon) {
        function formatTime(time, isPastNoon) {
            var timeSplit = time.split(':');
            var hour = parseInt(timeSplit[0]);
            if (isPastNoon) {
                hour += 12;
            }
            var hourString = ('0' + hour.toString()).slice(-2);
            var minuteString = timeSplit[1];
            return hourString + '' + minuteString;
        }

        var course = {};

        var slotLines = slotTag.html().split('<br>');

        course.code = slotTag.contents().eq(0).text().trim();
        course.day = dayNum;
        course.meeting = slotTag.contents(".meet").text();
        course.startTime = formatTime(slotTag.contents().eq(4).text().split("-")[0], isPastNoon);
        course.endTime = formatTime(slotTag.contents().eq(4).text().split("-")[1], isPastNoon);
        course.room = slotTag.contents(".room").text();
        course.isBiweekly = (slotTag.contents().eq(7).text() == '*');

        return course;
    }

    var schedule = [];
    var dayOffsets = [0, 0, 0, 0, 0];
    var isPastNoon = false;
    $('table.sched>tbody>tr').each(function(i, r) {
        var tdTags = $(this).children('td');
        var tagNum = 0;
        for (var dayNum = 0; dayNum <= 5; dayNum++) {
            // console.log(tagNum);
            // Calculate day of the week
            // If the slot is taken up by someone else, skip it
            if (dayOffsets[dayNum] > 0) {
                dayOffsets[dayNum]--;
                // console.log('offset skipped');
                continue;
            }

            var slotTag = tdTags.eq(tagNum++);
            // console.log(slotTag);

            // Skip empty classes
            if (slotTag.hasClass("time")) {
                // console.log("Time: " + slotTag.text());

                if (slotTag.text() == "12:00") {
                    isPastNoon = true;
                }
                // console.log('time skipped');
                continue;
            } else if (slotTag.hasClass("day") || slotTag.hasClass("hourEmpty") || slotTag.hasClass("empty")) {
                // console.log('empty skipped');
                continue;
            }
            schedule.push(parseCourse(slotTag, dayNum, isPastNoon));

            // Multi-row courses
            if (slotTag.attr('rowspan') != null) {
                dayOffsets[dayNum] = parseInt(slotTag.attr('rowspan')) - 1;
            }

            // Print out the schedule as we go
            // console.log(schedule[schedule.length-1].code);
        }
    });
    console.log('Timetable parsed!');
    return schedule;
}

function decorateWithTeachers(schedule, teachers) {
    console.log('Decorating courses with teachers...');
    for (var i = 0; i < schedule.length; i++) {
        var course = schedule[i];
        // The teachers array has no spaces in its keys
        // course.code and course.meeting must have all spaces removed to match
        var code = course.code.replace(/ /g, '');
        var meeting = course.meeting.replace(/ /g, '');
        course.teachers = teachers && teachers[code] && teachers[code][meeting] ? teachers[code][meeting] : [];
    }
    console.log('Teachers added!');
    return schedule;
}

function generateICS(schedule) {
    console.log('Generating .ics file...');

    function dayToString(day) {
        switch (day) {
            case 1:
                return 'MO';
            case 2:
                return 'TU';
            case 3:
                return 'WE';
            case 4:
                return 'TH';
            case 5:
                return 'FR';
            default:
                alert('Error parsing day: ' + day);
                return "ERR";
        }
    }

    function formatMeeting(meetingCode) {
        switch (meetingCode.split(' ')[0]) {
            case "LEC":
                return "Lecture";
            case "TUT":
                return "Tutorial";
            case "PRA":
                return "LAB"
            default:
                alert("Error parsing meeting code " + meetingCode);
                return "Error";
        }
    }

    function findStartDate() {
        return new Date(2015, 8, 10);
    }

    function calculateNextDay(startDate, dayOfWeek) {
        var date = new Date(startDate);
        while (date.getDay() != dayOfWeek) {
            date.setDate(date.getDate() + 1);
        }
        return date;
    }

    // Generate .ics
    var icsString;
    var today = new Date();
    var startDate = findStartDate();
    icsString = 'BEGIN:VCALENDAR\n';
    icsString += 'PRODID:Wesley Inc.\n';
    icsString += 'CALSCALE:GREGORIAN\n';
    icsString += 'METHOD:REQUEST\n';
    for (var c = 0; c < schedule.length; c++) {
        var course = schedule[c];
        var courseDate = calculateNextDay(startDate, course.day);
        var dateString = courseDate.getFullYear() + '' + ('0' + (courseDate.getMonth() + 1)).slice(-2) + '' + ('0' + courseDate.getDate()).slice(-2);
        icsString += 'BEGIN:VEVENT\n';
        icsString += 'DTSTART:' + dateString + 'T' + course.startTime + '00\n';
        icsString += 'DTEND:' + dateString + 'T' + course.endTime + '00\n';
        icsString += 'UID:' + (today.getTime() + c) + '@heungs.com\n';
        icsString += 'LOCATION:' + course.room + '\n';
        icsString += 'SUMMARY:' + course.code + ' ' + formatMeeting(course.meeting) + '\n';
        icsString += 'DESCRIPTION:' + course.code + ' ' + course.meeting + ' ' + course.teachers + '\n';
        icsString += 'RRULE:FREQ=WEEKLY;' + (course.isBiweekly ? 'INTERVAL=2;' : '') + 'BYDAY=' + dayToString(course.day) + ';COUNT=' + '16\n';
        icsString += 'END:VEVENT\n';
    }
    icsString += 'END:VCALENDAR\n';
    console.log('.ics file generated!');
    return icsString;
}

function createDownloadButton(icsString) {
    console.log('Creating download button...');

    // Create download link
    var textFileAsBlob = new Blob([icsString], {
        type: 'text/plain'
    });
    var fileNameToSaveAs = "scheduleScraper_export.ics";
    var downloadLink;
    if ((downloadLink = $('#download-link')).length == 0) {
        downloadLink = $(document.createElement('a'));
    }
    downloadLink.html("Download as .ics")
        .attr('id', 'download-link')
        .attr('download', fileNameToSaveAs)
        .attr('href', window.URL.createObjectURL(textFileAsBlob));
    // Copy the styling from the rest of the site.
    // Can't use classes because the app specifically serves css for each page
    downloadLink.css('color', '#fff')
        .css('font-weight', 400)
        .css('background', '#002a5c')
        .css('border-radius', '5px')
        .css('padding', '6px 12px')
        .css('width', 'auto')
        .css('font-size', '13px');
    downloadLink.hover(function() {
        $(this).css('background-color', '#003E8D');
        $(this).css('text-decoration', 'none');
    }, function() {
        $(this).css('background-color', '#002a5c');
    });
    // Insert in proper location
    $("table.sched").before(downloadLink);
    console.log('Download button created!');
    return downloadLink;
}

///////////
// Run on http://www.apsc.utoronto.ca/timetable/fall.html to retrieve the teachers of courses

// Get the page using https://github.com/limtaesu/alloworigin
var tryJSONRequest = function(url) {
    if (typeof tryJSONRequest.tries == 'undefined') {
        tryJSONRequest.tries = 0;
    }
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
                tryJSONRequest.tries++;
                if (tryJSONRequest.tries < 3) {
                    console.log('trying again... ' + tryJSONRequest.tries.toString());
                    deferred.notify('trying again...' + tryJSONRequest.tries.toString());
                    setTimeout(doJSON, 0);
                } else {
                    deferred.reject('Failed lots of times :(');
                }
            });
    };
    doJSON();
    return deferred.promise();
};

// Retrieve professor names from the page (DOM of http://www.apsc.utoronto.ca/timetable/)
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


//////////



// Main program
var docReadyPromise = (function() {
    console.log('Waiting for document to finish loading...');
    var deferred = $.Deferred();
    $(function() {
        deferred.resolve();
        console.log('Document loaded!');
    });
    return deferred.promise();
})();

withJQuery(function() {
    docReadyPromise.then(
        $.when(
            parseTimetable(),
            $.when(getSession())
            .then(function(session) {
                return tryJSONRequest('http://www.apsc.utoronto.ca/timetable/' + session.replace(/[0-9 ]/g, '').toLowerCase() + '.html');
            })
            .then(parseMasterTimetable)
        )
        .then(decorateWithTeachers)
        .then(generateICS)
        .then(createDownloadButton)
        .then(function(button) {
            button[0].click()
        })
    );
});
