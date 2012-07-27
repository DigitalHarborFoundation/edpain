var MONGO_URI = process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/test';
var PORT = process.env.PORT || 8000;
var REDIS_URI = url.parse(process.env.REDISTOGO_URL || "redis://dev:dev@127.0.0.1/");
var baseUrl = "http://edpain.digitalharborfoundation.org";

var express = require('express');
var mongo = require('mongodb');
var sio = require('socket.io');
var _ = require('underscore');
var rss = require('rss');
var RedisStore = require('connect-redis')(express);
var url = require('url');

var redisAuth = REDIS_URI.auth.split(':');
var redisStore = new RedisStore({
  host: REDIS_URI.hostname,
  port: REDIS_URI.port,
  db: redisAuth[0],
  pass: redisAuth[1]
});

var app = express.createServer();
app.set('views', __dirname);
app.set('view engine', 'jade');
app.use(express.logger());
app.use(express.limit('5kb'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ 
  secret: process.env.SESSION_KEY || "takeonlywhatyouneed",
  store: redisStore}));
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

//config the rss feed
var feed = new rss({
  title: '#edpain',
  description: 'identifying the pain points of education',
  feed_url: baseUrl + '/rss.xml',
  site_url: baseUrl,
  image_url: baseUrl + '/dhflogo_small.png',
  author: 'Digital Harbor Foundation'
});
var xml = feed.xml();
var addPainToFeed = function(pain) {
  feed.item({
      title:  pain.pain.length > 30 ? (pain.pain.substr(0,27) + "...") : pain.pain,
      description: pain.pain + "<br />" + pain.name + ' — ' + pain.role
        + ' from ' + (pain.cityState || pain.zip),
      url: baseUrl + '/?id=' + pain._id,
      guid: pain._id,
      author: pain.name ? pain.name : "Anonymous",
      date: pain.date
  });
};
mongo.connect(MONGO_URI, function(error, db) {
  db.addListener("error", function(error){
    console.log("Error connecting to MongoLab");
  });
  db.collection('pains', function(err, painCollection) {
    var cursor = painCollection.find().sort({date:-1});
    cursor.each(function(err, pain) {
      if (err) {
        console.log(err);
        return;
      }
      if (pain != null) {
        addPainToFeed(pain);
      }
      else {
        xml = feed.xml();
      }
    });
  });
});
app.get("/rss.xml", function(req, res) {
  res.contentType("rss");
  res.send(xml);
});
app.use("/", express.static(__dirname));

//start the express http server
var httpServer = app.listen(PORT, function() {
  console.log("Listening on " + PORT);
});

//start the socketio server
var io = sio.listen(httpServer);
io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set("log level",2);
io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
]);
//TODO: get redis store working for socketio

//adds new pains to websocket and rss
addNewPain = function(pain) {
	io.sockets.emit('newPain', pain);
  addPainToFeed(pain);
  xml = feed.xml();
};