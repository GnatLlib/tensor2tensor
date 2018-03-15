import unittest
import os
from tensor2tensor.insights.transformer_model import TransformerModel
import json


class BaseBackendTest(unittest.TestCase):
  def setUp(self):
    self.tf = TransformerModel(
      {u'transformer': {u'hparams_set': u'transformer_base_single_gpu',
                        u'data_dir': u'/Users/billtang/t2t_data',
                        u'problems': u'translate_ende_wmt32k',
                        u'hparams': u'',
                        u'model_dir': u'/Users/billtang/t2t_train/base',
                        u'model': u'transformer'},
       u'source_language': u'en',
       u'label': u'transformers_wmt32k',
       u'target_language': u'de'})

    self.hookdir = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'tensors')
    self.resultsdir = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'results')


class TestGraphVis(BaseBackendTest):

  def runTest(self):
    result = self.tf.get_graph_vis(self.hookdir)

    with open(os.path.join(self.resultsdir, "graph"), "r") as f:
      self.assertEquals(result, json.load(f))


class TestProcessingVis(BaseBackendTest):

  def runTest(self):
    result = self.tf.get_processing_vis("test input string", [10, 20, 30, 40, 50])

    with open(os.path.join(self.resultsdir, "processing"), "r") as f:
      self.assertEquals(result, json.load(f))


class TestNbestVis(BaseBackendTest):

  def runTest(self):
    result = self.tf.get_nbest_vis(self.hookdir)

    with open(os.path.join(self.resultsdir, "nbest"), "r") as f:
      self.assertEquals(result, json.load(f))


class TestAttentionVis(BaseBackendTest):

  def runTest(self):
    result = self.tf.get_multi_attention_vis("the cat is fat", [10, 9195, 1902, 24, 29809, 5, 3, 1])

    with open(os.path.join(self.resultsdir, "attention"), "r") as f:
      self.assertEquals(result, json.load(f))

   
if __name__ == '__main__':
  unittest.main()
