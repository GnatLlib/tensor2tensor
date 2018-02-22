class GraphVisualization extends Polymer.Element {
  constructor() {
    super();
  }
  static get is() {
    return 'multi-head-attention-visualization';
  }
}

customElements.define(AttentionVisualization.is, AttentionVisualization);
