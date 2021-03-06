(function() {
    var getLoadingPage = function() {
        var deferred = jQuery.Deferred();
        jQuery('body').data('f57b7ad2ab284e388323484708a031f7', deferred)
        jQuery.ajax('https://raw.githack.com/Shadowen/ScheduleScraper/master/LoadingPage.js', {
            success: function() {
                console.log("Loading page retrieved.")
            },
            error: function() {
                console.log("Loading page failed thrown");
                deferred.reject("Ajax error while trying to find loading page.");
            }
        });
        return deferred.promise();
    }

    // Retrieves the session information from the current page
    var getSession = function() {
        console.log('Getting session...');
        var session = jQuery('div.session-info>span:contains("Session")')
            .next()
            .contents()
            .filter(function() {
                return this.nodeType == 3;
            })
            .text()
            // A very aggressive .trim() function
            .replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '')
        console.log('Detected session "' + session + '"');
        return session;
    }

    var getTimestamp = function() {
        console.log('Getting timestamp...');
        var timestamp = jQuery('td.section>p.note.skipprint').text().trim()
        console.log('Got timestamp! "' + timestamp + '"');
        return timestamp;
    }

    var parseTimetable = function(session) {
        console.log('Parsing timetable...');

        var parseCourse = function(meetingInfo, dayNum, isPastNoon) {
            var formatTime = function(times, isPastNoon) {
                timeSplit = times.split('-');
                var startTimeSplit = timeSplit[0].split(':');
                var endTimeSplit = timeSplit[1].split(':');
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
            course.name = meetingInfo.find('.courseCodeInfo').attr('title');
            course.code = meetingInfo.find('.courseCodeInfo').text().trim();
            if (course.code.slice(-1) == '*') {
                course.isBiweekly = true;
                course.code = course.code.slice(0, -2);
            } else {
                course.isBiweekly = false;
            }
            course.session = course.code.slice(-1);
            var year = session.split(" ")[0];
            if (session.indexOf("Fall") != -1 && (course.session == 'F' || course.session == 'Y')) {
                course.startDate = new Date(year, 8, 1);
            } else if (session.indexOf("Winter") != -1 && (course.session == 'S' || course.session == 'Y')) {
                course.startDate = new Date(year, 0, 1);
            } else {
                console.error('Session code \'' + course.session + '\' not recognized for \'' + course.code + '\'');
            }
            course.day = dayNum;
            course.meeting = meetingInfo.contents(".courseSection").text();
            var times = formatTime(meetingInfo.children('.meetInfo').text(), isPastNoon);
            course.startTime = times[0];
            course.endTime = times[1];
            course.room = meetingInfo.children(".roomInfo").text();

            return course;
        }

        // A list of courses detected
        var schedule = [];
        // Total number of columns in the table
        var numColumns = 0;
        // Keeps track of how many multi-column days are eating up columns invisibly
        // Each element represents the column on which each day starts
        var dayColumnStart = [0];
        // Keeps track of how many multi-row courses are eating up rows invisibly
        var colOffsets = [];
        var isPastNoon = false;
        jQuery('table.timetableSchedule>tbody>tr').each(function(i, r) {
            // The first row (header with day-of-week info)
            if (i == 0) {
                jQuery(this).children('th').each(function(i, r) {
                    var prevColumnStart = dayColumnStart[i];
                    var thisColumnSpan = +(jQuery(this).attr('colspan') || 1);
                    numColumns += thisColumnSpan;
                    dayColumnStart.push(prevColumnStart + thisColumnSpan);
                    colOffsets.push(0);
                });
                return true;
            }
            var tdTags = jQuery(this).contents().filter(function() {
                // http://stackoverflow.com/questions/1623734/selecting-html-comments-with-jquery
                return this.nodeType == 1 || this.nodeType == 8;
            });
            var dayNum = -1;
            for (var columnNum = 0;; columnNum++) {
                // If the column is a new day
                if (dayColumnStart.indexOf(columnNum) != -1) {
                    dayNum++;
                    // End of a week
                    if (dayNum > 5) {
                        break;
                    }
                }
                var slotTag = tdTags.eq(columnNum);
                // If the slot is taken up by a multi-row course from before, skip it
                if (colOffsets[columnNum] > 0) {
                    colOffsets[columnNum]--;
                    continue;
                } else if (slotTag.is(function() {
                        return this.nodeType == 8;
                    })) {
                    colOffsets[columnNum]--;
                    continue;
                }
                // Skip empty classes
                if (slotTag.hasClass("timeOfDay")) {
                    // Detect when we cross noon
                    if (slotTag.text() == "1:00") {
                        isPastNoon = true;
                    }
                    continue;
                } else if (slotTag.hasClass("emptySlot")) {
                    continue;
                }
                // Parse valid course slots
                var meetingInfo = slotTag.children('.meetingInfo');
                schedule.push(parseCourse(meetingInfo, dayNum, isPastNoon));
                // Multi-row courses
                if (typeof(slotTag.attr('rowspan')) != undefined) {
                    // Wide courses, fill up the rectangle
                    var rowSpan = +(parseInt(slotTag.attr('rowspan')) || 1);
                    for (var c = 0; c < +(slotTag.attr('colspan') || 1); c++) {
                        colOffsets[columnNum + c] = rowSpan;
                    }
                    colOffsets[columnNum] -= 1;
                }
            }
        });
        console.log('Timetable parsed! ' + schedule.length + ' timeslots detected.');
        return schedule;
    }

    var getMasterTimetable = function(session) {
        console.log('Requesting master timetable for ' + session + '...');
        var deferred = jQuery.Deferred();
        var successCallback = function(response, reason, obj) {
            var numCourses = 0;
            for (var key in response) {
                numCourses++;
            }
            console.log('Master timetable found! ' + numCourses + ' courses retrieved.');
            deferred.resolve(response);
        };
        var errorCallback = function(jqXHR, textStatus, errorThrown) {
            deferred.reject(textStatus, errorThrown);
        }
        var url;
        if (session.indexOf('Fall') != -1) {
            url = 'https://raw.githack.com/Shadowen/ScheduleScraper/master/timetable-fall.js';
        } else if (session.indexOf('Winter') != -1) {
            url = 'https://raw.githack.com/Shadowen/ScheduleScraper/master/timetable-winter.js';
        } else {
            console.log("Invalid session code thrown!");
            deferred.reject("Invalid session code!");
        }
        jQuery.ajax({
            dataType: "jsonp",
            url: url,
            jsonpCallback: 'c311745ae7ee4925b17eb440fd06a31d',
            success: successCallback,
            error: errorCallback
        });
        return deferred.promise();
    }

    var decorateWithExtra = function(schedule, master) {
        var deferred = jQuery.Deferred();
        console.log("Starting decorations...");
        for (var i = 0; i < schedule.length; i++) {
            // Extract some information and format it the way it is done in the master timetable
            var course = schedule[i];
            var code = course.code.replace(/[ ]/g, '');
            var section = course.meeting.replace(/[ ]/g, '');
            var day = course.day;
            var startTime = course.startTime;
            var endTime = course.endTime;
            var rooms = course.room.replace(/[ ]/g, '').split('/');

            var courseFound = false;
            // Try all the rooms it could be stored under
            for (var r = 0; r < rooms.length; r++) {
                var room = rooms[r];
                if (master[code] && master[code][section] && master[code][section][day + startTime + endTime + room]) {
                    courseFound = true;
                    course.startDate = new Date(master[code][section][day + startTime + endTime + room][0].startDate);
                    course.professors = master[code][section][day + startTime + endTime + room][0].professors;
                    course.notes = master[code][section][day + startTime + endTime + room][0].notes;
                }
            }
            // The course was not found in the master timetable
            if (!courseFound) {
                console.log("Course " + code + ":" + section + "@" + (day + startTime + endTime + room) + " not found in master timetable.")
                course.professors = [];
                course.notes = "";
            }
        }
        deferred.resolve(schedule);

        console.log("Decorations successful!");
        return deferred.promise();
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
                    return "Lab"
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
        icsString += 'METHOD:PUBLISH\n';
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
            icsString += 'SUMMARY:' + (course.name || course.code) + ' ' + formatMeeting(course.meeting) + '\n';
            icsString += 'DESCRIPTION:Course code: ' + course.code + '\\nSection: ' + course.meeting + '\\n';
            if (course.professors) {
                icsString += 'Professors: ' + course.professors.reduce(function(prev, cur, index) {
                    return prev + (index == 0 ? '' : ', ') + cur.first + ' ' + cur.last;
                }, '') + '\\n';
            }
            if (course.notes) {
                icsString += 'Additional Notes: ' + course.notes;
            }
            icsString += '\n';
            icsString += 'RRULE:FREQ=WEEKLY;' + (course.isBiweekly ? 'INTERVAL=2;' : '') + 'BYDAY=' + dayToString(course.day) + ';COUNT=' + (course.isBiweekly ? '7' : '14') + '\n';
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
        var downloadLink = jQuery('#download-link');
        if (downloadLink.length == 0) {
            downloadLink = jQuery(document.createElement('a'));
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
            .css('margin', '')
            .css('width', 'auto')
            .css('font-size', '13px')
            .css('text-decoration', 'none')
            .hover(function() {
                jQuery(this).css('background-color', '#003E8D');
                // jQuery(this).css('text-decoration', 'none');
            }, function() {
                jQuery(this).css('background-color', '#002a5c');
            })
            // Insert in proper location
            .insertBefore('table.timetableSchedule');
        console.log('Download button created!');
        return downloadLink;
    }

    ////////// Main program
    console.log("Script started...");
    // Actual things
    var run = function() {
        jQuery.noConflict();
        console.log('jQuery ' + jQuery.fn.jquery + ' loaded.');
        // Make a promise
        jQuery.when(
                // Loading screen
                getLoadingPage()
                .then(function() {
                    console.log('Loading page complete!');
                }),
                // Other
                jQuery.when(getSession())
                .then(function(session) {
                    return jQuery.when(parseTimetable(session), getMasterTimetable(session));
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
                button[0].click()
            });
    };

    // Detect the page
    var acornURL = 'https://acorn.utoronto.ca/sws/timetable/main.do?main.dispatch#/calendar';
    if (location.href.indexOf(acornURL) != -1) {
        console.log('ACORN detected');
        // Load jQuery
        var importScript = (function(oHead) {
            function loadError(oError) {
                throw new URIError("The script " + oError.target.src + " is not accessible.");
            }
            return function(sSrc, fOnload) {
                var oScript = document.createElement("script");
                oScript.type = "text\/javascript";
                oScript.onerror = loadError;
                if (fOnload) {
                    oScript.onload = fOnload;
                }
                oHead.appendChild(oScript);
                oScript.src = sSrc;
            }
        })(document.head || document.getElementsByTagName("head")[0]);

        importScript('https://code.jquery.com/jquery-2.1.4.min.js', run)
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
