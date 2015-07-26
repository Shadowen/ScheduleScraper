// Acorn Schedule scraper v3.2

// TODO
// Alternate week labs (not sure how to choose which week)
// Automate import into Google Calendar
// http://www.undergrad.engineering.utoronto.ca/Office_of_the_Registrar/Timetables.htm

(function() {
    // Retrieves the session information from the current page
    var getSession = function() {
        console.log('Getting session...');
        var session = $('div.session-info>span:contains("Session")').next().contents().filter(function() {
            return this.nodeType == 3;
        }).text().trim();
        console.log('Detected session "' + session + '"');
        return session;
    }

    var getTimestamp = function(){
    	console.log('Getting timestamp...');
    	var timetsmp = $('td.section>p.note.skipprint').text().trim()
    	console.log('Got timestamp!');
    	return timestamp;
    }

    var parseTimetable = function() {
        console.log('Parsing timetable...');

        var parseCourse = function(slotTag, dayNum, isPastNoon) {
            var formatTime = function(time, isPastNoon) {
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

        // A list of courses detected
        var schedule = [];
        // Keeps track of how many multi-row courses are eating up columns invisibly
        var dayOffsets = [0, 0, 0, 0, 0];
        var isPastNoon = false;
        $('table.sched>tbody>tr').each(function(i, r) {
            var tdTags = $(this).children('td');
            var tagNum = 0;
            for (var dayNum = 0; dayNum <= 5; dayNum++) {
                // Calculate day of the week
                // If the slot is taken up by a multi-row course from before, skip it
                if (dayOffsets[dayNum] > 0) {
                    dayOffsets[dayNum]--;
                    continue;
                }

                var slotTag = tdTags.eq(tagNum++);

                // Skip empty classes
                if (slotTag.hasClass("time")) {
                    // Detect when we cross noon
                    if (slotTag.text() == "1:00") {
                        isPastNoon = true;
                    }
                    continue;
                } else if (slotTag.hasClass("day") || slotTag.hasClass("hourEmpty") || slotTag.hasClass("empty")) {
                    continue;
                }
                // Parse valid course slots
                schedule.push(parseCourse(slotTag, dayNum, isPastNoon));
                // Multi-row courses
                if (slotTag.attr('rowspan') != null) {
                    dayOffsets[dayNum] = parseInt(slotTag.attr('rowspan')) - 1;
                }
            }
        });
        console.log('Timetable parsed!');
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
                    console.error('Error parsing day: ' + day);
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
                    console.error("Error parsing meeting code " + meetingCode);
                    return "Error";
            }
        }

        // Generate .ics
        var icsString;
        var today = new Date();
        icsString = 'BEGIN:VCALENDAR\n';
        icsString += 'PRODID:Wesley Inc.\n';
        icsString += 'CALSCALE:GREGORIAN\n';
        icsString += 'METHOD:REQUEST\n';
        for (var c = 0; c < schedule.length; c++) {
            var course = schedule[c];
            var courseDate = new Date('09/10/2015');
            var dateString = courseDate.getFullYear() + '' + ('0' + (courseDate.getMonth() + 1)).slice(-2) + '' + ('0' + courseDate.getDate()).slice(-2);
            icsString += 'BEGIN:VEVENT\n';
            icsString += 'DTSTART:' + dateString + 'T' + course.startTime + '00\n';
            icsString += 'DTEND:' + dateString + 'T' + course.endTime + '00\n';
            icsString += 'UID:' + (today.getTime() + c) + '@heungs.com\n';
            icsString += 'LOCATION:' + course.room + '\n';
            icsString += 'SUMMARY:' + course.code + ' ' + formatMeeting(course.meeting) + '\n';
            icsString += 'DESCRIPTION:' + course.code + '\\n' + course.meeting + '\\n' + course.teachers + '\n';
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

    ////////// Main program
    var correctURL = "https://acorn.utoronto.ca/sws/timetable/scheduleView.do#/";
    if (window.location.href == correctURL) {
        console.log("Script starting...");
        // Make a promise
        $.when(// (1) Parse the current page
                parseTimetable()
            )
            // Generate the .ics
            .then(generateICS)
            // Create a download button
            .then(createDownloadButton)
            // Programatically click the button to start the download
            .then(function(button) {
                button[0].click()
            });
    } else {
        if (window.confirm("Please run this script on " + correctURL + "\nI can't hack into your ACORN account to grab your schedule for you...\nClick OK to go there now.\nClick Cancel to stay here.")) {
            window.location.href = correctURL;
        } else {
            console.log("Script not run.")
        }
    }
})();
