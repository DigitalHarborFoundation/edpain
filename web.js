var MONGO_URI = process.env.MONGOLAB_URI || 'mongodb://127.0.0.1:27017/test';
var PORT = process.env.PORT || 8001;
var url = require('url');
var REDIS_URI = url.parse(process.env.REDISTOGO_URL || "redis://127.0.0.1/");
var baseUrl = "http://edpain.digitalharborfoundation.org";

var express = require('express');
var mongo = require('mongodb');
var sio = require('socket.io');
var _ = require('underscore');
var rss = require('rss');
var RedisStore = require('connect-redis')(express);

var redisArgs = {
  host: REDIS_URI.hostname,
  port: REDIS_URI.port
};
if (REDIS_URI.auth) {
  var redisAuth = REDIS_URI.auth.split(':');
  redisArgs.db = redisAuth[0];
  redisArgs.pass = redisAuth[1];
}
var redisStore = new RedisStore(redisArgs);

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
// collect the pains collection from mongo and do callback with it
var painCollect = function(callback) {
	mongo.connect(MONGO_URI, {}, function(error, db) {
	  if (error) {
	    console.log(error);
	    return;
    }
	  db.addListener("error", function(error) {
	    console.log("Error connecting to MongoLab");
	  });
	  db.collection('pains', function(err, coll) {
			if (err) {
				console.log(err);
				return;
			}
			callback(coll);
		});
	});
};
var anotherSharesAPain;
app.get("/json/pains/voteup", function(req, res) {
  //TODO: require login
  var painId = req.body.id;
  painCollect(function(pains) {
    pains.find({_id: painId},function(err,docs) {
      var shares = docs[0].shares;
      anotherSharesAPain(painId, (shares ? (shares + 1) : 1));
    });
    pains.update({_id: painId}, {$inc: {shares: 1}}, true);
  });
});
app.get("/json/pains", function(req, res) {
  painCollect(function(pains) {
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
	painCollect(function(pains){
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
app.get('/', function(req, res){
  res.render('index', {csrf_token: req.session._csrf});
});
app.get('/example-twitter-card', function(req, res){
  res.render('twitter-card');
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
painCollect(function(pains) {
  var cursor = pains.find().sort({date:-1});
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
app.get("/rss.xml", function(req, res) {
  res.contentType("rss");
  res.send(xml);
});
app.get("/allPains.csv", function(req, res) {
  res.contentType("text/csv");
  painCollect(function(pains) {
		pains.find().toArray(function(err,docs) {
			if (err) {
				console.log(err);
				return;
			}
			var wrap = function(a) {
			  var s = String(a);
			  return s ? ('"' + s.replace(/\"/g, "\"\"") +'"') : "";
			};
		  var fields = ["role", "pain", "name", "zip", "date"];
	    for (var j = 0; j < fields.length;j++) {
	      var field = fields[j];
	      if (j > 0 && j < fields.length) {
	        res.write(",");
	      }
	      res.write(wrap(field));
      }  
      res.write("\n");
		  for (var i = 0; i < docs.length; i++) {
		    var doc = docs[i];
			  if (doc) {
			    for (var j = 0; j < fields.length;j++) {
			      var field = fields[j];
			      if (j > 0 && j < fields.length) {
			        res.write(",");
			      }
			      res.write(wrap(doc[field]));
			    }
			  }
			  res.write("\n");
			}
			res.end();
		});
	});
});
app.use("/", express.static(__dirname));

//start the express http server
var httpServer = app.listen(PORT, function() {
  console.log("Listening on " + PORT);
});

//start the socketio server
var io = sio.listen(httpServer);
io.set("log level",2);
io.set('transports', ['xhr-polling']);
io.set('polling duration', 10);
//TODO: get redis store working for socketio

//adds new pains to websocket and rss
addNewPain = function(pain) {
	io.sockets.emit('newPain', pain);
  addPainToFeed(pain);
  xml = feed.xml();
};
//adds new pains to websocket and rss
anotherSharesAPain = function(painId, numShares) {
	io.sockets.emit('anotherSharesAPain', 
	  {'painId': painId, 'numShares' : numShares});
};