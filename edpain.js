// Generated by CoffeeScript 1.3.3
(function() {

  $(function() {
    var addPain, anotherPain, appendMorePains, extractPain, fontResizer, footer, footerWaypointOpts, forceReset, geocoder, getFacebookShareUrl, getTwitterShareUrl, loadMorePains, lock, painDisplayTemplate, painEntry, painExtraTemplate, postPain, postPainEntry, resetAndScrollToPainEntry, selector, showPostButton, socket, togglePainOpen, updateServerWithPain, win, zipToCityState, _i, _len, _ref;
    forceReset = function() {
      var body;
      body = $("body");
      if (body.css("-webkit-transform" === "translateZ(1px)")) {
        return body.css("-webkit-transform", "none");
      } else {
        return body.css("-webkit-transform", 'translateZ(1px)');
      }
    };
    win = $(window);
    fontResizer = function($el, scale) {
      var resize;
      resize = function() {
        return $el.css('font-size', win.width() / scale);
      };
      resize();
      return win.on('resize', resize);
    };
    fontResizer($("#subHeader h1"), 6.0);
    fontResizer($("#subHeader p"), 42.0);
    fontResizer($("#description"), 35.0);
    fontResizer($("#painEntry"), 37.0);
    fontResizer($("#pains"), 22.0);
    fontResizer($("#postPainEntry"), 40.0);
    fontResizer($("body > header"), 60.0);
    $("#painEntry .role").keyup(function() {
      var val, _ref;
      val = $(this).val();
      if ((val != null ? val.length : void 0) > 0 && ((_ref = val.substr(0, 1).toLowerCase()) === "a" || _ref === "e" || _ref === "i" || _ref === "o" || _ref === "u")) {
        return $("#painEntry .pluralRole").css("visibility", "visible");
      } else {
        return $("#painEntry .pluralRole").css("visibility", "hidden");
      }
    });
    showPostButton = function() {
      var post, _ref, _ref1, _ref2, _ref3;
      post = $("#painEntry .post");
      if ((3 <= (_ref = (_ref1 = $("#painEntry textarea").val()) != null ? _ref1.length : void 0) && _ref <= 300) && ((_ref2 = $("#painEntry .role").val()) != null ? _ref2.length : void 0) > 0 && ((_ref3 = $("#painEntry .zip").val()) != null ? _ref3.length : void 0) === 5 && !isNaN(Number(zip))) {
        if (post.css("visibility" === "hidden")) {
          return post.hide().css("visibility", "visible".fadeIn());
        }
      } else {
        return post.css("visibility", "hidden");
      }
    };
    _ref = ["#painEntry .role", "#painEntry .role", "#painEntry .zip"];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      selector = _ref[_i];
      $(selector).keyup(showPostButton).blur(showPostButton);
    }
    geocoder = new google.maps.Geocoder;
    zipToCityState = function(zip, callback) {
      return geocoder.geocode({
        'address': zip + ", USA"
      }, function(results, status) {
        var a, result, _j, _len1, _ref1;
        _ref1 = results != null;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          result = _ref1[_j];
          if (result.types[0] === "postal_code") {
            a = result.formatted_address;
            if (a.indexOf(zip + ", USA") >= 0) {
              a = a.substr(0, a.indexOf(zip) - 1);
            }
            callback(a);
          }
        }
        if (!((results != null ? results.length : void 0) > 0)) {
          return callback(zip);
        }
      });
    };
    painDisplayTemplate = _.template($("#painDisplayTemplate").text());
    painExtraTemplate = _.template($("#painExtraTemplate").text());
    painEntry = $("#painEntry");
    postPainEntry = $("#postPainEntry");
    togglePainOpen = function(el) {
      var extra, tmpl;
      extra = el.data("extra");
      if (el.hasClass("open")) {
        if (extra != null) {
          extra.remove();
        }
      } else {
        tmpl = $(painExtraTemplate());
        el.append(tmpl).data("extra", tmpl);
        tmpl.hide().fadeIn("slow");
        forceReset();
      }
      return el.toggleClass("open");
    };
    $("#pains").on("click", "li", function() {
      return togglePainOpen($(this));
    });
    addPain = function(data, isPrepended) {
      var a;
      a = $(painDisplayTemplate(data));
      if (isPrepended) {
        a.prependTo($("#pains ul"));
      }
      if (!isPrepended) {
        a.appendTo($("#pains ul"));
      }
      a.hide();
      a.fadeIn('slow');
      return a.data("painData", data);
    };
    updateServerWithPain = function(data, callback) {
      return $.ajax({
        type: "POST",
        url: "/json/pains",
        beforeSend: function(jqXHR) {
          jqXHR.setRequestHeader('x-csrf-token', $("meta[name='csrf_token']").attr("content"));
          return true;
        },
        'data': JSON.stringify(data),
        processData: false,
        contentType: "application/json",
        dataType: "json",
        success: function(data) {
          return callback(true, data[0]);
        },
        error: function() {
          return callback(false, arguments);
        }
      });
    };
    extractPain = function(callback) {
      var data, name;
      name = painEntry.find(".name".val());
      data = {
        role: painEntry.find(".role".val()),
        'pain': painEntry.find("textarea".val()),
        name: name != null ? name : "",
        zip: painEntry.find(".zip".val())
      };
      return zipToCityState(data.zip, function(cityState) {
        data.cityState = cityState;
        return callback(data);
      });
    };
    postPain = function() {
      var _this = this;
      if (this.deactivated) {
        return;
      }
      this.deactivated = true;
      return extractPain(function(painIn) {
        return updateServerWithPain(painIn, function(success, painOut) {
          if (success) {
            painEntry.fadeOut('slow', function() {
              return postPainEntry.fadeIn('slow');
            });
          }
          return _this.deactivated = false;
        });
      });
    };
    painEntry.find(".post").on("click", postPain);
    resetAndScrollToPainEntry = function() {
      painEntry.find("textarea").val("");
      showPostButton();
      window.scrollTo(0, $("#pains")[0].offsetTop);
      return painEntry.fadeIn('slow');
    };
    anotherPain = function() {
      if (postPainEntry.is(":visible")) {
        return postPainEntry.fadeOut('slow', function() {
          return resetAndScrollToPainEntry();
        });
      } else {
        return resetAndScrollToPainEntry();
      }
    };
    postPainEntry.find(".back").click(anotherPain).waypoint(function(e, dir) {
      return $(this).toggleClass("sticky", dir === "down");
    });
    getTwitterShareUrl = function(text) {
      var url;
      url = "https://twitter.com/intent/tweet";
      url += "?url=" + encodeURI("http://edpain.digitalharborfoundation.org");
      url += "&text=" + "%23edpain%20%E2%80%9C";
      if (text.length <= 109) {
        url += text + '%E2%80%9D';
      } else {
        url += text.substr(0, 109) + "%E2%80%A6";
      }
      return url;
    };
    getFacebookShareUrl = function(text, userString) {
      var url;
      url = "http://www.facebook.com/dialog/feed";
      url += "?link=" + encodeURI("http://edpain.digitalharborfoundation.org");
      url += "&app_id=366391053434145";
      url += "&name=%23edpain";
      url += "&caption=" + encodeURI(userString);
      url += "&picture=" + encodeURI("http://www.digitalharborfoundation.org/dhf_logo.png");
      url += "&redirect_uri=" + encodeURI("http://edpain.digitalharborfoundation.org");
      url += "&description=" + encodeURI(text);
      return url;
    };
    $("#pains").on("click", "button.twitter", function(e) {
      var li, newwindow, text, url;
      li = $(this).closest("li");
      text = li.find("q").text();
      url = getTwitterShareUrl(text);
      newwindow = window.open(url);
      if (window.focus) {
        newwindow.focus();
      }
      return e.stopPropagation();
    }).on("click", "button.facebook", function(e) {
      var li, newwindow, text, url, userString;
      li = $(this).closest("li");
      text = li.find("q").text();
      userString = li.find("cite").text();
      url = getFacebookShareUrl(text, userString);
      newwindow = window.open(url);
      if (window.focus) {
        newwindow.focus();
      }
      return e.stopPropagation();
    });
    appendMorePains = function(callback) {
      var lastEntry;
      lastEntry = $("#pains li:last-child").data("painData");
      return $.ajax({
        url: "/json/pains" + (lastEntry ? "?lastDate=" + lastEntry.date : ""),
        dataType: "json",
        success: function(data) {
          var pain, _j, _len1;
          for (_j = 0, _len1 = data.length; _j < _len1; _j++) {
            pain = data[_j];
            if (pain.cityState != null) {
              addPain(pain(false));
            } else {
              zipToCityState(pain.zip(function(cityState) {
                pain.cityState = cityState;
                return addPain(pain, false);
              }));
            }
          }
          return callback(data);
        }
      });
    };
    footer = $("body > footer");
    lock = false;
    footerWaypointOpts = {
      offset: '100%'
    };
    loadMorePains = function() {
      var button, p;
      if (!lock) {
        lock = true;
        footer.waypoint('remove');
        button = footer.find("button").hide();
        p = footer.find("p");
        p.show();
        return appendMorePains(function(data) {
          if (data.length < 10) {
            return p.html("You have reached the last #edpain.");
          } else {
            lock = false;
            footer.waypoint(footerWaypointOpts);
            return p.fadeOut(function() {
              return button.fadeIn();
            });
          }
        });
      }
    };
    footer.waypoint(loadMorePains, footerWaypointOpts.find("button").click(loadMorePains));
    socket = io.connect();
    return socket.on('newPain', function(data) {
      return addPain(data, true);
    });
  });

}).call(this);
