// aes is an object literal with 
// x, y, yintercept, xintercept, shape, size, 
// color, etc.
function Plot(aes) {
  var attributes = {
    data: null,
    dtypes: {},
    layers: [],
    aes: null,
    legends: null, // strings corresponding to scales
    // that need legends or legend objects
    facet: null,
    width: 400,
    height: 400,
    margins: {left:20, right:20, top:20, bottom:20},
    xScale: {single: new ggd3.scale()}, 
    yScale: {single: new ggd3.scale()},
    colorScale: {single: new ggd3.scale()},
    sizeScale: {single: new ggd3.scale()},
    fillScale: {single: new ggd3.scale()},
    shapeScale: {single: new ggd3.scale()},
    alphaScale: {single: new ggd3.scale()},
    strokeScale: {single: new ggd3.scale()},
    xAdjust: false,
    yAdjust: false,
    alpha: 0.5,
    alphaRange: [0.1, 1],
    size: 30,
    sizeRange: [10, 100],
    fill: 'lightsteelblue',
    fillRange: ["blue", "red"],
    color: 'none', // default stroke for geoms
    colorRange: ["white", "black"],
    shape: 'circle',
    shapeRange: d3.superformulaTypes,
    opts: {},
    theme: "ggd3",
  };
  // aesthetics I might like to support:
// ["alpha", "angle", "color", "fill", "group", "height", "label", "linetype", "lower", "order", "radius", "shape", "size", "slope", "width", "x", "xmax", "xmin", "xintercept", "y", "ymax", "ymin", "yintercept"] 
  this.attributes = attributes;
  // doing more cleaning than necessary, counting it.
  this.timesCleaned = 0;
  // if the data method has been handed a new dataset, 
  // newData will be true, after the plot is drawn the
  // first time, newData is set to false
  this.newData = true;
  // when cycling through data, need to know if 
  // data are nested or not.
  this.nested = false;
  // explicitly declare which attributes get a basic
  // getter/setter
  var getSet = ["opts", "theme", "margins", 
    "width", "height", "xAdjust", "yAdjust", 
    "color", 'colorRange', 'size', 'sizeRange',
    'fill', 'fillRange',
    "alpha", "alphaRange", "shape"];

  for(var attr in attributes){
    if((!this[attr] && 
       _.contains(getSet, attr))){
      this[attr] = createAccessor(attr);
    }
  }
}

function scaleConfig(type) {
  var scale = type + "Scale";
  function scaleGetter(obj){
    if(!arguments.length) {
      return this.attributes[scale];
    }
    // reset to user specified entire scale object
    if(obj instanceof ggd3.scale){
      this.attributes[scale] = {};
      this.attributes[scale].single = obj;
      return this;
    }
    // pass null to reset scales entirely;
    if(_.isNull(obj)){
      this.attributes[scale] = {single: new ggd3.scale() };
      return this;
    }
    // 
    if(!_.isUndefined(obj)) {
      // merge additional options with old options
      if(this.attributes[scale].single instanceof ggd3.scale){
        obj = _.merge(this.attributes[scale].single._userOpts,
                           obj);
      }
      this.attributes[scale].single = new ggd3.scale(obj).plot(this);
      return this;
    }
  }
  return scaleGetter;
}

Plot.prototype.xScale = scaleConfig('x');

Plot.prototype.yScale = scaleConfig('y');

Plot.prototype.colorScale = scaleConfig('color');

Plot.prototype.sizeScale = scaleConfig('size');

Plot.prototype.shapeScale = scaleConfig('shape');

Plot.prototype.fillScale = scaleConfig('fill');

Plot.prototype.alphaScale = scaleConfig('alpha');

Plot.prototype.layers = function(layers) {
  if(!arguments.length) { return this.attributes.layers; }
  if(_.isArray(layers)) {
    // allow reseting of layers by passing empty array
    if(layers.length === 0){
      this.attributes.layers = layers;
      return this;
    }
    var layer;
    _.each(layers, function(l) {
      if(_.isString(l)){
        // passed string to get geom with default settings
        layer = new ggd3.layer()
                      .aes(this.aes())
                      .data(this.data())
                      .plot(this)
                      .geom(l);

        this.attributes.layers.push(layer);
      } else if ( l instanceof ggd3.layer ){
        // user specified layer
        console.log('instance of layer');
        if(!l.data()) { 
          l.data(this.data()).dtypes(this.dtypes()); 
        } else {
          l.ownData(true);
        }
        if(!l.aes()) { l.aes(this.aes()); }
        l.plot(this);
        this.attributes.layers.push(l);
      }
    }, this);
  } else if (layers instanceof ggd3.layer) {
    if(!layers.data()) { 
      layers.data(this.data()).dtypes(this.dtypes()); 
    } else {
      layers.ownData(true);
    }
    if(!layers.aes()) { layers.aes(this.aes()); }
    this.attributes.layers.push(layers.plot(this));
  }
  return this;
};

Plot.prototype.dtypes = function(dtypes) {
  if(!arguments.length) { return this.attributes.dtypes; }
  this.attributes.dtypes = _.merge(this.attributes.dtypes, dtypes);
  return this;
};

Plot.prototype.data = function(data) {
  if(!arguments.length || _.isNull(data)) { return this.attributes.data; }
  // clean data according to data types
  // and set top level ranges of scales.
  // dataset is passed through once here.
  // if passing 'dtypes', must be done before
  // let's just always nest and unNest
  data = ggd3.tools.unNest(data);
  data = ggd3.tools.clean(data, this);
  this.timesCleaned += 1;
  // after data is declared, nest it according to facets.
  this.attributes.data = this.nest(data.data);
  this.attributes.dtypes = _.merge(this.attributes.dtypes, data.dtypes);
  this.updateLayers();
  this.nested = data.data ? true:false;
  this.newData = data.data ? false:true;

  return this;
};

Plot.prototype.updateLayers = function() {
  _.each(this.layers(), function(l) {
    if(!l.ownData()) { l.dtypes(this.dtypes())
                        .data(this.data())
                        .aes(this.aes()); }
  }, this);
};

Plot.prototype.facet = function(spec) {
  // everytime a facet is passed
  // data nesting must be done again
  if(!arguments.length) { return this.attributes.facet; }
  if(spec instanceof ggd3.facet){
    this.attributes.facet = spec.plot(this);
  } else {
    this.attributes.facet = new ggd3.facet(spec)
                                    .plot(this);
  }
  this.data(this.data());
  return this;
};

Plot.prototype.aes = function(aes) {
  if(!arguments.length) { return this.attributes.aes; }
  // all layers need aesthetics
  _.each(this.layers(), function(layer) {
    layer.aes(aes);
  });
  this.attributes.aes = aes;
  return this;
};

Plot.prototype.plotDim = function() {
  var margins = this.margins();
  if(this.facet().type() === "grid"){
    return {x: this.width() - this.facet().margins().x, 
      y: this.height() - this.facet().margins().y};
  }
  return {x: this.width() - margins.left - margins.right,
   y: this.height() - margins.top - margins.bottom};
};

Plot.prototype.draw = function() {
  var that = this,
      updateFacet = that.facet().updateFacet();
  // get basic info about scales/aes;
  this.setScales();
  // set fixed/free domains
  this.setDomains();
  function draw(sel) {
    updateFacet(sel);
    // reset nSVGs after they're drawn.
    that.facet().nSVGs = 0;

    // get the number of geom classes that should
    // be present in the plot
    var classes = _.map(_.range(that.layers().length),
                    function(n) {
                      return "g" + (n);
                    });

    _.each(that.layers(), function(l, i) {
      l.draw(i)(sel);
      sel.selectAll('.geom')
        .filter(function() {
          var cl = d3.select(this).node().classList;
          return !_.contains(classes, cl[1]);

        })
        .transition().style('opacity', 0).remove();
    });

  }
  return draw;
};

Plot.prototype.nest = Nest;
// returns array of faceted objects {selector: s, data: data} 
Plot.prototype.dataList = DataList;

// update method for actions requiring redrawing plot
Plot.prototype.update = function() {

};

ggd3.plot = Plot;