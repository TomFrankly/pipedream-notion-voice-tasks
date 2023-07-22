var name = notionname;
var task = global("VOICE");
var datetime = global("TIMES");
var secret = secretkey;

var datemillis = datetime * 1000;
var dateobject = new Date(datemillis);
var timezoneoffsetminutes = dateobject.getTimezoneOffset();
var timezoneoffsethours = Math.floor(Math.abs(timezoneoffsetminutes) / 60);
var timezoneoffsetformatted =
	(timezoneoffsetminutes < 0 ? "+" : "-") +
	String(timezoneoffsethours).padStart(2, "0") +
	String(Math.abs(timezoneoffsetminutes) % 60).padStart(2, "0");
timezoneoffsetformatted = timezoneoffsetformatted.slice(0, 3) + ":" + timezoneoffsetformatted.slice(3);

var dateiso = dateobject.toISOString();
dateiso = dateiso.replace("Z", "") + timezoneoffsetformatted;

var jsondata = JSON.stringify({
	name: name,
	task: task,
	date: dateiso,
	secret: secret,
});
