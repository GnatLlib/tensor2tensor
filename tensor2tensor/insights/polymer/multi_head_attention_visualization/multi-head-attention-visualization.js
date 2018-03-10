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
 * `<processing-visualization>` summarises pre/post processing steps.
 *
 * This element presents the pre-processing segmentation steps and
 * post-processing de-segmentation and rewrite steps that are applied to a
 * translation query.
 *
 * ### Usage
 *
 *   <multi-head-attention-visualization data="[[data]]"></processing-visualization>
 */
class MultiHeadAttentionVisualization extends Polymer.Element {
  constructor() {
    super();
    this.TEXT_SIZE = 15;
    this.BOXWIDTH = this.TEXT_SIZE * 8;
    this.BOXHEIGHT = this.TEXT_SIZE * 1.5;
    this.WIDTH = 2000;
    this.HEIGHT = 100;
    this.MATRIX_WIDTH = 150;
    this.head_colours = d3old.scale.category10();
    this.CHECKBOX_SIZE = 20;
    this.config = {};
  }

  /**
   * @return {string} The component name.
   */

  static get is() {
    return 'multi-head-attention-visualization';
  }

  /**
   * @return {!Object} The component properties.
   */
  static get properties() {
    return {
      /**
       * @type {!QueryProcessingVisualization}
       */
      data: {
        type: Object,
        observer: 'dataUpdated_',
      },

      selectedLayer_: {
        type: Number,
        value: 5,
      },

      selectedAttentionType_: {
        type: String,
        value: 0,
      }



    };
  }

  static get observers() {
    return [
      'layerChanged_(selectedLayer_)',
      'attentionTypeChanged_(selectedAttentionType_)' 
    ];
  }

  ready() {
    super.ready();

    this.set('selectedLayer_', 5);
  }

  /**
   * Display multi-head attention visualization 
   */
  dataUpdated_() {
    this.HEIGHT = this.data["all"]["bot_text"].length * this.BOXHEIGHT * 2 + 100
    this.setLayers_();
    this.render_()
  }

  /**
   * Observer for changes to layers dropdown
   */
  layerChanged_(layer) {
    console.log('changed layer to', layer)
    this.render_()
  }

  /**
   * Observer for changes to attention types dropdown
   */
  attentionTypeChanged_(attentionType) {
    console.log('changed attention type to', attentionType)
    this.render_()
  } 

  /** 
   * Dynamically add layers to dropdown
   */
  setLayers_() {
    for (var i = 0; i < 6; i++) {
      var dynamicEl = document.createElement("paper-item");
      dynamicEl.textContent = i
      this.$.layer_dropdown.append(dynamicEl)
    }
  }

  render_() {
    var top_text;
    var bottom_text;
    var attention;
    switch(this.selectedAttentionType_) {
      case 1:
        top_text = this.data["inp_inp"]["top_text"]
        bottom_text = this.data["inp_inp"]["bot_text"]
        attention = this.data["inp_inp"]["att"][this.selectedLayer_]
        break
      case 2:
        top_text = this.data["inp_out"]["top_text"]
        bottom_text = this.data["inp_out"]["bot_text"]
        attention = this.data["inp_out"]["att"][this.selectedLayer_]
        break
      case 3:
        top_text = this.data["out_out"]["top_text"]
        bottom_text = this.data["out_out"]["bot_text"]
        attention = this.data["out_out"]["att"][this.selectedLayer_]
        break
      default:
        top_text = this.data["all"]["top_text"]
        bottom_text = this.data["all"]["bot_text"]
        attention = this.data["all"]["att"][this.selectedLayer_]
    }
    var num_heads = this.data["all"]["att"][0].length
    this.config.head_vis  = new Array(num_heads).fill(true)
    this.config.num_heads = num_heads
    // this.$.vis.clear()
    this.renderVis_(top_text, bottom_text, attention)
  }

  renderVis_(top_text, bot_text, attention) {
    var vis = Polymer.dom(this.root).querySelector('#vis');
    while (vis.firstChild) {
      vis.removeChild(vis.firstChild);
    }

    var svg = d3old.select(this.$.vis)
              .append('svg')
              .attr("width", this.WIDTH)
              .attr("height", this.HEIGHT);

    var att_data = [];
    for (var i = 0; i < attention.length; i++) {
      var att_trans = this.transpose_(attention[i]);
      att_data.push(this.zip_(attention[i], att_trans));
    }

    this.renderText_(this.config, svg, top_text, true, att_data, 0);
    this.renderText_(this.config, svg, bot_text, false, att_data, this.MATRIX_WIDTH + this.BOXWIDTH);

    this.renderAttentionHighlights_(svg, att_data);

    svg.append("g").classed("attention", true);

    this.renderAttention_(svg, attention);

    this.draw_checkboxes_(0, svg, attention);
  }

  active_heads_() {
    return this.config.head_vis.reduce(function(acc, val) {
      return val ? acc + 1: acc;
    }, 0);
  }


  box_offset_(i) {
    var num_head_above = this.config.head_vis.reduce(function(acc, val, cur) { 
        return val && cur < i ? acc + 1: acc;
    }, 0);
    return num_head_above*(this.BOXWIDTH / this.active_heads_());
  }

  renderText_(config, svg, text, is_top, att_data, left_pos) {
    var _this = this;
    var id = is_top ? "top" : "bottom";
    var textContainer = svg.append("svg:g")
                           .attr("id", id);

    textContainer.append("g").classed("attention_boxes", true)
                 .selectAll("g")
                 .data(att_data)
                 .enter()
                 .append("g")
                 .selectAll("rect")
                 .data(function(d) {return d;})
                 .enter()
                 .append("rect")
                 .attr("x", function(d, i, j) {
                   return left_pos + _this.box_offset_(j);
                 })
                 .attr("y", function(d, i) {
                   return (+1) * _this.BOXHEIGHT;
                 })
                 .attr("width", this.BOXWIDTH/this.active_heads_())
                 .attr("height", function() { return _this.BOXHEIGHT; })
                 .attr("fill", function(d, i, j) {
                    return _this.head_colours(j % 10);
                  })
                 .style("opacity", 0.0);


    var tokenContainer = textContainer.append("g").selectAll("g")
                                      .data(text)
                                      .enter()
                                      .append("g");

    tokenContainer.append("rect")
                  .classed("background", true)
                  .style("opacity", 0.0)
                  .attr("fill", "lightgray")
                  .attr("x", left_pos)
                  .attr("y", function(d, i) {
                    return (i+1) * _this.BOXHEIGHT;
                  })
                  .attr("width", this.BOXWIDTH)
                  .attr("height", this.BOXHEIGHT);

    var theText = tokenContainer.append("text")
                                .text(function(d) { return d; })
                                .attr("font-size", this.TEXT_SIZE + "px")
                                .style("cursor", "default")
                                .style("-webkit-user-select", "none")
                                .attr("x", left_pos)
                                .attr("y", function(d, i) {
                                  return (i+1) * _this.BOXHEIGHT;
                                });

    if (is_top) {
      theText.style("text-anchor", "end")
             .attr("dx", this.BOXWIDTH - this.TEXT_SIZE)
             .attr("dy", this.TEXT_SIZE);
    } else {
      theText.style("text-anchor", "start")
             .attr("dx", + this.TEXT_SIZE)
             .attr("dy", this.TEXT_SIZE);
    }

    tokenContainer.on("mouseover", function(d, index) {
      textContainer.selectAll(".background")
                   .style("opacity", function(d, i) {
                     return i == index ? 1.0 : 0.0;
                   });

      svg.selectAll(".attention_heads").style("display", "none");

      svg.selectAll(".line_heads")  // To get the nesting to work.
         .selectAll(".att_lines")
         .attr("stroke-opacity", function(d) {
            return 0.0;
          })
         .attr("y1", function(d, i) {
          if (is_top) {
            return (index+1) * _this.BOXHEIGHT + (_this.BOXHEIGHT/2);
          } else {
            return (i+1) * _this.BOXHEIGHT + (_this.BOXHEIGHT/2);
          }
       })
       .attr("x1", this.BOXWIDTH)
       .attr("y2", function(d, i) {
         if (is_top) {
            return (i+1) * _this.BOXHEIGHT + (_this.BOXHEIGHT/2);
          } else {
            return (index+1) * _this.BOXHEIGHT + (_this.BOXHEIGHT/2);
          }
       })
       .attr("x2", _this.BOXWIDTH + _this.MATRIX_WIDTH)
       .attr("stroke-width", 2)
       .attr("stroke", function(d, i, j) {
          return _this.head_colours(j % 10);
        })
       .attr("stroke-opacity", function(d, i, j) {
        if (is_top) {d = d[0];} else {d = d[1];}
        if (_this.config.head_vis[j]) {
          if (d) {
            return d[index];
          } else {
            return 0.0;
          }
        } else {
            return 0.0;
          }
        });

      function updateAttentionBoxes() {
        var id = is_top ? "bottom" : "top";
        var the_left_pos = is_top ? _this.MATRIX_WIDTH + _this.BOXWIDTH : 0;
        svg.select("#" + id)
           .selectAll(".attention_boxes")
           .selectAll("g")
           .selectAll("rect")
           .attr("x", function(d, i, j) { return the_left_pos + _this.box_offset_(j); })
           .attr("y", function(d, i) { return (i+1) * _this.BOXHEIGHT; })
           .attr("width", _this.BOXWIDTH/_this.active_heads_())
           .attr("height", function() { 
            return _this.BOXHEIGHT;
          }).style("opacity", function(d, i, j) {
              if (is_top) {
                d = d[0];
              } else {
                d = d[1];
              }
              if (_this.config.head_vis[j])
                if (d) {
                  return d[index];
                } else {
                  return 0.0;
                }
              else
                return 0.0;

           });
      }

      updateAttentionBoxes();
    });

    textContainer.on("mouseleave", function() {
      d3old.select(this).selectAll(".background")
                     .style("opacity", 0.0);

      svg.selectAll(".att_lines").attr("stroke-opacity", 0.0);
      svg.selectAll(".attention_heads").style("display", "inline");
      svg.selectAll(".attention_boxes")
         .selectAll("g")
         .selectAll("rect")
         .style("opacity", 0.0);
    });
  }

  renderAttentionHighlights_(svg, attention) {
    var line_container = svg.append("g");
    line_container.selectAll("g")
                  .data(attention)
                  .enter()
                  .append("g")
                  .classed("line_heads", true)
                  .selectAll("line")
                  .data(function(d) {
                    return d;
                  }).enter()
                  .append("line").classed("att_lines", true);
  }

  renderAttention_(svg, attention_heads) {
    var line_container = svg.selectAll(".attention_heads");
    var _this = this;
    line_container.html(null);
    for (var h = 0; h < attention_heads.length; h++) {
      for (var a = 0; a < attention_heads[h].length; a++) {
        for (var s = 0; s < attention_heads[h][a].length; s++) {
          line_container.append("line")
          .attr("y1", (s+1) * _this.BOXHEIGHT + (_this.BOXHEIGHT/2))
          .attr("x1", _this.BOXWIDTH)
          .attr("y2", (a+1) * _this.BOXHEIGHT + (_this.BOXHEIGHT/2))
          .attr("x2", _this.BOXWIDTH + _this.MATRIX_WIDTH)
          .attr("stroke-width", 2)
          .attr("stroke", this.head_colours(h % 10))
          .attr("stroke-opacity", function() {
            if (_this.config.head_vis[h]) {
              return attention_heads[h][a][s]/_this.active_heads_();
            } else {
              return 0.0;
            }
          }());
        }
      }
    }
  }

  draw_checkboxes_(top, svg, attention_heads) {
    var checkboxContainer = svg.append("g");
    var _this = this;
    var checkbox = checkboxContainer.selectAll("rect")
                                    .data(this.config.head_vis)
                                    .enter()
                                    .append("rect")
                                    .attr("fill", function(d, i) {
                                      return _this.head_colours(i % 10);
                                    })
                                    .attr("x", function(d, i) {
                                      return (i+1) * _this.CHECKBOX_SIZE;
                                    })
                                    .attr("y", top)
                                    .attr("width", _this.CHECKBOX_SIZE)
                                    .attr("height", _this.CHECKBOX_SIZE);

    function update_checkboxes() {
      checkboxContainer.selectAll("rect")
                                .data(_this.config.head_vis)
                                .attr("fill", function(d, i) {
                                  var head_colour = _this.head_colours(i % 10);
                                  var colour = d ? head_colour : _this.lighten_(head_colour);
                                  return colour;
                                });
    }

    update_checkboxes();

    checkbox.on("click", function(d, i) {
      if (_this.config.head_vis[i] && _this.active_heads_() == 1) return;
      _this.config.head_vis[i] = !_this.config.head_vis[i];
      update_checkboxes();
      _this.renderAttention_(svg, attention_heads);
    });

    checkbox.on("dblclick", function(d, i) {
      // If we double click on the only active head then reset
      if (_this.config.head_vis[i] && _this.active_heads_() == 1) {
        _this.config.head_vis = new Array(_this.config.num_heads).fill(true);
      } else {
        _this.config.head_vis = new Array(_this.config.num_heads).fill(false);
        _this.config.head_vis[i] = true;
      }
      update_checkboxes();
      _this.renderAttention_(svg, attention_heads);
    });
  }

  lighten_(colour) {
    var c = d3old.hsl(colour);
    var increment = (1 - c.l) * 0.6;
    c.l += increment;
    c.s -= increment;
    return c;
  }

  transpose_(mat) {
    return mat[0].map(function(col, i) {
      return mat.map(function(row) {
        return row[i];
      });
    });
  }

  zip_(a, b) {
    return a.map(function (e, i) {
      return [e, b[i]];
    });
  }


}

customElements.define(MultiHeadAttentionVisualization.is, MultiHeadAttentionVisualization);