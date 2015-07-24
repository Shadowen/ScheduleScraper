// Acorn Schedule scraper v3

// TODO
// Write bookmarklet script
// Retrieve school start date from http://www.apsc.utoronto.ca/Calendars/2013-2014/Sessional_Dates.html
// Alternate week labs (not sure how to choose which week)
// Automate import into Google Calendar
// http://www.undergrad.engineering.utoronto.ca/Office_of_the_Registrar/Timetables.htm
// http://wiki.greasespot.net/GM_xmlhttpRequest

(function($) {
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

    function parseCourse(slotTag, dayNum, isPastNoon) {
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

    (function() {
        // Load the script
        var script = document.createElement("script");
        script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js';
        script.type = 'text/javascript';
        document.getElementsByTagName("head")[0].appendChild(script);
    })();
    $('body').prepend($('<iframe></iframe>').attr('id', 'timetable').css('display', 'none').attr('src', 'https://www.apsc.utoronto.ca/timetable/fall.html'));
    // Retrieve professor names
    $('a>table').not(':contains("Course Prefixes")').slice(0, 3).each(function(t) {
        var prefix = $(this).children('caption').text(); // 3 Letter course prefix (ie. AER)
        // console.log(prefix);
        var tbody = $(this).children('tbody');
        // console.log(tbody.children('tr:not(:has(th))');
        tbody.children('tr:not(:has(th))').each(function(r) {
            var tr = $(r);
            console.log(r);
            return false;
        });
    });

    var session = $('div.session-info>span:contains("Session")').next().contents().filter(function() {
        return this.nodeType == 3;
    })[0].nodeValue.trim();

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
        icsString += 'DESCRIPTION:' + course.code + ' ' + course.meeting + '\n';
        icsString += 'RRULE:FREQ=WEEKLY;' + (course.isBiweekly ? 'INTERVAL=2;' : '') + 'BYDAY=' + dayToString(course.day) + ';COUNT=' + '16\n';
        icsString += 'END:VEVENT\n';
    }
    icsString += 'END:VCALENDAR\n';

    // Create download link
    var textFileAsBlob = new Blob([icsString], {
        type: 'text/plain'
    });
    var fileNameToSaveAs = "scheduleScraper_export.ics";
    var downloadLink;
    if ((downloadLink = $('#download-link')).length == 0) {
        downloadLink = $(document.createElement('a'));
    }
    downloadLink.attr('id', 'download-link');
    downloadLink.attr('download', fileNameToSaveAs);
    downloadLink.html("Download as .ics");
    downloadLink.attr('href', window.URL.createObjectURL(textFileAsBlob));
    // Copy the styling from the rest of the site.
    // Can't use classes because the app specifically serves css for each page
    downloadLink.css('color', '#fff');
    downloadLink.css('font-weight', 400);
    downloadLink.css('background', '#002a5c');
    downloadLink.css('border-radius', '5px');
    downloadLink.css('padding', '6px 12px');
    downloadLink.css('width', 'auto');
    downloadLink.css('font-size', '13px');
    downloadLink.hover(function() {
        $(this).css('background-color', '#003E8D');
        $(this).css('text-decoration', 'none');
    }, function() {
        $(this).css('background-color', '#002a5c');
    });
    // Insert in proper location
    $("table.sched").before(downloadLink);
    // Auto download
    downloadLink[0].click();
})(jQuery);
