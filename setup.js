//====================================================================
var theMap;
var mapMaxZoom = 10;

var xf;

//====================================================================
$(document).ready(function() {

  d3.tsv("ACCLIMATE_CoreList_20160418.tsv", function(data) {
    data.forEach(function(d, i) {
          d.Longitude = +d.Longitude;
          d.Latitude = +d.Latitude;
          d.Depth = +d.Depth;
          d.Id = i+1;
  
  	// Limit latitudes according to latitude map range (-85:85)
          if (d.Latitude < -85) d.Latitude = -85;
          if (d.Latitude > 85) d.Latitude = 85;
    });

    initCrossfilter(data);
  
    theMap = mapChart.map();

    new L.graticule({ interval: 10, style: { color: '#333', weight: 0.5, opacity: 1. } }).addTo(theMap);
    new L.Control.MousePosition({lngFirst: true}).addTo(theMap);
    new L.Control.zoomHome({homeZoom: 2, homeCoordinates: [45, -20]}).addTo(theMap);
  
    mapmadeUrl = 'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
    mapmade = new L.TileLayer(mapmadeUrl, { maxZoom: mapMaxZoom+1});
    new L.Control.MiniMap(mapmade, { toggleDisplay: true, zoomLevelOffset: -4 }).addTo(theMap);

    $('.leaflet-control-zoomhome-home')[0].click();

    $('#chart-table').on('click', '.dc-table-column', function() {
      id = d3.select(this.parentNode).select(".dc-table-column._0").text();
      dataTable.filter(id);
      dc.redrawAll();
    });

    $('#chart-table').on('mouseover', '.dc-table-column', function() {
      // displays popup only if text does not fit in col width
      if (this.offsetWidth < this.scrollWidth) {
        d3.select(this).attr('title', d3.select(this).text());
      }
    });

  });

});

//====================================================================
function initCrossfilter(data) {

  //-----------------------------------
  xf = crossfilter(data);

  //-----------------------------------
  mapDim = xf.dimension(function(d) { return [d.Latitude, d.Longitude, d.Id]; });
  mapGroup = mapDim.group();

  //-----------------------------------
  tableDim = xf.dimension(function(d) { return +d.Id; });

  //-----------------------------------
  customMarker = L.Marker.extend({
    options: { 
      Id: 'Custom data!'
   }
  });

  iconSize = [32,32];
  iconAnchor = [16,32];
  popupAnchor = [0,-32];

  mapChart  = dc.leafletMarkerChart("#chart-map");

  mapChart
      .width(1000)
      .height(300)
      .dimension(mapDim)
      .group(mapGroup)
      .center([45, -19])    // slightly different than zoomHome to have a info updated when triggered
      .zoom(2)         
      .tiles(function(map) {			// overwrite default baselayer
	   return L.tileLayer(
                'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
                { attribution: 'LSCE &copy; 2016 | Baselayer &copy; ArcGis' }).addTo(map); 
      })
      .mapOptions({maxZoom: mapMaxZoom, zoomControl: false})
      .fitOnRender(false)
      .filterByArea(true)
      .cluster(true) 
      .clusterOptions({maxClusterRadius: 50, showCoverageOnHover: false, spiderfyOnMaxZoom: true})
      .title(function() {})  
      .popup(function(d,marker) {
        	id = d.key[2] -1;
        	popup = L.popup({autoPan: false, closeButton: false});
        	popup.setContent( "Id: " + "<b>" + data[id].Id + "</b></br>" 
				+ "Core: " + "<b>" +  data[id].Core + "</b></br>"
				+ "Position: " + "<b>" + data[id].Longitude.toFixed(2) + "°E</b>, <b>" + data[id].Latitude.toFixed(2) + "°N</b></br>"
				+ "Depth (m): " + "<b>" +  data[id].Depth.toFixed(2) + "</b></br>");
        	return popup;
      })
      .popupOnHover(true)
      .marker(function(d,map) {
        	id = d.key[2] -1;
        	icon = L.icon({ iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor, iconUrl: 'img/marker_Ice.png' });
        	marker = new customMarker([data[id].Latitude, data[id].Longitude], {Id: (id+1).toString(), icon: icon});
                marker.on('mouseover', function(e) {
        		iconUrlNew = e.target.options.icon.options.iconUrl.replace(".png","_highlight.png");
        		iconNew = L.icon({ iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor, iconUrl: iconUrlNew });
        		e.target.setIcon(iconNew);
        		d3.selectAll(".dc-table-column._0")
        			.text(function (d, i) {
        		     		if (parseInt(d.Id) == e.target.options.Id) {
        					this.parentNode.scrollIntoView();
        		                 	d3.select(this.parentNode).style("font-weight", "bold");
        		               	}
        		     		return d.Id;
        	        	});
        	});
                marker.on('mouseout', function(e) {
        		iconUrlNew = e.target.options.icon.options.iconUrl.replace("_highlight.png", ".png");
        		iconNew = L.icon({ iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor, iconUrl: iconUrlNew });
        		e.target.setIcon(iconNew);
        		d3.selectAll(".dc-table-column._0")
        			.text(function (d, i) {
        		     		if (parseInt(d.Id) == e.target.options.Id) {
        		                 	d3.select(this.parentNode).style("font-weight", "normal");
        		               	}
        		     		return d.Id;
        	        	});
        	});
        	return marker;
      });

//-----------------------------------
  dataCount = dc.dataCount('#chart-count');

  dataCount 
        .dimension(xf)
        .group(xf.groupAll())
        .html({
            some: '<strong>%filter-count</strong> selected out of <strong>%total-count</strong> records',
            all: 'All records selected. Please zoom on the map or click on the table to apply filters.'
        });

//-----------------------------------
  dataTable = dc.dataTable("#chart-table");

  format1 = d3.format(".0f");
  format2 = d3.format(".2f");

  dataTable
    .dimension(tableDim)
    .group(function(d) {})
    .showGroups(false)
    //.size(10)
    .size(xf.size()) //display all data
    .columns([
      function(d) { return d.Id; },
      function(d) { return d.Core; },
      function(d) { return format1(d.Depth); },
      function(d) { if (d.Comments) return d.Comments; 
		    else return "&nbsp;";},
      function(d) { if (d.Reference) return d.Reference; 
		    else return "&nbsp;";}
    ])
    .sortBy(function(d){ return +d.Id; })
    .order(d3.ascending);

  //-----------------------------------
  dc.renderAll();

}

//====================================================================
