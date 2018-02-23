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

  makeSelectable() {
    // Making rows selectable
    // Using JQuery, there might be a better way to do this though
    var table = Polymer.dom(this.root).querySelector('#nbest-table');
    var self = this;
    $(table).find(".sentence-row").click(function(){
      $(this).addClass('selected').siblings().removeClass('selected');    
      var value=$(this).index() - 1; // this index returns 1 higher than sequence index
      self.updateSelected(value);
    });
  }

  updateSelected(value) {
    this.selected_ = value;
    this.dataUpdated_();
  }

  dataUpdated_() {
    // TODO: compute total score based on token scores
    this.createSVG_();
  }

  /**
   * Creates the initial SVG canvas and associated structures.  This will remove
   * all previous svg elements.
   * @private
   */
  createSVG_() {
    // Dimension variables
    var maxWidth = 1600;
    var maxHeight = 160;
    var margins = [20, 50, 50, 50];
    var width = window.innerWidth - margins[1] - margins[2] - 256 - 100; // side bar is 256 px wide
    var height = window.innerHeight - margins[0] - margins[3] - 100;

    // Remove Current graph if any
    d3.select(this.$.chart).selectAll('.svg-container').remove();

    // set the dataset
    var dataset = this.data.sentence[this.selected_].tokens;

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
    console.log(textValues);

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
      .attr("class", "line") // Assign a class for styling 
      .attr("d", line); // 11. Calls the line generator 

    // Appends a circle for each datapoint 
    svg.selectAll(".dot")
      .data(dataset)
    .enter().append("circle") // Uses the enter().append() method
      .attr("class", "dot") // Assign a class for styling
      .attr("cx", function(d, i) { return xScale(i) })
      .attr("cy", function(d) { return yScale(d.score) })
      .attr("r", 5);
    }
  }
  
  customElements.define(NBestVisualization.is, NBestVisualization);
  