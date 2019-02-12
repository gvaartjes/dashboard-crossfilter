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

  // TODO: if prop isn't set then apply callback
  model.addBinding = function (element, prop, eventType, callback) {
    element.addEventListener(eventType, function () {
      console.log(element[prop])
      self.setter(element[prop])
    })
    bindings.push({ elem: element, prop: prop, callback: callback });
    element[prop] = value;
    return this;
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

  document.querySelectorAll('input[type=radio]').forEach(
    (x) => x.addEventListener('click', (e) => console.log(e))
  );

  const setupDataViz = (data) => {
    console.log('hi')
    console.log(data.length, data);
    console.log(data[2]);

    let ds = new Datasource(data);

    let stateIsIl = matches('state_s', 'IL');
    let stateIsWI = matches('state_s', 'WI');
    let wiOrIl = or(stateIsIl, stateIsWI);

    //let mapData = new Datasource(ds.data);
    //mapData.setFilter(wiOrIl);
    //mapData.setGrouping(groupBy('state_s', 'growth'))
    let mapData = new Datasource(ds.data)
      .setFilter(wiOrIl)
      .setGrouping(groupBy('state_s', 'growth'));

    //mapData.addBinding() // add chart, so chart updates on data change


    //ds.setFilter(wiOrIl); //BOTH WORK, add filter or direct setting ds.data
    //ds.data = update([wiOrIl], ds.data);
    //console.log('added filter')
    //console.log(ds.data);

    //let groupByState = groupBy(ds.data, 'state_s', 'revenue');
    //let groupByState = groupBy(ds.data, 'state_s');
    //let groupByState = groupBy(mapData.data, 'state_s'); // move groupby function 
    
    //let groupByState = groupBy('state_s'); 
    //let groupByStateData = groupByState(mapData.data);


    // function setting series.setData
    let groupByIndustry = groupBy('industry');
    let groupByIndustryData = groupByIndustry(ds.data);

    //let mapDataByState = toHighmapsFormat(groupByStateData)
    let mapDataByState = toHighmapsFormat(mapData.data);

    console.log(mapDataByState);
    //let groupByIndustry = groupBy(data,'industry', 'revenue');
    console.log(groupByIndustry);
    // built industry predicate first

    let softwarePred = matches('industry', 'Software');
    let statePred = matches('state_l', 'Wisconsin');
    let softwareInWisconsin = and(softwarePred, statePred);

    console.log(data.filter(softwareInWisconsin));

    // column chart
    let categories = Highcharts.chart('column', {
      title: {
        text: 'Industries'
      },
      xAxis: {
        categories: Object.keys(groupByIndustryData)
      },
      series: [{
        type: 'column',
        data: Object.values(groupByIndustryData)
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
          //data: [['us-wi',2]],
          //data: [{code:'WI',value: 2}],
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


