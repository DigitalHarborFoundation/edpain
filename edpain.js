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
    if (role && pain && zip && role.length > 0 && pain.length >= 3 && zip.length == 5 && Number(zip) != NaN && pain.length <= 300) {
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
  var zipToCityState = function(zip, target) {
    var t = $("#" + target);
    geocoder.geocode({ 'address': zip}, function(results, status) {
      console.log(results);
      if (results) {
        for (var i = 0; i < results.length;i++) {
          if (results[i].types[0] == "postal_code") {
            var a = results[i].formatted_address;
            //strip off zip and country if USA
            if (a.indexOf(zip + ", USA") >= 0) {
              a = a.substr(0,a.indexOf(zip)-1);
            }
            t.replaceWith(a);
            return;
          }
        }
      }
      t.replaceWith(zip);
    });
  };
  
  var painDisplayTemplate = _.template($("#painDisplayTemplate").text());
  var painExtraTemplate = _.template($("#painExtraTemplate").text());
  var pain = $("#painEntry");
  var share = $("#postPainEntry");

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
  
  //saving of a pain when posted
  var extractPain = function() {
    var name = pain.find(".name").val();
    var data = {
      role: pain.find(".role").val(),
      'pain': pain.find("textarea").val(),
      name: name ? name : "",
      zip: pain.find(".zip").val() 
    }
    var newPain = $(painDisplayTemplate(data))
        .prependTo($("#pains ul"))
        .hide()
        .fadeIn('slow');
    zipToCityState(data.zip, "zipTarget");
    togglePainOpen(newPain);
    pain.fadeOut('slow', function() { 
      share.fadeIn('slow');
    });
  };
  $("#painEntry .post").click(extractPain);

  //When another pain is desired, reset just the pain and scroll to
  var resetAndScrollToPainEntry = function() {
    pain.find("textarea").val("");
    showPostButton();
    window.scrollTo(0,$("#pains")[0].offsetTop);
    pain.fadeIn('slow');
  };
  var anotherPain = function() {
    if (share.is(":visible")) {
      share.fadeOut('slow', function() {
        resetAndScrollToPainEntry();
      });
    }
    else {
      resetAndScrollToPainEntry();
    }
  };
  $("#postPainEntry .back").click(anotherPain);
  
  // add sticky class (for fixed) when have another 
  // edpain button goes out of the window
  $("#postPainEntry .back").waypoint(function(e,dir) {
    $(this).toggleClass("sticky", dir === "down");
  });
  
	//share via twitter
  var getTwitterShareUrl = function(text, permalink) {
    var url = "https://twitter.com/intent/tweet";
    url += "?url=" + encodeURI(permalink);
    // add #edpain to front and quote it (or end ellipses)
    url += "&text=" + "%23edpain%20%E2%80%9C" + (text.length <= 109 ? (text + '%E2%80%9D') : (text.substr(0,109) + "%E2%80%A6"));
    return url;
  };
  $("#pains").on("click", "button.twitter", function(e) {
    var li = $(this).closest("li");
    var text = li.find("q").text();
    var permalink = li.find("a").attr("href");
    var url = getTwitterShareUrl(text, permalink);
  	var newwindow = window.open(url);
  	if (window.focus) { 
  	  newwindow.focus();
  	}
    e.stopPropagation();
  });

  //share via facebook
  var getFacebookShareUrl = function(text, permalink) {
    var url = "http://www.facebook.com/dialog/feed";
    url += "?link=" + encodeURI(permalink);
    url += "&app_id=366391053434145"
    url += "&name=%23edpain";
    url += "&picture=" + encodeURI("http://www.digitalharborfoundation.org/dhf_logo.png");
    url += "&redirect_uri=" +  encodeURI("https://edpain.digitalharborfoundation.org");
    url += "&description=" + (text.length <= 109 ? (text + '%E2%80%9D') : (text.substr(0,109) + "%E2%80%A6"));
    return url;
  };
  $("#pains").on("click", "button.facebook", function(e) {
    var li = $(this).closest("li");
    var text = li.find("q").text();
    var permalink = li.find("a").attr("href");
    var url = getFacebookShareUrl(text, permalink);
  	var newwindow = window.open(url);
  	if (window.focus) { 
  	  newwindow.focus();
  	}
    e.stopPropagation();
  });
});