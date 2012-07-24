var express = require('express');
var mongo = require('mongodb');
var MONGO_URI = process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/test';
var sio = require('socket.io');
var _ = require('underscore');

var app = express.createServer();
app.set('views', __dirname);
app.set('view engine', 'jade');
app.use(express.logger());
app.use(express.limit('5kb'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: process.env.SESSION_KEY || "takeonlywhatyouneed"}));
app.use(express.csrf());
app.use(require("stylus").middleware({
		debug: true,
    src: __dirname,
    dest: __dirname,
    compress: true
}));
app.use(function(req,res,next) {
	res.locals._csrf = req.session._csrf;
	next();
});

app.get("/json/pains", function(req, res) {
	mongo.connect(MONGO_URI, {}, function(error, db) {
	  db.addListener("error", function(error) {
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
			if (req.query.lastDate) {
				cursor = pains.find({date: { $lt: Number(req.query.lastDate)} }).sort({date:-1}).limit(10);
			} else {
				cursor = pains.find().sort({date:-1}).limit(10);
			}
			cursor.toArray(function(err,docs) {
				if (err) {
					console.log(err);
					return;
				}
				console.log(docs.length);
		    res.write(JSON.stringify(docs));
				res.end();
			});
		});
	});
});
var addNewPain = function() {};
app.post("/json/pains", function(req, res) {
	var pain = req.body;
	if (!pain.role || !pain.pain || !pain.zip ||
			pain.role.length > 30 || pain.pain.length > 300 || 
			pain.zip.length != 5 || isNaN(Number(pain.zip)) ||
			(pain.name && pain.name.length > 50)) {
		res.setHeader("Content-Type", "application/json");
		res.write(JSON.stringify({success:false, errors: ["Error saving edpain."]}));
		res.end();
		return;
	}
	pain.date = new Date().getTime();
	mongo.connect(MONGO_URI, function(error, db) {
	  db.addListener("error", function(error){
	    console.log("Error connecting to MongoLab");
	  });
	  db.collection('pains', function(err, pains) {
			if (err) {
				console.log(err);
				return;
			}
			res.setHeader("Content-Type", "application/json");
			pains.insert(pain, {safe:true}, function(err,docs) {
				console.log(arguments);
				if (err) {
					console.log(err);
					return;
				}
				addNewPain(docs[0]);
		    res.write(JSON.stringify(docs));
				res.end();
			});
		});
	});
});
app.get('/', function(req, res){
  res.render('index', {csrf_token: req.session._csrf});
});
app.use("/", express.static(__dirname));

var port = process.env.PORT || 8000;
var httpServer = app.listen(port, function() {
  console.log("Listening on " + port);
});

var io = sio.listen(httpServer);
addNewPain = function(pain) {
	io.sockets.emit('newPain', pain);
};