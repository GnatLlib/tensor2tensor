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
   * Helper function to update the selected row when a row in the results 
   * table is clicked.
   * @private
   */
  updateSelected_(e) {
    this.selected_  = e.model.index;
    this.dataUpdated_();
  }

  /**
   * Called whenever the data is updated.
   * @private
   */
  dataUpdated_() {
    // Create and display the svg
    this.createSVG_(computedData);
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
    var width = this.parentElement.clientWidth - margins[1] - margins[2];
    var calculatedHeight = (window.innerHeight - margins[0] - margins[3] - 100);
    var minHeight = 400;
    var height = calculatedHeight > minHeight ? calculatedHeight : minHeight;

    // Remove Current graph if any
    d3.select(this.$.chart).selectAll('.svg-container').remove();

    // Create the scales
    var xScale = d3.scaleLinear()
      .domain([0, dataset.length])
      .range([0, width]);

    var yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([height, 0]);

    // Create line 
    var line = d3.line()
      .x(function(d, i) { return xScale(i); })
      .y(function(d) { return yScale(d.tokenscore); }) 

    var line2 = d3.line()
      .x(function(d, i) { return xScale(i); })
      .y(function(d) { return yScale(d.score); })

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
    var totalValues = dataset.map(function(d){ return d.score });
    var tokenValues = dataset.map(function(d){ return d.tokenscore });

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
      .datum(dataset) // Binds data to the line 
      .attr("class", "line2") // Assign a class for styling
      .attr("d", line2); // Calls the line generator 

    svg.append("path")
      .datum(dataset)
      .attr("class", "line")
      .attr("d", line);

    // Add the line labels
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

    // Add the line dots
    var nodeEnter = svg.selectAll("circle")
      .data(dataset)
      .enter()
      .insert("g");

    nodeEnter.insert("circle")
      .attr("cx", function (d, i) { return xScale(i) })
      .attr("cy", function (d) { return yScale(d.tokenscore) })
      .attr("class", "dot")
      .attr("r", 5)

    nodeEnter.insert("circle")
      .attr("cx", function (d, i) { return xScale(i) })
      .attr("cy", function (d) { return yScale(d.score) })
      .attr("class", "dot2")
      .attr("r", 5)
    }
  }
  
  customElements.define(NBestVisualization.is, NBestVisualization);
  