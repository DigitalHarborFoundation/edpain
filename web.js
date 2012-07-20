var express = require('express');
var mongo = require('mongodb');

var app = express.createServer(express.logger());

app.get("/mongotest", function(req, res) {
	mongo.connect(process.env.MONGOLAB_URI, {}, function(error, db) {
	  // console.log will write to the heroku log which can be accessed via the 
	  // command line as "heroku logs"
	  db.addListener("error", function(error){
	    console.log("Error connecting to MongoLab");
	  });
	  db.createCollection('requests', function(err, collection) {
	    db.collection('requests', function(err, collection) {
	      var requestCollection = collection;
				res.setHeader("Content-Type", "application/json");
				if(req.query != null) {
				  requestCollection.insert(req.query, function(error, result) {
				    // result will have the object written to the db so let's just
				    // write it back out to the browser
				    res.write(JSON.stringify(result));
				  });
				}
				res.end();
			});
		});
	});
});
app.use("/", express.static(__dirname));

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});