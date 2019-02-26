/**
 * Copyright (C) 2019 Gert Vaartjes 
 */

'use strict';
/*global Highcharts*/

const asyncFetch = async (url) => {
  let response = await fetch(url)
  return (response.ok) ? await response.json() : { msg: 'error fetching' }
};

const matches = (prop, val) => {
  return x => x[prop] && x[prop] === val;
}

/**
 * 
 * @param {*} preds an Array of functions that filter the supplied array
 * @param {*} arr 
 */
const update = (preds, arr) => {
  let res = null;
  preds.map(p => {
    (res == null) ? res = arr.filter(p) : res = res.filter(p);
  });
  return res;
}

/**
 * 
 * @param {Array} arr - Array of Objects
 * @param {String} prop - prop to group by
 * @param {String} sumProp - prop to summarize values for, if not provided 
 *         this works as a count
 */

/**
 * 
 * @param {String} groupBy, is the property to group by
 * @param {String} sum, extra property to sum(x), if undefined then do a count(x)
 */
const groupBy = (groupBy, sumProp) => {
  return (arr) => {
    let obj = {}
    arr.forEach((x) => {
      let v = x[groupBy];
      // count occurences when there´s no sumProp
      let s = x[sumProp] || 1;
      v && obj[v] ? obj[v] = obj[v] + s : obj[v] = s;
    });
    return obj;
  }
}

/**
 * 
 * @param {*} obj, convenience function to output dataformat recognized by Highmaps
 */
const toHighmapsFormat = (obj) => {
  let arr = []
  Object.entries(obj).forEach(x => {
    let o = {}
    o['hc-key'] = x[0];
    o.value = x[1];
    arr.push(o);
  });
  return arr;
}

/**
 * 
 * @param {*} data 
 */
function Datasource(data) {
  let self = this;
  let model = {};
  let bindings = [];
  let views = [];
  let vizs = [];
  // The current data, held in value
  let value;
  // so we can revert back to original data
  let baseData = data;

  this.setter = function (val) {
    // if exists, first apply filter
    val = model.filter ? update([model.filter], val) : val;
    // apply group by a field 
    val = model.group ? model.group(val) : val;

    // update views with new data
    views.forEach((view) => view.data = val);

    // update charts with new data
    vizs.forEach((viz) => viz(val))

    value = val;
  }

  this.getter = function () {
    return value;
  }

  Object.defineProperty(model, 'data', {
    get: this.getter,
    set: this.setter
  })

  model.bindViz = function (updateViz) {
    vizs.push(updateViz);
  }

  model.addView = function (datasource) {
    views.push(datasource);
  }

  model.setFilter = function (filter) {
    this.filter = filter;
    // force setting data, with base data
    self.setter(baseData)
    return this;
  }

  model.setGrouping = function (grouping) {
    this.group = grouping;
    // force setting data, with base data
    self.setter(baseData);
    return this;
  }

  model.data = data;
  return model;
}

document.addEventListener('DOMContentLoaded', () => {

  /**
   * Function for setting up the dashboard with the data passed in
   * @param {*} data 
   */
  const setupDataViz = (data) => {

    let ds = new Datasource(data),
    mapData = new Datasource(ds.data)
      .setGrouping(groupBy('state_s', 'growth')), 
    groupByIndustry = groupBy('industry'),
    industryDatasource = new Datasource(ds.data)
      .setGrouping(groupByIndustry),
    slider = document.getElementById('workers'),
    max = data.reduce((acc, cur) => cur.rank > acc ? acc = cur.rank: acc, 0),
    mapDataByState = toHighmapsFormat(mapData.data);

    // bind two new datasources to the master datasource 
    ds.addView(mapData);
    ds.addView(industryDatasource);    
    
    // set slider element to max, which means no filtering with start  
    slider.max = max;
    slider.value = max;
   
    slider.addEventListener("input", (e) =>{
      document.getElementById("workerLabel").innerHTML= (e.target.value);
      ds.setFilter((x) => x.rank < (e.target.value));
    })
   

    // set toggle for the group by
    // TODO: these are removed when we do a map point select?
    document.querySelectorAll('input[type=radio]').forEach(
      (x) => x.addEventListener('change', (e) => {
        let groupingMap = groupBy('state_s', e.target.value === 'count' ? undefined : e.target.value)
        mapData.setGrouping(groupingMap);

        let groupingIndustry = groupBy('industry', e.target.value === 'count' ? undefined : e.target.value)
        industryDatasource.setGrouping(groupingIndustry);
      }));

    // column chart
    let industriesChart = Highcharts.chart('column', {
      chart: {
        borderColor: 'orange',
        borderWidth: 1
      },
      title: {
        text: 'Industries'
      },
      xAxis: {
        categories: Object.keys(industryDatasource.data)
      },
      series: [{
        allowPointSelect: true,
        colorByPoint:  true,
        states: {
          hover: {
            color: '#a4edba'
          },
          select: {
            color: '#EFFFEF',
            borderColor: 'black',
            dashStyle: 'dot'
          }
        },
        point: {
          events: {
            click: function () {
              // can't use the unselect event for resetting filter, because the unselect 
              // fires after the select/click event. This would reset the filter again in
              // case of selecting another point
              let deselect = this.series.chart.getSelectedPoints().reduce(
                (acc, curr) => acc || curr.category === this.category
                , false
              );
              let industryFilter = matches('industry', this.category);
              mapData.setFilter(deselect ? undefined : industryFilter);
              usaMap.title.update({ text: (deselect ? 'Industries in the U.S.' : this.category + ' in the U.S.') });
            }
          }
        },
        type: 'column',
        data: Object.values(industryDatasource.data)
      }]
    })

    // map
    let usaMap = Highcharts.mapChart("map", {

      chart: {
        map: 'countries/us/us-all',
        borderWidth: 1,
        borderColor: 'orange'
      },
      legend: {
        layout: "vertical",
        align: "right",
        verticalAlign: "middle"
      },
      title: {
        text: 'USA'
      },

      colorAxis: {
        min: 0,
        minColor: "#E6E7E8",
        maxColor: "#005645"
      },

      mapNavigation: {
        enabled: true,
        buttonOptions: {
          verticalAlign: "bottom"
        }
      },

      plotOptions: {
        map: {
          states: {
            hover: {
              color: "#EEDD66"
            }
          }
        }
      },
      series: [
        {
          allowPointSelect: true,
          states: {
            hover: {
              color: '#a4edba'
            },
            select: {
              color: '#EFFFEF',
              borderColor: 'black',
              dashStyle: 'dot'
            }
          },
          point: {
            events: {
              click: function () {
                let deselect = this.series.chart.getSelectedPoints().reduce(
                  (acc, curr) => acc || curr['hc-key'] === this['hc-key']
                  , false
                );
                
                let stateFilter = matches('state_s', this['hc-key']);
                industryDatasource.setFilter(deselect ? undefined : stateFilter);
                industriesChart.title.update({ text: 'Industries in ' + (deselect ? 'the U.S.' : this['hc-key']) });
              }
            }
          },
          data: mapDataByState,
          joinBy: ['postal-code', 'hc-key'], // should be otherway around
          name: "USA",
          dataLabels: {
            enabled: true,
            format: "{point.properties.postal-code}"
          }
        },
        {
          type: "mapline",
          data: Highcharts.geojson(Highcharts.maps["countries/us/us-all"], "mapline"),
          color: "silver",
          enableMouseTracking: false,
          animation: {
            duration: 500
          }
        }
      ],
      responsive: {
        rules: [{
          condition: {
            maxWidth: 600
          },
          chartOptions: {
            legend: {
              align: 'center',
              verticalAlign: 'bottom',
              layout: 'horizontal'
            }
          }
        }]
      }
    });

    // bind charts, works only with one series per chart and one
    // bind map
    mapData.bindViz((d) => usaMap.series[0].setData(toHighmapsFormat(d)));
    // bind industry column chart
    industryDatasource.bindViz((d) => {
      industriesChart.axes[0].setCategories(Object.keys(d))
      industriesChart.series[0].setData(Object.values(d));
    })
  }

  asyncFetch('/js/inc5000-2018.json')
    .then((d) => setupDataViz(d))
    .catch((err) => console.log(err));

}, false);
