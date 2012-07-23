var express = require('express');
var mongo = require('mongodb');
var MONGO_URI = process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/test';
var sio = require('socket.io');

var app = express.createServer();
app.use(express.logger());
app.use(express.limit('5kb'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: process.env.SESSION_KEY || "takeonlywhatyouneed"}));
app.use(express.csrf());

app.get("/json/pains", function(req, res) {
	mongo.connect(MONGO_URI, {}, function(error, db) {
	  db.addListener("error", function(error){
	    console.log("Error connecting to MongoLab");
	  });
	  db.collection('pains', function(err, coll) {
			if (err) {
				console.log(err);
				return;
			}
      var pains = coll;
			res.setHeader("Content-Type", "application/json");
			var cursor;
			if (req.body.lastDate) {
				cursor = pains.find({date: { $lt: req.body.lastDate} }).sort({date:-1}).limit(10);
			} else {
				cursor = pains.find().sort({date:-1}).limit(10);
			}
			cursor.toArray(function(err,docs) {
				if (err) {
					console.log(err);
					return;
				}
		    res.write(JSON.stringify(docs));
				res.end();
			});
		});
	});
});
app.post("/json/pains", function(req, res) {
	var pain = req.body;
	if (!pain.role || !pain.pain || !pain.zip ||
			pain.role.length > 30 || pain.pain.length > 300 || 
			pain.zip.length != 5 || toNumber(pain.zip) == NaN ||
			(pain.name && pain.name.length > 50)) {
		res.setHeader("Content-Type", "application/json");
		res.write(JSON.stringify({success:false, errors: ["Error saving edpain."]}));
		res.end();
		return;
	}
	pain.date = new Date().getTime();
	mongo.connect(MONGO_URI, {}, function(error, db) {
	  // console.log will write to the heroku log which can be accessed via the 
	  // command line as "heroku logs"
	  db.addListener("error", function(error){
	    console.log("Error connecting to MongoLab");
	  });
	  db.collection('pains', function(err, pains) {
			if (err) {
				console.log(err);
				return;
			}
			res.setHeader("Content-Type", "application/json");
			pains.insert(pain, function(err,docs) {
				if (err) {
					console.log(err);
					return;
				}
		    // result will have the object written to the db so let's just
		    // write it back out to the browser
				// err isn't checked because this is not a 'safe' insert
		    res.write(JSON.stringify(pain));
				res.end();
			});
		});
	});
});
app.use("/", express.static(__dirname));

var port = process.env.PORT || 8000;
app.listen(port, function() {
  console.log("Listening on " + port);
});