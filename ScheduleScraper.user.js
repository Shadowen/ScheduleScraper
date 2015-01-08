// ==UserScript==
// @name        ScheduleScraper
// @namespace   http://www.heungs.com/wesley
// @description Scrapes schedule from Rosi.
// @include     https://sws.rosi.utoronto.ca/sws/timetable/main.do?main.dispatch
// @version     2
// @grant       none
// ==/UserScript==
// TODO
// Retrieve school start date from http://www.apsc.utoronto.ca/Calendars/2013-2014/Sessional_Dates.html
// Alternate week labs (not sure how to choose which week
// Automate import into Google Calendar
// Button to activate
// http://www.undergrad.engineering.utoronto.ca/Office_of_the_Registrar/Timetables.htm
// http://wiki.greasespot.net/GM_xmlhttpRequest

function formatTime(time) {
    var timeSplit = time.split(':');
    var hour = parseInt(timeSplit[0]);
    if (hour < 9) {
        hour += 12;
    }
    var hourString = ('0' + hour.toString()).slice(-2);
    var minuteString = timeSplit[1];
    return hourString + '' + minuteString;
}
function parseCourse(slotTag, dayNum) {
    var course = new Object();
    
    var slotLines = slotTag.innerHTML.split("<br>");
    
    course.name = slotLines[0];
    course.day = dayNum;
    course.meeting = slotTag.getElementsByClassName("meet")[0].innerHTML;
    course.startTime = formatTime(slotLines[2].split("-")[0]);
    course.endTime = formatTime(slotLines[2].split("-")[1]);
    course.room = slotTag.getElementsByClassName("room")[0].innerHTML;
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
    }
}
function findStartDate() {
    var elem = document.createElement('iframe');
    elem.setAttribute('src', 'http://www.w3schools.com/');
    elem.innerHTML = 'Your browser does not support the <iframe> tag!';
    //document.body.appendChild(elem)
    return new Date(2015, 0, 5);
    // TODO
}
function calculateNextDay(startDate, dayOfWeek) {
    var date = new Date(startDate);
    while (date.getDay() != dayOfWeek) {
        date.setDate(date.getDate() + 1);
    }
    return date;
}

var schedule = new Array();

var scheduleTableTag = document.getElementsByClassName('sched')[0];
var tBodyTag = scheduleTableTag.getElementsByTagName('tbody')[0];
var trTags = scheduleTableTag.getElementsByTagName('tr');

var dayOffsets = new Array();
for (var i = 0; i < 5; i++){
	dayOffsets[i] = 0;
}
for (var r = 1; r < trTags.length; r++) {
    var tdTags = trTags[r].getElementsByTagName('td');
    var tagNum = 0;
    for (var dayNum = 0; dayNum <= 5; dayNum++) {        
        // Calculate day of the week
        dayOffsets[dayNum]--;
        // If the slot is taken up by someone else, skip it
        if (dayOffsets[dayNum] >= 0){
            continue;
        }
        
        var slotTag = tdTags[tagNum];
        var className = slotTag.className;

        // Skip empty classes
        if (className == "time" || className == "hourEmpty" || className == "empty"){
            tagNum++;
            continue;
        }
        schedule[schedule.length] = parseCourse(slotTag, dayNum);
        
        // Multi-row courses
        if (slotTag.rowSpan != null){
            dayOffsets[dayNum] = slotTag.rowSpan - 1;
        }
        
        tagNum++;
        
        // Print out the schedule as we go
        //var elem = document.createElement('div');
        //elem.innerHTML = schedule[schedule.length-1].name;
        //document.body.appendChild(elem)
    }
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
    var dateString = courseDate.getFullYear() + '' + ('0' + (courseDate.getMonth() + 1)) .slice( - 2) + '' + ('0' + courseDate.getDate()) .slice( - 2);
    icsString += 'BEGIN:VEVENT\n';
    icsString += 'DTSTART:' + dateString + 'T' + course.startTime + '00\n';
    icsString += 'DTEND:' + dateString + 'T' + course.endTime + '00\n';
    icsString += 'UID:' + (today.getTime() + c) + '@heungs.com\n';
    icsString += 'DESCRIPTION:' + course.section + '\n';
    icsString += 'LOCATION:' + course.room + '\n';
    icsString += 'SUMMARY:' + course.name + ' ' + course.meeting + '\n';
    icsString += 'RRULE:FREQ=WEEKLY;BYDAY=' + dayToString(course.day) + ';COUNT=' + '30\n';
    icsString += 'END:VEVENT\n';
}
icsString += 'END:VCALENDAR\n';

// Create download link
var textFileAsBlob = new Blob([icsString], {type:'text/plain'});
var fileNameToSaveAs ="scheduleScraper_export.ics";
var downloadLink = document.createElement("a");
downloadLink.download = fileNameToSaveAs;
downloadLink.innerHTML = "Download as .ics";
downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
// Insert in proper location
var allHyperlinks = document.getElementsByTagName("a");
for (var i = 0; i < allHyperlinks.length; i++){
    if (allHyperlinks[i].href == "http://www.rosi.utoronto.ca/printinstruct.html"){
        var plainText = document.createElement("span");
        plainText.innerHTML = " ";
        allHyperlinks[i].parentNode.insertBefore(plainText, allHyperlinks[i].nextSibling);
        allHyperlinks[i].parentNode.insertBefore(downloadLink, plainText.nextSibling);
    }
}

//alert("Success!");