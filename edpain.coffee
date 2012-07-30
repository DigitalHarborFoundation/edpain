$ ->
  # force chrome to reset (some problems below when inserting content)
  forceReset = ->
    body = $ "body"
    if body.css "-webkit-transform" is "translateZ(1px)"
      body.css "-webkit-transform","none"
    else
      body.css "-webkit-transform",'translateZ(1px)'
  # reflexive layout based on em's
  win = $ window
  fontResizer = ($el, scale) ->
    # simplified version of fittext.js
    resize = ->
      $el.css 'font-size', win.width()/scale
    resize()
    win.on 'resize', resize
  fontResizer $("#subHeader h1"), 6.0
  fontResizer $("#subHeader p"), 42.0
  fontResizer $("#description"), 35.0
  fontResizer $("#painEntry"), 37.0
  fontResizer $("#pains"), 22.0
  fontResizer $("#postPainEntry"), 40.0
  fontResizer $("body > header"), 60.0
  
  # anal a/an solution
  $("#painEntry .role").keyup ->
    val = $(this).val()
    if val?.length > 0 and 
        val.substr(0,1).toLowerCase() in ["a","e", "i", "o", "u"]
      $("#painEntry .pluralRole").css "visibility", "visible"
    else
      $("#painEntry .pluralRole").css "visibility", "hidden"

  # validation that controls if the post button shows
  showPostButton = ->
    post = $ "#painEntry .post"
    if 3 <=  $("#painEntry textarea").val()?.length <= 300 and
        $("#painEntry .role").val()?.length > 0 and 
        $("#painEntry .zip").val()?.length is 5 and 
        not isNaN(Number(zip))
      if post.css "visibility" is "hidden"
        post.hide()
            .css "visibility", "visible"
            .fadeIn()
    else
      post.css "visibility", "hidden"
  for selector in ["#painEntry .role", "#painEntry .role", "#painEntry .zip"]
    $(selector).keyup(showPostButton).blur showPostButton
  
  # convert zip code to city, state
  geocoder = new google.maps.Geocoder
  zipToCityState = (zip, callback) ->
    geocoder.geocode {'address': zip + ", USA"}, (results, status) ->
      for result in results?
        if result.types[0] is "postal_code"
          a = result.formatted_address
          # strip off zip and country if USA
          if a.indexOf(zip + ", USA") >= 0
            a = a.substr(0,a.indexOf(zip)-1)
          callback a
      callback zip unless results?.length > 0
  
  painDisplayTemplate = _.template $("#painDisplayTemplate").text()
  painExtraTemplate = _.template $("#painExtraTemplate").text()
  painEntry = $ "#painEntry"
  postPainEntry = $ "#postPainEntry"

  # toggling of pain open/close
  togglePainOpen = (el) ->
    extra = el.data "extra"
    if el.hasClass "open"
      extra?.remove()
    else
      tmpl = $ painExtraTemplate()
      el.append(tmpl).data "extra", tmpl
      tmpl.hide().fadeIn "slow"
      forceReset()
    el.toggleClass "open"
  $("#pains").on "click", "li", ->
    togglePainOpen($ this)
  
  # displaying a new pain coming in
  addPain = (data, isPrepended) ->
    a = $ painDisplayTemplate data
    a.prependTo ($ "#pains ul") if isPrepended
    a.appendTo ($ "#pains ul") unless isPrepended
    a.hide()
    a.fadeIn('slow')
    a.data "painData", data
  updateServerWithPain = (data, callback) ->
    $.ajax
      type: "POST"
      url:"/json/pains"
      beforeSend: (jqXHR) ->
        jqXHR.setRequestHeader 'x-csrf-token', 
            ($("meta[name='csrf_token']").attr "content")
        true
      'data': JSON.stringify data
      processData: false
      contentType: "application/json"
      dataType: "json"
      success: (data) ->
        callback true, data[0]
      error: ->
        callback false, arguments
  # saving of a pain when posted
  extractPain = (callback) ->
    name = painEntry.find ".name" .val()
    data =
      role: painEntry.find ".role" .val()
      'pain': painEntry.find "textarea" .val()
      name: if name? then name else ""
      zip: painEntry.find ".zip" .val()
    # TODO: optimization: do zip conversion both client 
    # and server side to speed it up!
    zipToCityState data.zip, (cityState) ->
      data.cityState = cityState
      callback data
  postPain = ->
    return if @deactivated
    @deactivated = true
    extractPain (painIn) =>
      updateServerWithPain painIn, (success, painOut) =>
        if success
          # TODO: open relevant pain!
          painEntry.fadeOut 'slow', -> 
            postPainEntry.fadeIn 'slow'
        @deactivated = false;
  painEntry.find(".post").on "click", postPain;

  #When another pain is desired, reset just the pain and scroll to
  resetAndScrollToPainEntry = ->
    painEntry.find("textarea").val "" 
    showPostButton()
    window.scrollTo 0, $("#pains")[0].offsetTop
    painEntry.fadeIn 'slow'
  anotherPain = ->
    if postPainEntry.is ":visible"
      postPainEntry.fadeOut 'slow', ->
        resetAndScrollToPainEntry()
    else
      resetAndScrollToPainEntry()
  postPainEntry.find(".back")
    .click(anotherPain)
    # add sticky class (for fixed) when have another 
    # edpain button goes out of the window
    .waypoint (e,dir) ->
      $(this).toggleClass "sticky", dir is "down"
  
  # share via twitter
  getTwitterShareUrl = (text) ->
    url = "https://twitter.com/intent/tweet"
    url += "?url=" + encodeURI "http://edpain.digitalharborfoundation.org"
    # add #edpain to front and quote it (or end ellipses)
    url += "&text=" + "%23edpain%20%E2%80%9C"
    if text.length <= 109
      url += text + '%E2%80%9D'
    else
      url += text.substr(0,109) + "%E2%80%A6"
    url
  # share via facebook
  getFacebookShareUrl = (text, userString) ->
    url = "http://www.facebook.com/dialog/feed"
    url += "?link=" + encodeURI "http://edpain.digitalharborfoundation.org"
    url += "&app_id=366391053434145"
    url += "&name=%23edpain";
    url += "&caption=" + encodeURI userString
    url += "&picture=" + encodeURI "http://www.digitalharborfoundation.org/dhf_logo.png"
    url += "&redirect_uri=" +  encodeURI "http://edpain.digitalharborfoundation.org"
    url += "&description=" + encodeURI text
    url
  $("#pains")
    .on "click", "button.twitter", (e) ->
      li = $(this).closest "li"
      text = li.find("q").text()
      url = getTwitterShareUrl text
      newwindow = window.open url
      newwindow.focus() if window.focus
      e.stopPropagation()
    .on "click", "button.facebook", (e) ->
      li = $(this).closest "li"
      text = li.find("q").text()
      userString = li.find("cite").text()
      url = getFacebookShareUrl text, userString
      newwindow = window.open(url)
      newwindow.focus() if window.focus
      e.stopPropagation()
  appendMorePains = (callback) ->
    lastEntry = $("#pains li:last-child").data "painData"
    $.ajax
      url: "/json/pains" + (if lastEntry then "?lastDate=" + lastEntry.date else "")
      dataType: "json"
      success: (data) ->
        for pain in data
          if pain.cityState?
            addPain pain false
          else
            zipToCityState pain.zip (cityState) ->
              pain.cityState = cityState
              addPain pain, false
        callback data
  footer = $ "body > footer"
  lock = false
  footerWaypointOpts =
    offset: '100%'
  loadMorePains = ->
    if not lock
      lock = true
      footer.waypoint 'remove'
      button = footer.find("button").hide()
      p = footer.find "p"
      p.show()
      appendMorePains (data) ->
        if data.length < 10
          p.html "You have reached the last #edpain."
        else
          lock = false
          footer.waypoint footerWaypointOpts
          p.fadeOut ->
            button.fadeIn()
  footer.waypoint(loadMorePains, footerWaypointOpts)
    .find("button")
    .click loadMorePains
  socket = io.connect()
  socket.on 'newPain', (data) ->
    addPain data, true