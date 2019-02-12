'use strict';
/*global Highcharts*/

const asyncFetch = async (url) => {
  let response = await fetch(url)
  return (response.ok) ? await response.json() : { msg: 'error fetching' }
};

let arr1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const gt = (nr) => {
  return elem => elem > nr;
}

const lt = (nr) => {
  return elem => elem < nr;
}

const between = (nr1, nr2) => {
  return elem => elem > nr1 && elem < nr2;
}

const matches = (prop, val) => {
  return x => x[prop] && x[prop] === val;
}

const and = (f1, f2) => {
  return (x) => f1(x) && f2(x);
}

const or = (f1, f2) => (x) => f1(x) || f2(x);

let gt4 = gt(4)
let between4and8 = between(4, 8)

let filters = [gt4, between4and8];

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

let arr2 = update(filters, arr1)

/**
 * 
 * @param {Array} arr - Array of Objects
 * @param {String} prop - prop to group by
 * @param {String} sumProp - prop to summarize values for, if not provided 
 *         this works as a count
 */

const groupBy = (prop, sumProp) => { // chnage this to return function that 
  //groups per industy which can be fired upon an array. Later to be concatenated 
  // with something that the prop that needs to be summed. Like revenue.
  // select (count(x), sum(x.revenue)) from data group by x.industry 
  return (arr) => {
    let obj = {}
    arr.forEach((x) => {
      let v = x[prop];
      // count occurences when there´s no sumProp
      let s = x[sumProp] || 1;
      v && obj[v] ? obj[v] = obj[v] + s : obj[v] = s;
    });
    return obj;
  }
}

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

    // update bindings; 
    //TODO: is it setting also the element that triggert the update?
    bindings.forEach((b) => {
      // if supplied run callback on val parameter
      let v = b.callback ? b.callback(val) : val;
      b.elem[b.prop] = v;
    });

    // update views with new data
    views.forEach((view) => view.data = val);

    vizs.forEach((viz) => viz(val))

    value = val;
  }

  this.getter = function () {
    console.log('this', this, this.filter)
    return value;
  }

  Object.defineProperty(model, 'data', {
    get: this.getter,
    set: this.setter
  })

  model.getFilter = function () {
    return this.filter;
  }

  model.getGroup = function () {
    return this.group;
  }

  // TODO: if prop isn't set then apply callback
  // TODO: unused method in demo
  model.addBinding = function (element, prop, eventType, callback) {
    element.addEventListener(eventType, function () {
      self.setter(element[prop])
    })
    bindings.push({ elem: element, prop: prop, callback: callback });
    element[prop] = value;
    return this;
  }

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
    self.setter(baseData)
    return this;
  }

  model['data'] = data;
  return model;
}

document.addEventListener('DOMContentLoaded', () => {

  /**
   * Function for setting up the dashboard with the data passed in
   * @param {*} data 
   */
  const setupDataViz = (data) => {

    let ds = new Datasource(data);

    //let stateIsIl = matches('state_s', 'IL');
    //let stateIsWI = matches('state_s', 'WI');
    //let wiOrIl = or(stateIsIl, stateIsWI);

    let mapData = new Datasource(ds.data)
      //.setFilter(wiOrIl)
      .setGrouping(groupBy('state_s', 'growth'));
    ds.addView(mapData);
    //ds.setFilter(stateIsWI);

    let groupByIndustry = groupBy('industry');
    let industryData = new Datasource(ds.data)
      .setGrouping(groupByIndustry);
    // function setting series.setData
    ds.addView(industryData);
    //let groupByIndustryData = groupByIndustry(ds.data);
    //ds.setGrouping(groupByIndustry);

    let mapDataByState = toHighmapsFormat(mapData.data);

    // console.log(mapDataByState);
    // let groupByIndustry = groupBy(data,'industry', 'revenue');
    // console.log(groupByIndustry);
    // built industry predicate first

    // set toggle for the group by
    // TODO: these are removed when we do a map point select?
    document.querySelectorAll('input[type=radio]').forEach(
      (x) => x.addEventListener('change', (e) => {
        let groupingMap = groupBy('state_s', e.target.value === 'count' ? undefined : e.target.value)
        mapData.setGrouping(groupingMap);
        
        let groupingIndustry = groupBy('industry', e.target.value === 'count' ? undefined : e.target.value)
        industryData.setGrouping(groupingIndustry);
      }));

    //let softwarePred = matches('industry', 'Software');
    //let statePred = matches('state_l', 'Wisconsin');
    //let softwareInWisconsin = and(softwarePred, statePred);
    //console.log(data.filter(softwareInWisconsin));

    // column chart
    let categories = Highcharts.chart('column', {
      title: {
        text: 'Industries'
      },
      xAxis: {
        categories: Object.keys(industryData.data)
      },
      series: [{
        type: 'column',
        data: Object.values(industryData.data)
      }]
    })
    // map
    let map = Highcharts.mapChart("map", {

      chart: {
        map: 'countries/us/us-all',
        borderWidth: 1
      },
      legend: {
        layout: "vertical",
        align: "right",
        verticalAlign: "middle"
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
          },
          events: {
            click: function () {
              console.log(arguments)
            }
          }
        }
      },

      series: [
        {
          allowPointSelect: true,
          point: {
            events: {
              select: function () {
                console.log(this,  'was last selected');
                let stateFilter = matches('state_s', this["hc-key"]);
                //industryData.setFilter(stateFilter);
                debugger
                ds.setFilter(stateFilter);
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

      drilldown: {
        activeDataLabelStyle: {
          color: "#FFFFFF",
          textDecoration: "none",
          textOutline: "1px #000000"
        },
        drillUpButton: {
          relativeTo: "spacingBox",
          position: {
            x: 0,
            y: 60
          }
        }
      },
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
    mapData.bindViz((d) => map.series[0].setData(toHighmapsFormat(d)));
    // bind industry column chart
    industryData.bindViz((d) => {
      categories.axes[0].setCategories(Object.keys(d))
      categories.series[0].setData(Object.values(d));
    })

  } // setupDataViz

  /*var groupBy = function(xs, key) {
    return xs.reduce(function(rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };*/

  asyncFetch('/js/inc5000-2018.json')
    .then((d) => setupDataViz(d))
    .catch((err) => console.log(err));

}, false);


var formInput = document.getElementById("inp");




//let t1 = datasource([0,1,2])
let t2 = new Datasource(10)

//console.log('t1', t1.hello())
//console.log('t2', t2.hello())

//t1.data = [0,1,3];
t2.data = 1;
let input1 = document.getElementById("myText1");
let input2 = document.getElementById("myText2");
let inputStart = document.getElementById("start");
let inputCow = document.getElementById("cowbell");

t2.addBinding(input1, 'value', 'keyup')
  .addBinding(input2, 'value', 'keyup')
  .addBinding(inputStart, 'value', "input")
  .addBinding(inputCow, 'value', "input", function (val) {
    return val / 5;
  });


