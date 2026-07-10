$(window).on('load', function() {

  var documentSettings = {};
  var markerLayer = L.layerGroup().addTo(map);

  // Some constants, such as default settings
  const CHAPTER_ZOOM = 15;

  // First, try reading Options.csv
  /*$.get('csv/Options.csv', function(options) {

    $.get('csv/Journey.csv', function(options) {

      $.get('csv/Chapters.csv', function(chapters) {
        initMap(
          $.csv.toObjects(options),
          $.csv.toObjects(journeys),
          $.csv.toObjects(chapters)
        )
      })}).fail(function(e) { alert('Found Options.csv, but could not read Chapters.csv') });

  // If not available, try from the Google Sheet
  }).fail(function(e) {*/

    var parse = function(res) {
      return Papa.parse(Papa.unparse(res.values), {header: true} ).data;
    }

    // First, try reading data from the Google Sheet
    if (typeof googleDocURL !== 'undefined' && googleDocURL) {

      if (typeof googleApiKey !== 'undefined' && googleApiKey) {

        var apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/'
        var spreadsheetId = googleDocURL.split('/d/')[1].split('/')[0];

        if (location.hash) {
          var name = location.hash.substr(1);
          $.when(
            $.getJSON(apiUrl + spreadsheetId + '/values/Options?key=' + googleApiKey),
            $.getJSON(apiUrl + spreadsheetId + '/values/' + name + '?key=' + googleApiKey),
          ).then(function(options, chapters) {
            createDocumentSettings(parse(options[0]));
            initMap();
            initJourney(parse(chapters[0]));
          }).fail(function() { 
            location.hash = '';
            location.reload();
          })
        } else {
          $.when(
            $.getJSON(apiUrl + spreadsheetId + '/values/Options?key=' + googleApiKey),
            $.getJSON(apiUrl + spreadsheetId + '/values/Journey?key=' + googleApiKey),
          ).then(function(options, journey) {
            createDocumentSettings(parse(options[0]));
            initMap();
            initSummury(parse(journey[0]));
          })
        }

      } else {
        alert('You load data from a Google Sheet, you need to add a free Google API key')
      }

    } else {
      alert('You need to specify a valid Google Sheet (googleDocURL)')
    }

  //})

  $(window).on('hashchange', function() {
    var page = location.hash;
  
    $('div.loader').css('visibility', 'visible');    
    markerLayer.clearLayers();
  
    if (location.hash) {
      var name = location.hash.substr(1);
      $.when(
        $.getJSON(apiUrl + spreadsheetId + '/values/' + name + '?key=' + googleApiKey),
      ).then(function(chapters) {
        initJourney(parse(chapters));
      }).fail(function() { 
        //location.hash = '';
        //location.reload();
      })
    } else {
      $.when(
        $.getJSON(apiUrl + spreadsheetId + '/values/Journey?key=' + googleApiKey),
      ).then(function(journey) {
        initSummury(parse(journey));
      })
    }
  });


  /**
  * Reformulates documentSettings as a dictionary, e.g.
  * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
  */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    var basemap = trySetting('_tileProvider', 'Stamen.TonerLite');
    if (basemap == "Google.MapApi") {
      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 18,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(map);
    } else {
      L.tileLayer.provider(basemap, {
        maxZoom: 18,
        
        // Pass the api key to most commonly used parameters
        apiKey: trySetting('_tileProviderApiKey', ''),
        apikey: trySetting('_tileProviderApiKey', ''),
        key: trySetting('_tileProviderApiKey', ''),
        accessToken: trySetting('_tileProviderApiKey', '')
      }).addTo(map);
    }
  }
  
  function addMarkers(chapters) {
    var content;
    var chapterCount = 0; 
    var markers = [];
    //var latLngs = [];

    for (i in chapters) {

      var c = chapters[i];
      var lat = parseFloat(c['Latitude']);
      var lon = parseFloat(c['Longitude']);

      if (!isNaN(lat) && !isNaN(lon)) {
        if (c['Marker'] === 'Numbered') {
          chapterCount += 1;
          content = String(chapterCount);
        } else if (c['Marker'] === 'Plain') {
          content = '';
        } else if (c['Marker'] !== '' && Number.isInteger(+c['Marker'])) {
          chapterCount = +c['Marker'];
          content = String(chapterCount);
        } else {
          content = c['Marker']
        }

        let m = L.marker([lat, lon], {
          icon: L.ExtraMarkers.icon({
            icon: 'fa-number',
            number: content, 
            markerColor: c['Marker Color'] || 'blue'
          }),
          opacity: c['Marker'] === 'Hidden' ? 0 : 0.9,
          interactive: c['Marker'] === 'Hidden' ? false : true,
        });

        if (c['Location'] && c['Marker'] != "Hidden") {
          m['_mapLink'] = 'https://www.google.com/maps/search/?api=1&query=' +  c['Location'] + '&center=' + c['Latitude'] + ',' + c['Longitude'];
        }
        
        /*if (c['Marker'] != 'Hidden') {
          latLngs.push([lat, lon]);
        }*/
        markers.push(m);
      } else {
        markers.push(null);
      }
    }

    /*routeLine = L.polyline(latLngs, {
      color: 'blue',
      weight: 5,
      opacity: 0.8,
      snakingSpeed: 200
    }).addTo(map);
    routeLine.snakeIn();*/
    return markers;
  }

  function addChapters(chapters) {
    for (i in chapters) {

      var c = chapters[i];

      // Add chapter container
      var container = $('<div></div>', {
        id: 'container' + i,
        class: 'chapter-container'
      });


      // Add media and credits: YouTube, audio, or image
      var media = null;
      var mediaGroup = $();
      var mediaContainer = null;

      // Add media source
      var source = '';
      if (c['Media Credit Link']) {
        source = $('<a>', {
          text: c['Media Credit'],
          href: c['Media Credit Link'],
          target: "_blank",
          class: 'source'
        });
      } else {
        source = $('<span>', {
          text: c['Media Credit'],
          class: 'source'
        });
      }

      for (link of c['Media Link'].split('\n')) {
        // YouTube
        if (link.indexOf('youtube.com/') > -1 || link.indexOf('preview') > -1) {
          media = $('<iframe></iframe>', {
            src: link,
            width: '100%',
            height: '100%',
            frameborder: '0',
            allow: 'autoplay; encrypted-media',
            allowfullscreen: 'allowfullscreen',
          });

          mediaContainer = $('<div></div>', {
            class: 'img-container'
          }).append(media).after(source);
          break;
        }

        // If not YouTube: either audio or image
        var mediaTypes = {
          'jpg': 'img',
          'jpeg': 'img',
          'png': 'img',
          'tiff': 'img',
          'gif': 'img',
          'mp3': 'audio',
          'ogg': 'audio',
          'wav': 'audio',
        }

        var [url, title] = link.split(/ (.*)/s);
        var mediaExt = url ? url.split('.').pop().toLowerCase() : '';
        var mediaType = mediaTypes[mediaExt];

        if (url.indexOf('drive.google.com/') > -1) {
          mediaType = 'img';
        }

        if (mediaType) {
          var media = $('<' + mediaType + '>', {
              controls: mediaType === 'audio' ? 'controls' : '',
              alt: c['Chapter']
            });
          /* Only render the first media */
          if (mediaGroup.length == 0) {
            media.attr('src', url);
          } else {
            media.attr('data-src', url).css('display', 'none');
          }

          if (mediaType === 'img') {
            var lightboxWrapper = $('<a></a>', {
              'data-lightbox': "gallery-" + i,
              'href': url,
              'data-title': title ? title : c['Chapter'],
              'data-alt': c['Chapter'],
            });
            media = lightboxWrapper.append(media);
            mediaGroup = mediaGroup.add(media);
          }
        }
      }

      if (mediaGroup.length) {
        mediaContainer = $('<div></div', {
          class: mediaType + '-container'
        }).append(mediaGroup.length > 1 ? $('<i class="material-icons">collections</i>') : '')
          .append(mediaGroup)
          .after(source)
          .one("click", function() {
            /* Load and cache img */
            $(this).find('img').each(function() {
              var realUrl = $(this).attr('data-src');
              if (realUrl) {
                $(this).attr('src', realUrl);
                $(this).removeAttr('data-src');
              }
            });
        });
      }

      container
        .append('<p class="chapter-header">' + c['Chapter'] + '</p>')
        .append(mediaContainer != null ? mediaContainer : '')
        .append(mediaContainer != null ? source : '')
        .append('<p class="description">' + c['Description'] + '</p>');

      $('#chapters').append(container);

    }
  }

  function addOverlay(c) {
    // Add chapter's overlay tiles if specified in options
    if (c['Overlay']) {

      var opacity = parseFloat(c['Overlay Transparency']) || 1;
      var url = c['Overlay'];

      if (url.split('.').pop() === 'geojson') {
        $.getJSON(url, function(geojson) {
          overlay = L.geoJson(geojson, {
            style: function(feature) {
              return {
                fillColor: feature.properties.fillColor || '#ffffff',
                weight: feature.properties.weight || 1,
                opacity: feature.properties.opacity || opacity,
                color: feature.properties.color || '#cccccc',
                fillOpacity: feature.properties.fillOpacity || 0.5,
              }
            }
          }).addTo(map);
        });
      } else {
        overlay = L.tileLayer(c['Overlay'], { opacity: opacity }).addTo(map);
      }

    }
  }

  function addGeoJsonOverlay(c) {
    if (c['GeoJSON Overlay']) {
      $.getJSON(c['GeoJSON Overlay'], function(geojson) {

        // Parse properties string into a JS object
        var props = {};

        if (c['GeoJSON Feature Properties']) {
          var propsArray = c['GeoJSON Feature Properties'].split(';');
          var props = {};
          for (var p in propsArray) {
            if (propsArray[p].split(':').length === 2) {
              props[ propsArray[p].split(':')[0].trim() ] = propsArray[p].split(':')[1].trim();
            }
          }
        }

        geoJsonOverlay = L.geoJson(geojson, {
          style: function(feature) {
            return {
              fillColor: feature.properties.fillColor || props.fillColor || '#ffffff',
              weight: feature.properties.weight || props.weight || 1,
              opacity: feature.properties.opacity || props.opacity || 0.5,
              color: feature.properties.color || props.color || '#cccccc',
              fillOpacity: feature.properties.fillOpacity || props.fillOpacity || 0.5,
            }
          }
        }).addTo(markerLayer);
      });
    }
  }

  function initMap() {
    // Load tiles
    addBaseMap();

    // Add zoom controls if needed
    if (getSetting('_zoomControls') !== 'off') {
      L.control.zoom({
        position: getSetting('_zoomControls')
      }).addTo(map);
    }

    changeAttribution();
    /* Generate a CSS sheet with cosmetic changes */
    $("<style>")
      .prop("type", "text/css")
      .html("\
      #narration, #title {\
        background-color: " + trySetting('_narrativeBackground', 'white') + "; \
        color: " + trySetting('_narrativeText', 'black') + "; \
      }\
      a, a:visited, a:hover {\
        color: " + trySetting('_narrativeLink', 'blue') + " \
      }\
      .in-focus {\
        background-color: " + trySetting('_narrativeActive', '#f0f0f0') + " \
      }")
      .appendTo("head");


    endPixels = parseInt(getSetting('_pixelsAfterFinalChapter'));
    if (endPixels > 100) {
      $('#space-at-the-bottom').css({
        'height': (endPixels / 2) + 'px',
        'padding-top': (endPixels / 2) + 'px',
      });
    }

    // Add Google Analytics if the ID exists
    addGoogleAnalytics();

  }

  function initSummury(journeys) {
    $('#chapters').empty();
    
    setTitle(getSetting('_mapTitle'), getSetting('_mapSubtitle'), getSetting('_mapLogo'));

    for (let i in journeys) {
      const j = journeys[i];

      if (!j['Sheet Name']) {
        continue;
      }

      
      $.getJSON('geojson/Untitled.geojson', function(geojson) {
        L.geoJson(geojson, {
          style: function(feature) {
            return {
              fillColor: feature.properties.fillColor ||  'blue',
              weight: feature.properties.weight || 1,
              opacity: feature.properties.opacity || 0.5,
              color: feature.properties.color || 'blue',
              fillOpacity: feature.properties.fillOpacity || 0.5,
            }
          }
        }).addTo(markerLayer);
      });
      

      /* Render the range of this journey. */
      //let x = parseFloat(j['Center Latitude']), y = parseFloat(j['Center Longitude']);
      //let e = L.ellipse([j['Center Latitude'], j['Center Longitude']], [j['Semi-Major Axis'], j['Semi-Minor Axis']], j['Orientation'], {
      //    color: '#3388ff',
      //    weight: 2,
      //    fillColor: '#3388ff',
      //    fillOpacity: 0
      ///*let e = L.imageOverlay(j['Storymap Logo'], [[x-0.1, y-0.1], [x+0.1, y+0.1]], {
      //  opacity: 0.8, // Set transparency level
      //  alt: 'Custom Map Overlay'*/
      //}).on('click', function() {   
      //  location.hash = j['Sheet Name'];
      //}).addTo(markerLayer);
    }
    map.setView(L.latLng(38.7207182,135.7390919), 6);

    $('#map, #narration, #title').css('visibility', 'visible');
    $('div.loader').css('visibility', 'hidden');
  }

  function initJourney(chapters) {
    $('#chapters').empty();
  
    let title = chapters.shift()
    setTitle(title['Chapter'], title['Description'], title['Media Link']);
    
    const chapterContainerMargin = 70;
    var pixelsAbove = [];

    var currentlyInFocus; // integer to specify each chapter is currently in focus
    var overlay;  // URL of the overlay for in-focus chapter
    var geoJsonOverlay;

    markers = addMarkers(chapters);
    addChapters(chapters);

    var markActiveColor = function(k) {
      /* Removes marker-active class from all markers */
      for (var i = 0; i < markers.length; i++) {
        if (markers[i] && markers[i]._icon) {
          markers[i]._icon.className = markers[i]._icon.className.replace(' marker-active', '');

          if (i == k) {
            /* Adds marker-active class, which is orange, to marker k */
            markers[k]._icon.className += ' marker-active';
          }
        }
      }
    }

    // For each block (chapter), calculate how many pixels above it
    pixelsAbove[0] = -100;
    for (i = 1; i < chapters.length; i++) {
      pixelsAbove[i] = pixelsAbove[i-1] + $('div#container' + (i-1)).height() + chapterContainerMargin;
    }
    pixelsAbove.push(Number.MAX_VALUE);

    /* Register marker callback */
    var bounds = [];
    for (i in markers) {
      if (markers[i]) {
        markers[i].addTo(markerLayer);
        markers[i]['_pixelsAbove'] = pixelsAbove[i];
        markers[i].on('click', function() {
          var pixels = parseInt($(this)[0]['_pixelsAbove']) + 5;
          $('div#contents').animate({scrollTop: pixels + 'px'});
          if ($(this)[0]._icon.className.includes('marker-active')) {
            window.open($(this)[0]['_mapLink'], '_blank');
          }
        });
        bounds.push(markers[i].getLatLng());
      }
    }
    map.fitBounds(bounds);

    $('div#contents').off('scroll').scroll(function() {
      var currentPosition = $(this).scrollTop();

      // Make title disappear on scroll
      if (currentPosition < 200) {
        $('#title').css('opacity', 1 - Math.min(1, currentPosition / 100));
      }

      for (var i = 0; i < pixelsAbove.length - 1; i++) {

        if ( currentPosition >= pixelsAbove[i]
          && currentPosition < (pixelsAbove[i+1] - 2 * chapterContainerMargin)
          && currentlyInFocus != i
        ) {

          // Update URL hash
          //location.hash = i + 1;

          // Remove styling for the old in-focus chapter and
          // add it to the new active chapter
          $('.chapter-container').removeClass("in-focus").addClass("out-focus");
          $('div#container' + i).addClass("in-focus").removeClass("out-focus");

          currentlyInFocus = i;
          markActiveColor(currentlyInFocus);

          // Remove overlay tile layer if needed
          if (overlay && map.hasLayer(overlay)) {
            map.removeLayer(overlay);
          }

          // Remove GeoJson Overlay tile layer if needed
          if (geoJsonOverlay && map.hasLayer(geoJsonOverlay)) {
            map.removeLayer(geoJsonOverlay);
          }

          var c = chapters[i];

          addOverlay(c);
          addGeoJsonOverlay(c);

          // Fly to the new marker destination if latitude and longitude exist
          if (c['Latitude'] && c['Longitude']) {
            var zoom = c['Zoom'] ? c['Zoom'] : CHAPTER_ZOOM;
            map.flyTo([c['Latitude'], c['Longitude']], zoom, {
              animate: true,
              duration: 2, // default is 2 seconds
            });
          } else if (i == 0) {
            // Fly to map bound if no location be set on chapter header
            map.flyToBounds(bounds, {
              animate: true,
              duration: 2, // default is 2 seconds
            });
          }

          // No need to iterate through the following chapters
          break;
        }
      }
    });

    $('#map, #narration, #title').css('visibility', 'visible');
    $('div.loader').css('visibility', 'hidden');

    // On first load, check hash and if it contains an number, scroll down
    let viewChapter = 0; //parseInt(location.hash.substr(1));
    if (viewChapter && viewChapter != 1) {
      var containerId = viewChapter - 1;
      $('#contents').animate({
        scrollTop: $('#container' + containerId).offset().top
      }, 1000);
    } else {
      $('div#container0').addClass("in-focus");
      $('div#contents').animate({scrollTop: '1px'});
    }
  }

  function setTitle(title, subtitle, logo) {
    document.title = title;
    $('#header').html('<h1>' + (title || '') + '</h1><h2>' + (subtitle || '') + getSetting('_mapBanner'));

    // set logo
    if (logo) {
      $('#top').css('height', '60px');
      $('#logo').html('<img src="' + logo + '" />');
    } else {
      $('#logo').css('display', 'none');
    }
  }

  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'View <a href="'
      // Show Google Sheet URL if the variable exists and is not empty, otherwise link to Chapters.csv
      + (typeof googleDocURL !== 'undefined' && googleDocURL ? googleDocURL : './csv/Chapters.csv')
      + '" target="_blank">data</a>';

    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) { url = 'mailto:' + url; }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    credit += 'View <a href="' + getSetting('_githubRepo') + '">code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;

    $('#logo').on('click', function() {
      location.hash = '';
    });

    $('#to-top').on('click', function() {   
      $('#contents').animate({scrollTop: 0 }, 800);
    });
  }

  function addGoogleAnalytics() {
    var ga = getSetting('_googleAnalytics');
    if ( ga && ga.length >= 10 ) {
      var gaScript = document.createElement('script');
      gaScript.setAttribute('src','https://www.googletagmanager.com/gtag/js?id=' + ga);
      document.head.appendChild(gaScript);

      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', ga);
    }
  }

});
