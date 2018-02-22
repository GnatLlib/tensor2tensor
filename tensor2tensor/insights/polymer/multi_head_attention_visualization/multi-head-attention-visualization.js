class MultiHeadAttention extends Polymer.Element {
  constructor() {
    super();
  }
  static get is() {
    return 'multi-head-attention-visualization';
  }
}

customElements.define(MultiHeadAttention.is, MultiHeadAttention);
