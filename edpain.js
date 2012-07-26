$(function() {
  //force chrome to reset (some problems below when inserting content)
  var forceReset = function() {
    var body = $("body");
    if (body.css("-webkit-transform") == "translateZ(1px)") {
      body.css("-webkit-transform","none");
    }
    else {
      body.css("-webkit-transform",'translateZ(1px)');
    }
  };

  //reflexive layout based on em's
  var win = $(window);
  var fontResizer = function($el, scale) {
    //simplified version of fittext.js
    var resize = function() {
      $el.css('font-size', win.width()/scale);
    };
    resize();
    win.on('resize',resize);
  }
  fontResizer($("#subHeader h1"), 6.0);
  fontResizer($("#subHeader p"), 42.0);
  fontResizer($("#description"), 35.0);
  fontResizer($("#painEntry"), 37.0);
  fontResizer($("#pains"), 22.0);
  fontResizer($("#postPainEntry"), 40.0);
  fontResizer($("body > header"), 60.0);
  
  //anal a/an solution
  $("#painEntry .role").keyup(function() {
    var val = $(this).val();
    if (val && (val.length > 0) && ($.inArray(val.substr(0,1).toLowerCase(), ["a","e", "i", "o", "u"]) >= 0)) {
      $("#painEntry .pluralRole").css("visibility", "visible");
    }
    else {
      $("#painEntry .pluralRole").css("visibility", "hidden");
    }
  });
  
  // validation that controls if the post button shows
  var showPostButton = function() {
    var role = $("#painEntry .role").val();
    var pain = $("#painEntry textarea").val();
    var zip = $("#painEntry .zip").val();
    var post = $("#painEntry .post");
    if (role && pain && zip && role.length > 0 && pain.length >= 3
	 		&& zip.length == 5 && !isNaN(Number(zip)) && pain.length <= 300) {
      if (post.css("visibility") == "hidden") {
        post.hide()
          .css("visibility", "visible")
          .fadeIn();
      }
    }
    else {
      post.css("visibility", "hidden");
    }
  };
  $("#painEntry .role").keyup(showPostButton).blur(showPostButton);
  $("#painEntry textarea").keyup(showPostButton).blur(showPostButton);
  $("#painEntry .zip").keyup(showPostButton).blur(showPostButton);
  
  // convert zip code to city, state
  var geocoder = new google.maps.Geocoder();
  var zipToCityState = function(zip, callback) {
    geocoder.geocode({ 'address': zip}, function(results, status) {
      if (results && results.length) {
        for (var i = 0; i < results.length;i++) {
          if (results[i].types[0] == "postal_code") {
            var a = results[i].formatted_address;
            //strip off zip and country if USA
            if (a.indexOf(zip + ", USA") >= 0) {
              a = a.substr(0,a.indexOf(zip)-1);
            }
            callback(a);
          }
        }
      }
			else {
				callback(zip);
			}
    });
  };
  
  var painDisplayTemplate = _.template($("#painDisplayTemplate").text());
  var painExtraTemplate = _.template($("#painExtraTemplate").text());
  var painEntry = $("#painEntry");
  var postPainEntry = $("#postPainEntry");

  //toggling of pain open/close
  var togglePainOpen = function(el) {
    var extra = el.data("extra");
    if (el.hasClass("open")) {
      if (extra) {
        extra.remove();
      }
    }
    else {
      var tmpl = $(painExtraTemplate());
      el.append(tmpl).data("extra", tmpl);
      tmpl.hide().fadeIn("slow");
      forceReset();
    }
    el.toggleClass("open");
  }
  $("#pains").on("click", "li", function() {
    togglePainOpen($(this));
  });
  
  //displaying a new pain coming in
  var addPain = function(data, isPrepended) {
    return $(painDisplayTemplate(data))
        [isPrepended ? "prependTo" : "appendTo"]($("#pains ul"))
        .hide()
        .fadeIn('slow')
        .data("painData",data);
  };
  var updateServerWithPain = function(data, callback) {
    $.ajax({
      type: "POST",
      url:"/json/pains",
      beforeSend: function(jqXHR) {
        jqXHR.setRequestHeader('x-csrf-token', $("meta[name='csrf_token']").attr("content"));
        return true;
      },
      'data': JSON.stringify(data),
      processData: false,
      contentType: "application/json",
      dataType: "json",
      success: function(data) {
        callback(true, data[0]);
      },
      error: function() {
        callback(false, arguments);
      }
    });
  };
  // saving of a pain when posted
  var extractPain = function(callback) {
    var name = painEntry.find(".name").val();
    var data = {
      role: painEntry.find(".role").val(),
      'pain': painEntry.find("textarea").val(),
      name: name ? name : "",
      zip: painEntry.find(".zip").val()
    };
    // TODO: optimization: do zip conversion both client 
    // and server side to speed it up!
    zipToCityState(data.zip,function(cityState) {
      data.cityState = cityState;
      callback(data);
    });
  };
  var postPain = function() {
    if (this.deactivated) {
      return;
    }
    this.deactivated = true;
    var that = this;
    extractPain(function(painIn) {
      updateServerWithPain(painIn, function(success, painOut) {
        if (success) {
          //var newPain = addPain(painOut);
          //togglePainOpen(newPain);
//TODO: open relevant pain!
          painEntry.fadeOut('slow', function() { 
            postPainEntry.fadeIn('slow');
          });
        }
        that.deactivated = false;
      });
    });
  }
  painEntry.find(".post").on("click",postPain);

  //When another pain is desired, reset just the pain and scroll to
  var resetAndScrollToPainEntry = function() {
    painEntry.find("textarea").val("");
    showPostButton();
    window.scrollTo(0,$("#pains")[0].offsetTop);
    painEntry.fadeIn('slow');
  };
  var anotherPain = function() {
    if (postPainEntry.is(":visible")) {
      postPainEntry.fadeOut('slow', function() {
        resetAndScrollToPainEntry();
      });
    }
    else {
      resetAndScrollToPainEntry();
    }
  };
  postPainEntry.find(".back")
    .click(anotherPain)
    // add sticky class (for fixed) when have another 
    // edpain button goes out of the window
    .waypoint(function(e,dir) {
      $(this).toggleClass("sticky", dir === "down");
    });
  
  //share via twitter
  var getTwitterShareUrl = function(text) {
    var url = "https://twitter.com/intent/tweet";
    url += "?url=" + encodeURI("http://edpain.digitalharborfoundation.org");
    // add #edpain to front and quote it (or end ellipses)
    url += "&text=" + "%23edpain%20%E2%80%9C" + (text.length <= 109 ? (text + '%E2%80%9D') : (text.substr(0,109) + "%E2%80%A6"));
    return url;
  };
  //share via facebook
  var getFacebookShareUrl = function(text, userString) {
    var url = "http://www.facebook.com/dialog/feed";
    url += "?link=" + encodeURI("http://edpain.digitalharborfoundation.org");
    url += "&app_id=366391053434145"
    url += "&name=%23edpain";
    url += "&caption=" + encodeURI(userString);
    url += "&picture=" + encodeURI("http://www.digitalharborfoundation.org/dhf_logo.png");
    url += "&redirect_uri=" +  encodeURI("http://edpain.digitalharborfoundation.org");
    url += "&description=" + encodeURI(text);
    return url;
  };
  $("#pains").on("click", "button.twitter", function(e) {
    var li = $(this).closest("li");
    var text = li.find("q").text();
    var url = getTwitterShareUrl(text);
    var newwindow = window.open(url);
    if (window.focus) { 
      newwindow.focus();
    }
    e.stopPropagation();
  })
  .on("click", "button.facebook", function(e) {
    var li = $(this).closest("li");
    var text = li.find("q").text();
    var userString = li.find("cite").text();
    var url = getFacebookShareUrl(text, userString);
    var newwindow = window.open(url);
    if (window.focus) { 
      newwindow.focus();
    }
    e.stopPropagation();
  });
	var appendMorePains = function(callback) {
  	var lastEntry = $("#pains li:last-child").data("painData");
	  $.ajax({
	    url: "/json/pains" + (lastEntry ? ("?lastDate=" + lastEntry.date) : ""),
	    dataType: "json",
	    success: function(data) {
	      _.each(data, function(pain) {
	        if (!pain.cityState) {
	          zipToCityState(pain.zip,function(cityState) {
	            pain.cityState = cityState;
	            addPain(pain, false);
	          });
	        }
	        else {
	          addPain(pain, false);
	        }
	      });
				callback(data);
	    }
	  });
  };
	var footer = $("body > footer");
	var lock = false;
	var footerWaypointOpts = {offset: '100%'};
	var loadMorePains = function() {
    if (!lock) {
      lock = true;
	  	footer.waypoint('remove');
	    var button = footer.find("button").hide();
	    var p = footer.find("p");
  	  p.show();
  	  appendMorePains(function(data) {
        if (data.length < 10) {
          p.html("You have reached the last #edpain.");
        }
        else {
          lock = false;
         	footer.waypoint(footerWaypointOpts);
          p.fadeOut(function() {
            button.fadeIn();
          });
        }
  	  });
	  }
	};
  footer.waypoint(loadMorePains, footerWaypointOpts)
    .find("button").click(loadMorePains);
  var socket = io.connect();
  socket.on('newPain', function (data) {
    addPain(data, true);
  });
});