// Acorn Schedule scraper v5.2

// TODO
// Automate import into Google Calendar

(function() {
    var getLoadingPage = function() {
        var deferred = $.Deferred();
        $('body').data('f57b7ad2ab284e388323484708a031f7', deferred)
        $.getScript('https://cdn.gitcdn.xyz/cdn/Shadowen/ScheduleScraper/master/LoadingPage.js');
        return deferred.promise();
    }

    // Retrieves the session information from the current page
    var getSession = function() {
        console.log('Getting session...');
        // RoSI || ACORN
        var session = ($('td.section>table>tbody>tr:contains("Session")>td') || $('div.session-info>span:contains("Session")'))
            .next()
            .contents()
            .filter(function() {
                return this.nodeType == 3;
            })
            .text()
            .replace(/(\n|\r| )/gm,"");
        console.log('Detected session "' + session + '"');
        return session;
    }

    var getTimestamp = function() {
        console.log('Getting timestamp...');
        var timestamp = $('td.section>p.note.skipprint').text().trim()
        console.log('Got timestamp!');
        return timestamp;
    }

    var parseTimetable = function(session) {
        console.log('Parsing timetable...');

        var parseCourse = function(slotTag, dayNum, isPastNoon) {
            var formatTime = function(times, isPastNoon) {
                var startTimeSplit = times[0].split(':');
                var endTimeSplit = times[1].split(':');
                var startHour = parseInt(startTimeSplit[0]);
                var endHour = parseInt(endTimeSplit[0])
                if (isPastNoon) {
                    startHour += 12;
                    endHour += 12;
                } else if (startHour >= endHour) {
                    endHour += 12;
                }
                var startString = ('0' + startHour.toString()).slice(-2) + startTimeSplit[1];
                var endString = ('0' + endHour.toString()).slice(-2) + endTimeSplit[1];
                return [startString, endString];
            }

            var course = {};
            var slotLines = slotTag.html().split('<br>').map(function(t) {
                return t.trim();
            });
            course.code = slotTag.contents().eq(0).text().trim();
            course.session = course.code.slice(-1);
            // TODO { Retrieve the actual course start dates
            if (session.indexOf('Fall') != -1 && (course.session == 'F' || course.session == 'Y')) {
                course.startDate = new Date(2015, 09, 14);
            } else if (course.indexOf('Winter') != -1 && (course.session == 'S' || course.session == 'Y')) {
                course.startDate = new Date(2015, 01, 11);
            } else {
                console.error('Session code \'' + course.session + '\' not recognized');
            }
            // }
            course.day = dayNum;
            course.meeting = slotTag.contents(".meet").text();
            var times = formatTime(slotLines[2].split("-"), isPastNoon);
            course.startTime = times[0];
            course.endTime = times[1];
            course.room = slotTag.contents(".room").text();
            course.isBiweekly = (slotTag.text().indexOf('*') != -1);

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
        console.log('Timetable parsed! ' + schedule.length + ' timeslots detected.');
        return schedule;
    }

    var getMasterTimetable = function(session) {
        console.log('Requesting master timetable for ' + session + '...');
        var deferred = $.Deferred();
        var successCallback = function(response, reason, obj) {
            var numCourses = 0;
            for (var key in response) {
                numCourses++;
            }
            console.log('Master timetable found! ' + numCourses + ' courses retrieved.');
            deferred.resolve(response);
        };
        $.ajax({
            dataType: "jsonp",
            url: "https://cdn.gitcdn.xyz/cdn/Shadowen/ScheduleScraper/master/timetable-fall.js",
            jsonpCallback: 'c311745ae7ee4925b17eb440fd06a31d',
            success: successCallback
        });
        return deferred.promise();
    }

    var decorateWithExtra = function(schedule, master) {
        console.log("Starting decorations...");
        for (var i = 0; i < schedule.length; i++) {
            var course = schedule[i];
            var code = course.code.replace(/[ ]/g, '');
            var section = course.meeting.replace(/[ ]/g, '');
            var day = course.day;
            var startTime = course.startTime;
            var endTime = course.endTime;
            var room = course.room.replace(/[ ]/g, '');
            // TODO{ temporary fix for courses with multiple locations
            var index = room.indexOf('/');
            if (index > 0) {
                room = room.slice(0, index);
            }
            // }TODO
            // TODO{ Replace master[0] with the appropriate course date (especially Y courses)
            if (master[code] && master[code][section] && master[code][section][day + startTime + endTime + room]) {
                course.startDate = new Date(master[code][section][day + startTime + endTime + room][0].startDate);
                course.professors = master[code][section][day + startTime + endTime + room][0].professors;
                course.notes = master[code][section][day + startTime + endTime + room][0].notes;
                // }TODO
            } else {
                console.error("Course start date not found for:");
                console.log(master);
                console.log(course);
            }
        }
        console.log("Decorations successful!");
        return schedule;
    }

    var generateICS = function(schedule) {
        console.log('Generating .ics file...');

        var calculateNextDay = function(startDate, dayOfWeek) {
            var date = new Date(startDate);
            while (date.getDay() != dayOfWeek) {
                date.setDate(date.getDate() + 1);
            }
            return date;
        }

        var dayToString = function(day) {
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

        var formatMeeting = function(meetingCode) {
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
            var dateString = course.startDate.getFullYear().toString() +
                ('0' + (course.startDate.getMonth() + 1)).slice(-2).toString() +
                ('0' + calculateNextDay(course.startDate, course.day).getDate()).slice(-2);
            icsString += 'BEGIN:VEVENT\n';
            icsString += 'DTSTART:' + dateString + 'T' + course.startTime + '00\n';
            icsString += 'DTEND:' + dateString + 'T' + course.endTime + '00\n';
            icsString += 'UID:' + (today.getTime() + c) + '@heungs.com\n';
            icsString += 'LOCATION:' + course.room + '\n';
            icsString += 'SUMMARY:' + course.code + ' ' + formatMeeting(course.meeting) + '\n';
            icsString += 'DESCRIPTION:Course code:' + course.code + '\\nSection: ' + course.meeting + '\\n';
            if (course.professors.length > 0) {
                icsString += 'Professors: ' + course.professors.reduce(function(prev, cur, index) {
                    return prev + (index == 0 ? '' : ', ') + cur.first + ' ' + cur.last;
                }, '') + '\\n';
            }
            if (course.notes) {
                icsString += 'Additional Notes: ' + course.notes;
            }
            icsString += '\n';
            // TODO { Actually end the course when classes end
            icsString += 'RRULE:FREQ=WEEKLY;' + (course.isBiweekly ? 'INTERVAL=2;' : '') + 'BYDAY=' + dayToString(course.day) + ';COUNT=' + (course.isBiweekly ? '7' : '14') + '\n';
            // } TODO
            icsString += 'END:VEVENT\n';
        }
        icsString += 'END:VCALENDAR\n';
        console.log('.ics file generated!');
        return icsString;
    }

    var createDownloadButton = function(icsString) {
        console.log('Creating download button...');

        // Create download link
        var textFileAsBlob = new Blob([icsString], {
            type: 'text/plain'
        });
        var fileNameToSaveAs = "scheduleScraper_export.ics";
        var downloadLink = $('#download-link');
        if (downloadLink.length == 0) {
            downloadLink = $(document.createElement('a'));
        }
        downloadLink.html("Download as .ics")
            .attr('id', 'download-link')
            .attr('download', fileNameToSaveAs)
            .attr('href', window.URL.createObjectURL(textFileAsBlob))
            // Copy the styling from the rest of the site.
            // Can't use classes because the app specifically serves css for each page
            .css('color', '#fff')
            .css('font-weight', 400)
            .css('background', '#002a5c')
            .css('border-radius', '5px')
            .css('padding', '6px 12px')
            .css('width', 'auto')
            .css('font-size', '13px')
            .hover(function() {
                $(this).css('background-color', '#003E8D');
                $(this).css('text-decoration', 'none');
            }, function() {
                $(this).css('background-color', '#002a5c');
            })
            // Insert in proper location
            .insertBefore('table.sched');
        console.log('Download button created!');
        return downloadLink;
    }

    ////////// Main program
    console.log("Script started...");
    // Actual things
    var run = function() {
        // Make a promise
        $.when(
                // Loading screen
                getLoadingPage()
                .then(function() {
                    console.log('Loading page complete!');
                }),
                // Other
                $.when(getSession())
                .then(function(session) {
                    return $.when(parseTimetable(session), getMasterTimetable(session));
                })
                .then(decorateWithExtra)
                // Generate the .ics
                .then(generateICS)
                // Create a download button
                .then(createDownloadButton)
            )
            // Programatically click the button to start the download
            .then(function(loadingPage, button) {
                console.log('done!');
                console.log(loadingPage);
                console.log(button);
                button[0].click()
            });
    };

    // Detect the page
    var rosiURL = 'https://sws.rosi.utoronto.ca/sws/timetable/scheduleView.do';
    var acornURL = 'https://acorn.utoronto.ca/sws/timetable.scheduleView.do#/';
    // RoSI
    if (location.href.indexOf(rosiURL) != -1) {
        console.log('RoSI detected.');
        // Load jQuery
        var uid = "__9384nalksdfalkj04320";
        //create onload-callback function
        window[uid] = function() {
            console.log("jQuery-" + jQuery.fn.jquery + " loaded!");
            run();
        };
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("onload", uid + "();"); //register onload-callback listener function
        script.setAttribute("src", "//code.jquery.com/jquery-2.1.4.min.js");
        document.head.appendChild(script);
    } else if (location.href.indexOf(acornURL) != -1) {
        console.log('ACORN detected');
        // Run immediately if page is loaded, else wait for the page to load
        document.readyState == 'complete' ? run() : window.onload = run;
    } else {
        if (window.confirm("Please run this script on the page where you can see your timetable!\n" +
                "I can 't hack into your ACORN account to grab your schedule for you...\n" +
                "Click OK to go there now.\n Click Cancel to stay here.")) {
            window.location.href = acornURL;
        } else {
            console.log("Script not run.")
        }
    }
})();
