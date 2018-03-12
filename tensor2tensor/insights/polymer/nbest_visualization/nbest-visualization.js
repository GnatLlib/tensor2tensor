  /**
 * @license
 * Copyright 2018 The Tensor2Tensor Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * `<nbest-visualization>` summarises nbest analysis on sentences.
 *
 * ### Usage
 *
 *   <nbest-visualization data="[[data]]"></nbest-visualization>
 */
class NBestVisualization extends Polymer.Element {
  constructor() {
    super();

    /**
     * @private
     */
    this.svg_ = undefined;

    /**
     * @private
     */
    this.selected_ = 0;
  }

  /**
   * @return {string} The component name.
   */
  static get is() {
    return 'nbest-visualization';
  }

  /**
   * @return {!Object} The component properties.
   */
  static get properties() {
    return {
      /**
       * @type {!QueryNBestVisualization}
       */
      data: {
        type: Object,
        observer: 'dataUpdated_',
      },
    };
  }
  
  /**
   * Helper function for making sentence rows selectable in the results table.
   * Currently implemented using jQuery.
   */
  makeSelectable() {
    // Using JQuery, there might be a better way to do this though
    var table = Polymer.dom(this.root).querySelector('#nbest-table');
    var self = this;
    $(table).find(".sentence-row").click(function(){
      $(this).addClass('selected').siblings().removeClass('selected');    
      var value=$(this).index() - 1; // this index returns 1 higher than sequence index
      self.updateSelected_(value);
    });
  }

  /**
   * Helper function to update the selected row when a row in the results 
   * table is clicked.
   * @private
   */
  updateSelected_(value) {
    this.selected_ = value;
    this.dataUpdated_();
  }

  /**
   * Called whenever the data is updated.
   * @private
   */
  dataUpdated_() {
    // Compute total score based on token scores
    var computedData = this.prepareData_();

    // Create and display the svg
    this.createSVG_(computedData);
  }

  /**
   * Prepares the data for the selected sentence to be displayed in the svg.
   * Computes total score given the token scores.
   * @private
   */
  prepareData_() {
    var dataset = this.data.sentence[this.selected_].tokens;
    var curr_score = 1;
    dataset.forEach(function(token) {
      curr_score *= token.score;
      token.totalscore = curr_score;
    });
    return dataset;
  }

  /**
   * Creates the initial SVG canvas and associated structures.  This will remove
   * all previous svg elements.
   * @private
   */
  createSVG_(dataset) {
    // Dimension variables
    var maxWidth = 1600;
    var maxHeight = 160;
    var margins = [20, 50, 50, 50];
    var width = window.innerWidth - margins[1] - margins[2] - 256 - 100; // side bar is 256 px wide
    var height = window.innerHeight - margins[0] - margins[3] - 100;

    // Remove Current graph if any
    d3.select(this.$.chart).selectAll('.svg-container').remove();

    // Create the scales
    var xScale = d3.scaleLinear()
      .domain([0, dataset.length])
      .range([0, width]); // output

    var yScale = d3.scaleLinear()
      .domain([0, 1]) // input 
      .range([height, 0]); // output

    // Create line (not working)
    var line = d3.line()
      .x(function(d, i) { return xScale(i); }) // set the x values for the line generator
      .y(function(d) { return yScale(d.score); }) // set the y values for the line generator

    var line2 = d3.line()
      .x(function(d, i) { return xScale(i); }) // set the x values for the line generator
      .y(function(d) { return yScale(d.totalscore); }) // set the y values for the line generator 

    // Add the SVG to the page
    var svg = d3.select(this.$.chart)
      .append("div")
      .classed("svg-container", true)
      .append("svg")
      .attr("width", "100%")
      .attr("height", height + margins[0] + margins[3])
      .append("g")
      .attr("transform", "translate(" + margins[1] + "," + margins[0] + ")");

    var textValues = dataset.map(function(d){ return d.text });
    var totalValues = dataset.map(function(d){ return d.totalscore });
    var tokenValues = dataset.map(function(d){ return d.score });

    // Call the x axis in a group tag
    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(xScale) // Create an axis component with d3.axisBottom
        .ticks(dataset.length)
        .tickFormat(function(d, i) {
          return textValues[i];
        }));

    // Call the y axis in a group tag
    svg.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(yScale)); // Create an axis component with d3.axisLeft

    // Append the path, bind the data, and call the line generated
    svg.append("path")
      .datum(dataset) // 10. Binds data to the line 
      .attr("class", "line2") // Assign a class for styling
      .attr("d", line2); // 11. Calls the line generator 

    svg.append("path")
      .datum(dataset) // 10. Binds data to the line 
      .attr("class", "line") // Assign a class for styling
      .attr("d", line); // 11. Calls the line generator 

    svg.append("text")
      .attr("transform", "translate("+(width*((dataset.length-1)/dataset.length)+10)+","+((1-(tokenValues[(dataset.length)-1]))*height)+")")
      .attr("dy", ".35em")
      .attr("text-anchor", "start")
      .style("fill", "orange")
      .text("Token");

    svg.append("text")
      .attr("transform", "translate("+(width*((dataset.length-1)/dataset.length)+10)+","+((1-(totalValues[(dataset.length)-1]))*height)+")")
      .attr("dy", ".35em")
      .attr("text-anchor", "start")
      .style("fill", "steelblue")
      .text("Total");

    var nodeEnter = svg.selectAll("circle")
      .data(dataset)
      .enter()
      .insert("g");

    nodeEnter.insert("circle")
      .attr("cx", function (d, i) { return xScale(i) })
      .attr("cy", function (d) { return yScale(d.score) })
      .attr("class", "dot")
      .attr("r", 5)

    nodeEnter.insert("circle")
      .attr("cx", function (d, i) { return xScale(i) })
      .attr("cy", function (d) { return yScale(d.totalscore) })
      .attr("class", "dot2")
      .attr("r", 5)
    }
  }
  
  customElements.define(NBestVisualization.is, NBestVisualization);
  