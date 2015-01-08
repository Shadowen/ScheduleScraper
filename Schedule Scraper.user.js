// ==UserScript==
// @name        ScheduleScraper
// @namespace   http://www.heungs.com/wesley
// @description Scrapes schedule from Rosi.
// @include     https://sws.rosi.utoronto.ca/sws/timetable/main.do?main.dispatch
// @version     1
// @grant       none
// ==/UserScript==
// TODO
// Retrieve school start date from http://www.apsc.utoronto.ca/Calendars/2013-2014/Sessional_Dates.html
// Alternate week labs (not sure how to choose which week
// Automate import into Google Calendar
// Button to activate
// http://www.undergrad.engineering.utoronto.ca/Office_of_the_Registrar/Timetables.htm
// http://wiki.greasespot.net/GM_xmlhttpRequest
function createEmptyCourse(reason) {
  var c = new Object();
  c.name = reason;
  return c;
}
function formatTime(time) {
  var timeSplit = time.split(':');
  var hour = parseInt(timeSplit[0]);
  if (hour < 9) {
    hour += 12;
  }
  var hourString = ('0' + hour.toString()) .slice( - 2);
  var minuteString = timeSplit[1];
  return hourString + '' + minuteString;
}
function parseCourse(headTag, day) {
  var course = new Object();
  var splitString = headTag.innerHTML.split(' ');
  course.name = splitString[0] + ' ' + splitString[1];
  course.section = headTag.getElementsByClassName('meet') [0].innerHTML;
  course.day = day;
  var time = splitString[4].split('<br>') [1].split('-');
  course.startTime = formatTime(time[0]);
  course.endTime = formatTime(time[1]);
  course.location = headTag.getElementsByClassName('room') [0].innerHTML;
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
    alert('Error parsing day');
  }
}
function findStartDate() {
  var elem = document.createElement('iframe');
  elem.setAttribute('src', 'http://www.w3schools.com/');
  elem.innerHTML = 'Your browser does not support the <iframe> tag!';
  //document.body.appendChild(elem)
  return new Date(2014, 0, 6);
  // TODO
}
function calculateNextDay(startDate, dayOfWeek) {
  var date = new Date(startDate);
  while (date.getDay() != dayOfWeek) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}
var scheduleTag = document.getElementsByClassName('sched') [0];
var tbody = scheduleTag.getElementsByTagName('tbody') [0];
var rows = tbody.getElementsByTagName('tr');
var schedule = new Array();
for (var e = 0; e <= 5; e++) {
  schedule[e] = new Array();
  for (var a = 0; a <= 11; a++) {
    schedule[e][a] = createEmptyCourse('UNINITIALIZED');
  }
}
for (var time = 1; time < rows.length; time++) {
  var cols = rows[time].getElementsByTagName('td');
  var dayOffset = 0;
  for (var day = 1; day < cols.length; day++) {
    //alert("Day " + day.toString());
    var cell = cols[day];
    // For double and triple slots earlier in the week..
    while (schedule[day + dayOffset][time].name == 'PLACEHOLDER') {
      dayOffset++;
      //alert("Placeholder found!");
    }
    // Find the attribute we are looking for and insert
    for (var a = 0; a < cell.attributes.length; a++) {
      if (cell.attributes[a].name == 'class' && cell.attributes[a].value == 'hourEmpty') {
        alert("Empty timeslot found!");
        schedule[day + dayOffset][time] = createEmptyCourse('EMPTY');
        break;
      } else if (cell.attributes[a].name == 'rowspan' && cell.attributes[a].value == '1') {
        alert("Regular timeslot here." + cell.innerHTML);
        schedule[day + dayOffset][time] = parseCourse(cell, day + dayOffset);
        break;
      } else if (cell.attributes[a].name == 'rowspan' && cell.attributes[a].value == '2') {
        alert("Double timeslot found!" + cell.innerHTML);
        schedule[day + dayOffset][time] = parseCourse(cell, day + dayOffset);
        schedule[day + dayOffset][time + 1] = createEmptyCourse('PLACEHOLDER');
        break;
      } else if (cell.attributes[a].name == 'rowspan' && cell.attributes[a].value == '3') {
        alert("Triple timeslot found!" + cell.innerHTML);
        schedule[day + dayOffset][time] = parseCourse(cell, day + dayOffset);
        schedule[day + dayOffset][time + 1] = createEmptyCourse('PLACEHOLDER');
        schedule[day + dayOffset][time + 2] = createEmptyCourse('PLACEHOLDER');
        break;
      }
    }
    //alert(schedule[day + dayOffset][time]);
  }
}
alert('Hello world!')
// Check by printing out the schedule in the new order
/*alert("Success!");
for (var day = 1; day <= 5; day++){
        var delem = document.createElement('div');
        delem.innerHTML = "Day " + day.toString();
	    document.body.appendChild(delem)
    for (var time = 1; time <= 11; time ++){
        var elem = document.createElement('div');
        elem.innerHTML = schedule[day][time];
	    document.body.appendChild(elem)
    }
}*/
var courses = new Array();
for (var day = 1; day <= 5; day++) {
  for (var time = 1; time <= 11; time++) {
    if (schedule[day][time].name != 'EMPTY' && schedule[day][time].name != 'PLACEHOLDER' && schedule[day][time].name != 'UNINITIALIZED') {
      var c = schedule[day][time];
      courses.push(c);
      //alert(c);
    }
  }
}
// Check by printing out the courses
/*for (var c = 0; c < courses.length; c++){
    var course = courses[c];
    var elem = document.createElement('div');
    elem.innerHTML = course.name + ", " + course.startTime + ", " + course.endTime + ", " + course.section + ", " +  course.location;
    document.body.appendChild(elem)
}*/
// Generate .ics

var icsString;
var today = new Date();
var startDate = findStartDate();
var elem = document.createElement('div');
icsString = 'BEGIN:VCALENDAR\n';
icsString += 'PRODID:Wesley Inc.\n';
icsString += 'CALSCALE:GREGORIAN\n';
icsString += 'METHOD:REQUEST\n';
for (var c = 0; c < courses.length; c++) {
  var course = courses[c];
  var courseDate = calculateNextDay(startDate, course.day);
  var dateString = courseDate.getFullYear() + '' + ('0' + (courseDate.getMonth() + 1)) .slice( - 2) + '' + ('0' + courseDate.getDate()) .slice( - 2);
  icsString += 'BEGIN:VEVENT\n';
  icsString += 'DTSTART:' + dateString + 'T' + course.startTime + '00\n';
  icsString += 'DTEND:' + dateString + 'T' + course.endTime + '00\n';
  icsString += 'UID:' + (today.getTime() + c) + '@heungs.com\n';
  icsString += 'DESCRIPTION:' + course.section + '\n';
  icsString += 'LOCATION:' + course.location + '\n';
  icsString += 'SUMMARY:' + course.name + ' ' + course.section + '\n';
  icsString += 'RRULE:FREQ=WEEKLY;BYDAY=' + dayToString(course.day) + ';COUNT=' + '30\n';
  icsString += 'END:VEVENT\n';
}
icsString += 'END:VCALENDAR\n';
//document.body.appendChild(elem)
alert(icsString);
